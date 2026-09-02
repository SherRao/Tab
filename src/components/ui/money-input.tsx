"use client";

export function MoneyInput({
  value,
  onChange,
  wrapperClassName = "relative mt-1.5",
  dollarAt = "left-3.5",
  className = "",
  ariaLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  wrapperClassName?: string;
  dollarAt?: string;
  className?: string;
  ariaLabel?: string;
}) {
  return (
    <div className={wrapperClassName}>
      <span
        className={`pointer-events-none absolute top-1/2 ${dollarAt} -translate-y-1/2 font-mono text-stone-400`}
      >
        $
      </span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="0.00"
        inputMode="decimal"
        aria-label={ariaLabel}
        className={`input-ink pl-7 text-right font-mono tabular-nums ${className}`.trim()}
      />
    </div>
  );
}
