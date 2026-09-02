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
  return (
    <span
      aria-hidden
      className={`pointer-events-none absolute ${position} -z-10 select-none${
        center ? " text-center" : ""
      } font-mono ${size} font-bold leading-none tracking-tight text-foreground/[0.06]${
        sizeLg ? ` ${sizeLg}` : ""
      }`}
    >
      {children}
    </span>
  );
}
