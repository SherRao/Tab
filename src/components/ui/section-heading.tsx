export function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="label-mono border-b border-foreground/15 pb-2 text-stone-400">
      {children}
    </h2>
  );
}
