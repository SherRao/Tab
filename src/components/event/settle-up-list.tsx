import { formatCents } from "@/lib/format";
import { SectionHeading } from "@/components/ui/section-heading";

export interface TransferRow {
  fromId: number;
  toId: number;
  amountCents: number;
}

export function SettleUpList({
  transfers,
  nameOf,
}: {
  transfers: TransferRow[];
  nameOf: Map<number, string>;
}) {
  return (
    <section className="mt-12">
      <SectionHeading>Settle up</SectionHeading>
      {transfers.length === 0 ? (
        <div className="receipt-card receipt-lined mt-4 p-8 pb-9 text-center">
          <span className="stamp">all settled ✓</span>
          <p className="mt-3 font-mono text-xs text-stone-400">nothing to transfer right now</p>
        </div>
      ) : (
        <ul className="mt-4 space-y-2">
          {transfers.map((t, i) => (
            <li key={i} className="paper-card flex items-center justify-between px-4 py-3">
              <span className="text-sm">
                <strong>{nameOf.get(t.fromId)}</strong>
                <span className="mx-2 inline-block -translate-y-[1px] font-mono text-accent">
                  ⟶
                </span>
                <strong>{nameOf.get(t.toId)}</strong>
              </span>
              <span className="border border-accent-strong/60 px-2 py-0.5 font-mono text-sm font-semibold tabular-nums text-accent-strong">
                {formatCents(t.amountCents)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
