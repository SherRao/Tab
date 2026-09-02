import Link from "next/link";
import CopyLinkButton from "@/components/ui/copy-link-button";
import DeleteTabButton from "@/components/event/delete-tab-button";
import { formatCents } from "@/lib/format";

export function EventHeader({
  token,
  eventName,
  isOwner,
  viewerSignedIn,
  receiptCount,
  grandTotalCents,
}: {
  token: string;
  eventName: string;
  isOwner: boolean;
  viewerSignedIn: boolean;
  receiptCount: number;
  grandTotalCents: number;
}) {
  return (
    <header>
      <div className="flex justify-end">
        <Link href={`/e/${token}/expenses/new`} className="btn-ink px-4 py-2.5">
          + Add expense
        </Link>
      </div>
      <h1 className="display mt-4 text-5xl sm:text-6xl">{eventName}</h1>

      {/* share strip */}
      <div className="mt-6 flex flex-wrap items-center gap-x-3 gap-y-2 border-y border-dashed border-foreground/25 py-2.5">
        <span className="label-mono text-stone-400">Share</span>
        <code className="min-w-0 flex-1 truncate font-mono text-sm text-stone-600">
          /e/{token}
        </code>
        <CopyLinkButton path={`/e/${token}`} />
      </div>

      {isOwner && (
        <div className="mt-3">
          <DeleteTabButton token={token} eventName={eventName} />
        </div>
      )}

      {!viewerSignedIn && (
        <p className="paper-card mt-4 flex flex-wrap items-center justify-between gap-2 p-3 font-mono text-xs text-stone-500">
          <span>You&apos;re viewing read-only.</span>
          <Link
            href={`/signin?next=${encodeURIComponent(`/e/${token}`)}`}
            className="label-mono text-accent-strong hover:underline"
          >
            Sign in to edit →
          </Link>
        </p>
      )}

      {receiptCount > 0 && (
        <div className="mt-4 flex items-baseline justify-between font-mono text-sm tabular-nums">
          <span className="label-mono text-stone-400">
            {receiptCount} receipt{receiptCount > 1 ? "s" : ""} on file
          </span>
          <span className="font-semibold">{formatCents(grandTotalCents)}</span>
        </div>
      )}
    </header>
  );
}
