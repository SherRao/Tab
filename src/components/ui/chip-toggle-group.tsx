"use client";

const SIZE_CLASSES = {
  sm: "px-2.5 py-1 text-[11px]",
  md: "px-3 py-1.5 text-xs",
} as const;

export function ChipToggleGroup({
  participants,
  selectedIds,
  onToggle,
  size = "sm",
}: {
  participants: { id: number; name: string }[];
  selectedIds: number[];
  onToggle: (id: number) => void;
  size?: keyof typeof SIZE_CLASSES;
}) {
  return (
    <>
      {participants.map((p) => {
        const on = selectedIds.includes(p.id);
        return (
          <button
            key={p.id}
            type="button"
            onClick={() => onToggle(p.id)}
            className={`rounded-full ${SIZE_CLASSES[size]} font-mono font-medium tracking-wide uppercase transition active:scale-[0.95] ${
              on
                ? "bg-accent text-white shadow-sm"
                : "bg-stone-200/70 text-stone-600 hover:bg-stone-300/70"
            }`}
          >
            {on && "✓ "}
            {p.name}
          </button>
        );
      })}
    </>
  );
}
