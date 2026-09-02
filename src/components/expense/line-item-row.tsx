"use client";

import { ChipToggleGroup } from "@/components/ui/chip-toggle-group";
import { MoneyInput } from "@/components/ui/money-input";

export function LineItemRow({
  item,
  participants,
  onPatch,
  onToggleAssignee,
  onAssignAll,
  onRemove,
  removable,
}: {
  item: { name: string; amount: string; participantIds: number[] };
  participants: { id: number; name: string }[];
  onPatch: (patch: Partial<{ name: string; amount: string; participantIds: number[] }>) => void;
  onToggleAssignee: (participantId: number) => void;
  onAssignAll: () => void;
  onRemove: () => void;
  removable: boolean;
}) {
  return (
    <li className="border border-dashed border-foreground/25 bg-background/60 p-3.5">
      <div className="flex gap-2">
        <input
          value={item.name}
          onChange={(e) => onPatch({ name: e.target.value })}
          placeholder="Item name"
          className="input-ink py-2"
        />
        <MoneyInput
          value={item.amount}
          onChange={(amount) => onPatch({ amount })}
          wrapperClassName="relative w-28 shrink-0"
          dollarAt="left-3"
          className="py-2 pr-2"
        />
      </div>
      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          onClick={onAssignAll}
          className="rounded-full border border-dashed border-stone-400 px-2.5 py-1 font-mono text-[11px] tracking-wide text-stone-500 uppercase transition hover:border-accent hover:text-accent-strong"
        >
          Everyone
        </button>
        <ChipToggleGroup
          size="sm"
          participants={participants}
          selectedIds={item.participantIds}
          onToggle={onToggleAssignee}
        />
        {removable && (
          <button
            type="button"
            onClick={onRemove}
            className="ml-auto rounded-md px-2 py-1 font-mono text-[11px] tracking-wide text-red-400 uppercase transition hover:text-red-600"
          >
            Remove
          </button>
        )}
      </div>
    </li>
  );
}
