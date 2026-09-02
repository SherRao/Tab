"use client";

import { useState, useEffect } from "react";
import { SearchChooser, type EntryChoice } from "./search-chooser";

const MODE_BADGE: Record<EntryChoice["mode"], string> = {
  account: "account",
  guest: "no account",
  invite: "invited",
};

/** Landing page: collect multiple entries into a participantsJson payload. */
export function CreateEventPeopleInput({
  onChange,
}: {
  onChange?: (count: number) => void;
}) {
  const [entries, setEntries] = useState<EntryChoice[]>([]);
  const addedUserIds = new Set(entries.map((e) => (e.mode === "account" ? e.userId : -1)));

  useEffect(() => {
    onChange?.(entries.length);
  }, [entries, onChange]);

  function addEntry(choice: EntryChoice) {
    if (choice.mode === "account" && addedUserIds.has(choice.userId)) return;
    setEntries((prev) => {
      const next = [...prev, choice];
      return next;
    });
  }

  return (
    <>
      <input type="hidden" name="participantsJson" value={JSON.stringify(entries)} />
      <div className="mt-1.5">
        <SearchChooser
          addedUserIds={addedUserIds}
          placeholder="@username, email, or just a name…"
          inputLabel="Add people by username, email, or name"
          onSelect={addEntry}
        />
      </div>
      {entries.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {entries.map((e, i) => (
            <li key={i}>
              <span className="label-mono inline-flex items-center gap-2 border border-foreground/25 px-2 py-1">
                {e.mode === "guest" && e.email
                  ? `${e.name} (${e.email})`
                  : e.label.replace(/ \(already added\)$/, "")}
                <span className="text-stone-400">{MODE_BADGE[e.mode]}</span>
                <button
                  type="button"
                  aria-label="Remove"
                  onClick={() => setEntries((prev) => prev.filter((_, j) => j !== i))}
                  className="text-stone-400 transition hover:text-red-600"
                >
                  ×
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
      {entries.length < 1 && (
        <p className="label-mono mt-2 text-stone-400">add one other person</p>
      )}
    </>
  );
}
