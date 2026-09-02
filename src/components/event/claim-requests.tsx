import { decideClaimAction } from "@/lib/actions";
import { SectionHeading } from "@/components/ui/section-heading";

export interface ClaimRequestRow {
  id: number;
  participantId: number;
  requesterUsername: string;
}

export function ClaimRequests({
  token,
  claims,
  guestNameOf,
}: {
  token: string;
  claims: ClaimRequestRow[];
  guestNameOf: (participantId: number) => string;
}) {
  if (claims.length === 0) return null;

  return (
    <section className="mt-8">
      <SectionHeading>Claim requests</SectionHeading>
      <ul className="mt-3 space-y-2">
        {claims.map((claim) => {
          const guestName = guestNameOf(claim.participantId);
          return (
            <li
              key={claim.id}
              className="paper-card flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3"
            >
              <span className="text-sm">
                <strong>@{claim.requesterUsername}</strong>
                <span className="text-stone-500"> says they&apos;re </span>
                <strong>{guestName}</strong>
              </span>
              <span className="flex gap-2">
                <form action={decideClaimAction}>
                  <input type="hidden" name="token" value={token} />
                  <input type="hidden" name="claimId" value={claim.id} />
                  <input type="hidden" name="decision" value="approve" />
                  <button type="submit" className="btn-ink px-3 py-1.5 text-xs">
                    Approve
                  </button>
                </form>
                <form action={decideClaimAction}>
                  <input type="hidden" name="token" value={token} />
                  <input type="hidden" name="claimId" value={claim.id} />
                  <input type="hidden" name="decision" value="deny" />
                  <button
                    type="submit"
                    className="btn-ghost px-3 py-1.5 text-xs hover:text-red-600"
                  >
                    Deny
                  </button>
                </form>
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
