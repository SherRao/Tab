"use client";

import { ChipToggleGroup } from "@/components/ui/chip-toggle-group";
import { MoneyInput } from "@/components/ui/money-input";

export interface EditorItem {
  name: string;
  amount: string;
  participantIds: number[];
  quantity: string;
  participantQuantities: Record<number, number>;
}

export function LineItemRow({
  item,
  participants,
  onPatch,
  onToggleAssignee,
  onAssignAll,
  onRemove,
  removable,
}: {
  item: EditorItem;
  participants: { id: number; name: string }[];
  onPatch: (patch: Partial<EditorItem>) => void;
  onToggleAssignee: (participantId: number) => void;
  onAssignAll: () => void;
  onRemove: () => void;
  removable: boolean;
}) {
  const totalQuantity = parseInt(item.quantity) || 0;
  const hasQuantity = totalQuantity > 0;
  const assignedParticipants = participants.filter((p) => item.participantIds.includes(p.id));
  const hasMultipleAssignees = assignedParticipants.length > 1;

  function setParticipantQuantity(pid: number, qty: number) {
    onPatch({
      participantQuantities: { ...item.participantQuantities, [pid]: qty },
    });
  }

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
        <input
          value={item.quantity}
          onChange={(e) => onPatch({ quantity: e.target.value })}
          placeholder="Qty"
          type="number"
          min="0"
          className="input-ink w-16 py-2 text-center"
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
      {hasQuantity && hasMultipleAssignees && (
        <div className="mt-2.5 border-t border-dashed border-foreground/10 pt-2.5">
          <p className="label-mono text-[11px] text-stone-400">
            Assign {totalQuantity} across {assignedParticipants.length} people
          </p>
          <div className="mt-1.5 flex flex-wrap gap-2">
            {assignedParticipants.map((p) => (
              <label key={p.id} className="flex items-center gap-1.5">
                <span className="text-xs text-stone-600">{p.name}</span>
                <input
                  type="number"
                  min="0"
                  max={totalQuantity}
                  value={item.participantQuantities[p.id] ?? ""}
                  onChange={(e) => setParticipantQuantity(p.id, parseInt(e.target.value) || 0)}
                  className="input-ink w-14 py-1 text-center text-xs"
                />
              </label>
            ))}
          </div>
          {(() => {
            const assignedTotal = assignedParticipants.reduce(
              (sum, p) => sum + (item.participantQuantities[p.id] || 0),
              0,
            );
            if (assignedTotal !== totalQuantity && assignedTotal > 0) {
              return (
                <p className="mt-1 font-mono text-[11px] text-amber-600">
                  {assignedTotal} of {totalQuantity} assigned
                </p>
              );
            }
            return null;
          })()}
        </div>
      )}
    </li>
  );
}
