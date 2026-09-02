import { participantState } from "@/lib/participants";
import { formatCents } from "@/lib/format";
import { requestClaimAction } from "@/lib/actions";
import { AddSomeoneControl } from "@/components/people/add-someone-control";
import { SectionHeading } from "@/components/ui/section-heading";
import {
  BalanceBreakdown,
  type ParticipantBreakdownView,
} from "@/components/event/balance-breakdown";

export interface BalancePerson {
  id: number;
  name: string;
  displayName: string;
  userId: number | null;
  email: string | null;
  invitedAt: Date | null;
}

export interface PendingClaimRow {
  id: number;
  participantId: number;
  requesterUsername: string;
  requesterDisplayName: string;
}

export interface BalanceViewer {
  id: number;
  displayName: string;
}

const STATE_BADGES = {
  linked: null,
  invited: "invited",
  guest: "no account",
} as const;

export function BalanceList({
  token,
  people,
  nets,
  pendingClaims,
  viewerHasClaimed,
  viewer,
  addAction,
  breakdowns,
}: {
  token: string;
  people: BalancePerson[];
  nets: Map<number, number>;
  pendingClaims: PendingClaimRow[];
  viewerHasClaimed: boolean;
  viewer: BalanceViewer | null;
  addAction: (formData: FormData) => void | Promise<void>;
  breakdowns: Map<number, ParticipantBreakdownView>;
}) {
  const pendingByParticipant = new Map(pendingClaims.map((c) => [c.participantId, c]));

  return (
    <section className="mt-12">
      <SectionHeading>Balances</SectionHeading>
      <ul className="divide-y divide-dashed divide-foreground/10">
        {people.map((p) => {
          const net = nets.get(p.id) ?? 0;
          const state = participantState({
            userId: p.userId,
            email: p.email,
            invitedAt: p.invitedAt,
          });
          const badge = STATE_BADGES[state];
          const breakdown = breakdowns.get(p.id);

          return (
            <li key={p.id} className="py-2.5">
              <div className="flex items-center justify-between">
                <span className="flex min-w-0 items-center gap-2.5">
                  <span
                    className={`h-2 w-2 shrink-0 rounded-full ${
                      net > 0 ? "bg-accent" : net < 0 ? "bg-orange-500" : "bg-stone-300"
                    }`}
                  />
                  <span className="truncate font-medium">{p.displayName}</span>
                  {badge && (
                    <span className="label-mono shrink-0 border border-dashed border-stone-300 px-1.5 py-0.5 text-[10px] text-stone-400">
                      {badge}
                    </span>
                  )}
                </span>
                <div className="flex items-center gap-2">
                  <span
                    className={`font-mono text-sm font-semibold tabular-nums ${
                      net > 0
                        ? "text-accent-strong"
                        : net < 0
                          ? "text-orange-600"
                          : "text-stone-400"
                    }`}
                  >
                    {net > 0
                      ? `gets back ${formatCents(net)}`
                      : net < 0
                        ? `owes ${formatCents(-net)}`
                        : "settled"}
                  </span>
                  {breakdown && (
                    <BalanceBreakdown participantId={p.id} netCents={net} breakdown={breakdown} />
                  )}
                </div>
              </div>
              {state === "guest" && viewer && viewer.id !== p.userId && (
                <div className="mt-1 pl-[18px]">
                  {pendingByParticipant.has(p.id) ? (
                    <span className="label-mono text-[11px] text-stone-400">
                      claim requested — waiting on{" "}
                      {pendingByParticipant.get(p.id)?.requesterDisplayName ===
                      viewer.displayName
                        ? "the owner"
                        : "owner approval"}
                    </span>
                  ) : viewerHasClaimed ? (
                    <span className="label-mono text-[11px] text-stone-300">
                      you already have a claim here
                    </span>
                  ) : (
                    <form action={requestClaimAction}>
                      <input type="hidden" name="token" value={token} />
                      <input type="hidden" name="participantId" value={p.id} />
                      <button
                        type="submit"
                        className="label-mono text-[11px] text-stone-400 transition hover:text-accent-strong hover:underline"
                      >
                        “{p.displayName}” is me — request to claim
                      </button>
                    </form>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
      {viewer ? (
        <AddSomeoneControl
          token={token}
          addedUserIds={people.map((p) => p.userId).filter((id): id is number => id != null)}
          addAction={addAction}
        />
      ) : (
        <p className="label-mono mt-3 text-stone-300">sign in to add people</p>
      )}
    </section>
  );
}
