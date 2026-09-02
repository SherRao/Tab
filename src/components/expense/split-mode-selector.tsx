"use client";

export const MODES = [
  { value: "itemized", label: "By items", hint: "Tag who got what on each line" },
  { value: "even", label: "Even split", hint: "Divide the total between chosen people" },
  { value: "group", label: "Group", hint: "Everyone splits it all — birthday mode" },
] as const;

export type SplitMode = (typeof MODES)[number]["value"];

export function SplitModeSelector({
  value,
  onChange,
}: {
  value: SplitMode;
  onChange: (mode: SplitMode) => void;
}) {
  return (
    <section>
      <label className="label-mono block text-stone-500">How should this be split?</label>
      <div className="mt-2 grid grid-cols-3 gap-2">
        {MODES.map((m) => (
          <button
            key={m.value}
            type="button"
            onClick={() => onChange(m.value)}
            className={`border p-3 text-left transition ${
              value === m.value
                ? "border-accent-strong bg-accent/10 shadow-sm"
                : "border-foreground/20 hover:border-foreground/45"
            }`}
          >
            <span
              className={`block font-mono text-[13px] font-semibold ${
                value === m.value ? "text-accent-strong" : ""
              }`}
            >
              {m.label}
            </span>
            <span className="mt-1 block text-[11px] leading-snug text-stone-400">{m.hint}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
