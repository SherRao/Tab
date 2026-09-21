import { formatCents } from "@/lib/format";
import type { Transfer } from "@/lib/ledger";

export function ViewerSummary({
  viewer,
  viewerParticipantId,
  nets,
  transfers,
}: {
  viewer: { id: number } | null;
  viewerParticipantId: number | null;
  nets: Map<number, number>;
  transfers: Transfer[];
}) {
  if (!viewer) return null;

  if (viewerParticipantId == null) {
    return (
      <div className="paper-card p-4 font-mono text-sm text-stone-400">
        You&apos;re not in this tab yet
      </div>
    );
  }

  const net = nets.get(viewerParticipantId) ?? 0;

  if (net === 0) {
    return (
      <div className="paper-card p-4 font-mono text-sm text-stone-500">
        You&apos;re all settled
      </div>
    );
  }

  const count =
    net > 0
      ? transfers.filter((t) => t.toId === viewerParticipantId).length
      : transfers.filter((t) => t.fromId === viewerParticipantId).length;

  const people = count === 1 ? "person" : "people";

  return (
    <div
      className={`paper-card p-4 font-mono text-sm font-semibold ${
        net > 0 ? "text-accent-strong" : "text-orange-600"
      }`}
    >
      {net > 0
        ? `You get back ${formatCents(net)} from ${count} ${people}`
        : `You owe ${formatCents(-net)} to ${count} ${people}`}
    </div>
  );
}
