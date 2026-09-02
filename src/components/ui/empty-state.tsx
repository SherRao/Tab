import Link from "next/link";

/**
 * Dashed-border empty box. `message` is the bold line; optional action renders
 * the "label-mono mt-2 inline-block text-accent-strong hover:underline" link.
 */
export function EmptyState({
  message,
  action,
}: {
  message: string;
  action?: { href: string; label: string };
}) {
  return (
    <div className="mt-4 border border-dashed border-foreground/25 p-10 text-center">
      <p className="font-medium text-stone-500">{message}</p>
      {action && (
        <Link
          href={action.href}
          className="label-mono mt-2 inline-block text-accent-strong hover:underline"
        >
          {action.label}
        </Link>
      )}
    </div>
  );
}
