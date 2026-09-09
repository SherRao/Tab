"use client";

export interface EditorGroup {
  id: number;
  name: string;
  memberIds: number[];
}

/**
 * Group shortcuts in the "Split between" row. Tapping a pill toggles the whole
 * group into the split (members resolve live at balance time); the small edit
 * affordance opens the group for renaming or membership changes.
 */
export function GroupPillRow({
  groups,
  selectedGroupIds,
  onToggle,
  onEdit,
  onNew,
}: {
  groups: EditorGroup[];
  selectedGroupIds: number[];
  onToggle: (groupId: number) => void;
  onEdit: (groupId: number) => void;
  onNew: () => void;
}) {
  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {groups.map((g) => {
        const on = selectedGroupIds.includes(g.id);
        return (
          <span
            key={g.id}
            className={`inline-flex items-center rounded-full font-mono text-xs font-medium tracking-wide uppercase transition ${
              on ? "bg-accent text-white shadow-sm" : "bg-stone-200/70 text-stone-600"
            }`}
          >
            <button
              type="button"
              onClick={() => onToggle(g.id)}
              className="py-1.5 pr-1 pl-3 transition active:scale-[0.95]"
            >
              {on && "✓ "}
              {g.name} ({g.memberIds.length})
            </button>
            <button
              type="button"
              onClick={() => onEdit(g.id)}
              aria-label={`Edit ${g.name}`}
              className={`py-1.5 pr-3 pl-1 text-[11px] transition hover:opacity-100 ${
                on ? "opacity-80" : "opacity-50 hover:opacity-90"
              }`}
            >
              ✎
            </button>
          </span>
        );
      })}
      <button
        type="button"
        onClick={onNew}
        className="rounded-full border border-dashed border-stone-400 px-3 py-1.5 font-mono text-xs font-medium tracking-wide text-stone-500 uppercase transition hover:border-accent hover:text-accent-strong active:scale-[0.95]"
      >
        + New group
      </button>
    </div>
  );
}
