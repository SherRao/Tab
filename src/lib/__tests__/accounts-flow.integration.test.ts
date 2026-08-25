import { beforeAll, describe, expect, it, vi } from "vitest";
import os from "node:os";
import path from "node:path";
import { eq } from "drizzle-orm";

vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
const redirectMock = vi.fn((url: string) => {
  throw new Error(`NEXT_REDIRECT:${url}`);
});
vi.mock("next/navigation", () => ({ redirect: (url: string) => redirectMock(url) }));

process.env.DATABASE_URL = `file:${path.join(os.tmpdir(), `accounts-test-${Date.now()}-${process.pid}.db`)}`;

// Mutable signed-in identity so tests can act as different users.
let currentUser = { id: 0, email: "", username: "", displayName: "" };
vi.mock("@/lib/auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/auth")>();
  return {
    ...actual,
    requireSession: async () => ({ ...currentUser }),
    getSessionUser: async () =>
      currentUser.id ? { ...currentUser } : null,
  };
});

let queries: typeof import("@/lib/queries");
let actions: typeof import("@/lib/actions");
let participantsLib: typeof import("@/lib/participants");
let dbModule: typeof import("@/db");

function addForm(token: string, entry: unknown) {
  const form = new FormData();
  form.set("token", token);
  form.set("entry", JSON.stringify(entry));
  return form;
}

beforeAll(async () => {
  dbModule = await import("@/db");
  dbModule.runMigrations();
  const schema = await import("@/db/schema");
  queries = await import("@/lib/queries");
  actions = await import("@/lib/actions");
  participantsLib = await import("@/lib/participants");

  for (const u of [
    { email: "owner@test.dev", username: "ownertest", displayName: "Owner" },
    { email: "friend@test.dev", username: "friendtest", displayName: "Friend" },
  ]) {
    const [row] = await dbModule.db.insert(schema.users).values(u).returning();
    if (u.username === "ownertest") currentUser.id = row.id;
  }
});

describe("accounts and participants flow", () => {
  it("creates an owned event with mixed participant states", async () => {
    const { event, participants } = await queries.createEventRecord(
      "Accounts Trip",
      [{ mode: "guest", name: "Dana" }, { mode: "invite", name: "Carl", email: "carl@test.dev" }],
      currentUser.id,
    );
    expect(event.ownerId).toBe(currentUser.id);
    expect(participants).toHaveLength(2);
    expect(participants[0]).toMatchObject({ name: "Dana", userId: null, email: null });
    expect(participants[1]).toMatchObject({
      name: "Carl",
      email: "carl@test.dev",
      userId: null,
    });
    expect(participants[1].invitedAt).not.toBeNull();
  });

  it("adds an account-backed participant only via explicit selection", async () => {
    const { event } = await queries.createEventRecord(
      "Search Event",
      ["A", "B"],
      currentUser.id,
    );

    // Explicit selection links the account.
    await actions.addParticipantAction(
      addForm(event.shareToken, { mode: "account", userId: currentUser.id }),
    );
    let detail = await queries.getEventByToken(event.shareToken);
    expect(detail!.participants.find((p) => p.userId === currentUser.id)).toBeTruthy();

    // Re-adding the same account is refused.
    redirectMock.mockClear();
    await expect(
      actions.addParticipantAction(
        addForm(event.shareToken, { mode: "account", userId: currentUser.id }),
      ),
    ).rejects.toThrow(/addError=/);

    // Typed-but-unselected text never links silently.
    await actions.addParticipantAction(
      addForm(event.shareToken, {
        mode: "guest",
        name: "ownertest",
      }),
    );
    detail = await queries.getEventByToken(event.shareToken);
    const ghosts = detail!.participants.filter((p) => p.name === "ownertest" && p.userId == null);
    expect(ghosts).toHaveLength(1);
  });

  it("search finds accounts by username substring or exact email, for anyone", async () => {
    const byName = await participantsLib.searchAccounts("friend");
    expect(byName.some((a) => a.username === "friendtest")).toBe(true);
    const byEmail = await participantsLib.searchAccounts("friend@test.dev");
    expect(byEmail.map((a) => a.username)).toEqual(["friendtest"]);
    const short = await participantsLib.searchAccounts("f");
    expect(short).toHaveLength(0);
  });

  it("claims a guest only after owner approval, keeping balances stable", async () => {
    const { users } = await import("@/db/schema");
    const [friend] = await dbModule.db
      .select()
      .from(users)
      .where(eq(users.username, "friendtest"));

    const { event, participants } = await queries.createEventRecord(
      "Claim Event",
      [{ mode: "guest", name: "Dana" }, { mode: "guest", name: "Milo" }],
      currentUser.id,
    );
    const dana = participants.find((p) => p.name === "Dana")!;

    // Give Dana a balance before the claim.
    await actions.saveExpenseAction(event.shareToken, {
      payerId: dana.id,
      description: "Pre-claim dinner",
      taxCents: 0,
      tipCents: 0,
      totalCents: 3000,
      splitMode: "even",
      evenParticipantIds: participants.map((p) => p.id),
      items: [],
    });

    // Friend requests the claim.
    currentUser = {
      id: friend.id,
      email: friend.email,
      username: friend.username,
      displayName: friend.displayName,
    };
    const claimForm = new FormData();
    claimForm.set("token", event.shareToken);
    claimForm.set("participantId", String(dana.id));
    await actions.requestClaimAction(claimForm);

    // Friend cannot approve their own claim — they are not the owner.
    redirectMock.mockClear();
    const approveForm = new FormData();
    approveForm.set("token", event.shareToken);
    const pending = await queries.getPendingClaims(event.id);
    expect(pending).toHaveLength(1);
    approveForm.set("claimId", String(pending[0].id));
    approveForm.set("decision", "approve");
    await expect(actions.decideClaimAction(approveForm)).rejects.toThrow(
      /claimError=/,
    );

    // Owner approves; the guest becomes the friend's account.
    currentUser = {
      id: 1,
      email: "owner@test.dev",
      username: "ownertest",
      displayName: "Owner",
    };
    await actions.decideClaimAction(approveForm);

    const after = await queries.getEventByToken(event.shareToken);
    const danaAfter = after!.participants.find((p) => p.id === dana.id)!;
    expect(danaAfter.userId).toBe(friend.id);
    expect(danaAfter.userDisplayName).toBe("Friend");

    // Balance carried over unchanged through the linkage.
    const expenseRows = await queries.getExpenses(event.id);
    const ledger = await import("@/lib/ledger");
    const nets = ledger.computeNetBalances(
      after!.participants,
      expenseRows.map(({ expense, items }) => ({
        payerId: expense.payerId,
        taxCents: expense.taxCents,
        tipCents: expense.tipCents,
        totalCents: expense.totalCents,
        splitMode: expense.splitMode,
        evenParticipantIds: expense.evenParticipantIds ?? undefined,
        lineItems: items.map((i) => ({
          name: i.item.name,
          amountCents: i.item.amountCents,
          participantIds: i.participantIds,
        })),
      })),
    );
    expect(nets.get(dana.id)).toBe(1500);
    expect([...nets.values()].reduce((a, b) => a + b, 0)).toBe(0);
  });
});

