"use client";

import { deleteEventAction } from "@/lib/actions";

export default function DeleteTabButton({
  token,
  eventName,
}: {
  token: string;
  eventName: string;
}) {
  return (
    <button
      type="button"
      onClick={() => {
        if (
          window.confirm(
            `Are you sure you want to permanently delete "${eventName}"? This cannot be undone.`,
          )
        ) {
          void deleteEventAction(token);
        }
      }}
      className="btn-ghost px-4 py-2.5 text-sm text-red-600 border-red-600/40 hover:bg-red-600/5"
    >
      Delete tab
    </button>
  );
}
