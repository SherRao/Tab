import { beforeAll, describe, expect, it, vi } from "vitest";
import os from "node:os";
import path from "node:path";

vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

process.env.DATABASE_URL = `file:${path.join(os.tmpdir(), `auth-test-${Date.now()}-${process.pid}.db`)}`;

let auth: typeof import("@/lib/auth");
let dbModule: typeof import("@/db");

beforeAll(async () => {
  dbModule = await import("@/db");
  dbModule.runMigrations();
  auth = await import("@/lib/auth");
});

describe("magic-link tokens", () => {
  it("hashes tokens so raw values are never stored", async () => {
    const token = auth.generateToken();
    const hash = auth.hashToken(token);
    expect(hash).not.toBe(token);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(auth.hashToken(token)).toBe(hash);
  });

  it("consumes a valid token exactly once", async () => {
    const token = await auth.createLoginToken("Once@Example.com");
    const consumed = await auth.consumeLoginToken(token);
    expect(consumed).toEqual({ email: "once@example.com", participantId: null });

    const replay = await auth.consumeLoginToken(token);
    expect(replay).toBeNull();
  });

  it("rejects expired tokens", async () => {
    const token = await auth.createLoginToken("expired@example.com");
    // Force the stored token to be expired.
    const { eq } = await import("drizzle-orm");
    const { authTokens } = await import("@/db/schema");
    await dbModule.db
      .update(authTokens)
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .where(eq(authTokens.email, "expired@example.com"));

    const consumed = await auth.consumeLoginToken(token);
    expect(consumed).toBeNull();
  });

  it("rejects unknown tokens without throwing", async () => {
    const consumed = await auth.consumeLoginToken("not-a-real-token");
    expect(consumed).toBeNull();
  });

  it("binds invite tokens to their participant", async () => {
    const queries = await import("@/lib/queries");
    const { event } = await queries.createEventRecord("Invite Event", ["P"]);
    const detail = await queries.getEventByToken(event.shareToken);
    const participantId = detail!.participants[0].id;

    const token = await auth.createLoginToken("invited@example.com", participantId);
    const consumed = await auth.consumeLoginToken(token);
    expect(consumed?.participantId).toBe(participantId);
    expect(consumed?.email).toBe("invited@example.com");
  });
});
