export function UnassignedWarnings({ warnings }: { warnings: string[] }) {
  if (warnings.length === 0) return null;

  return (
    <div className="paper-card mt-8 space-y-1 border-l-4 border-l-amber-400 p-4 font-mono text-xs leading-relaxed text-amber-800">
      {warnings.map((w) => (
        <p key={w}>! {w}</p>
      ))}
    </div>
  );
}
