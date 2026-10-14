export function Watermark({
  position,
  size,
  sizeLg = "",
  center = false,
  children,
}: {
  position: string;
  size: string;
  sizeLg?: string;
  center?: boolean;
  children: React.ReactNode;
}) {
  // Keep each class a standalone string literal: Tailwind's scanner skips
  // classes glued to a `${` interpolation, which dropped the 6% ink colour.
  const className = [
    "pointer-events-none absolute -z-10 select-none",
    "font-mono font-bold leading-none tracking-tight text-foreground/[0.06]",
    center && "text-center",
    position,
    size,
    sizeLg,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <span aria-hidden className={className}>
      {children}
    </span>
  );
}
