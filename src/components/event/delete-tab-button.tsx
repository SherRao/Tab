"use client";

import { useState } from "react";
import { deleteEventAction } from "@/lib/actions";
import { ErrorNote } from "@/components/ui/error-note";

export default function DeleteTabButton({
  token,
  eventName,
}: {
  token: string;
  eventName: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (
      !window.confirm(
        `Are you sure you want to permanently delete "${eventName}"? This cannot be undone.`,
      )
    ) return;
    setDeleting(true);
    setError(null);
    try {
      await deleteEventAction(token);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not delete this tab.");
      setDeleting(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        disabled={deleting}
        onClick={handleDelete}
        className="btn-ghost px-4 py-2.5 text-sm text-red-600 border-red-600/40 hover:bg-red-600/5 disabled:cursor-not-allowed"
      >
        {deleting ? "Deleting…" : "Delete tab"}
      </button>
      {error && <ErrorNote variant="form" className="mt-2">{error}</ErrorNote>}
    </div>
  );
}
