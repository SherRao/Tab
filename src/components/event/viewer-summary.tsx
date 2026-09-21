import { formatCents } from "@/lib/format";

export function ViewerSummary({
  viewerParticipantId,
  netCents,
  transferCount,
  settleUpId,
}: {
  viewerParticipantId: number | null;
  netCents: number;
  transferCount: number;
  settleUpId: string;
}) {
  if (viewerParticipantId == null) return null;

  let message: string;
  if (netCents === 0) {
    message = "You’re all settled up";
  } else if (netCents < 0) {
    const people = transferCount === 1 ? "1 person" : `${transferCount} people`;
    message = `You owe ${formatCents(Math.abs(netCents))} to ${people}`;
  } else {
    const people = transferCount === 1 ? "1 person" : `${transferCount} people`;
    message = `You get back ${formatCents(netCents)} from ${people}`;
  }

  return (
    <a
      href={`#${settleUpId}`}
      className="paper-card mt-4 flex items-center justify-between px-4 py-3 transition-colors hover:border-accent/40"
    >
      <span className="font-mono text-sm font-semibold text-accent-strong">{message}</span>
      <span className="label-mono text-stone-400">settle up →</span>
    </a>
  );
}
