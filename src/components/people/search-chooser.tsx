"use client";

import { useEffect, useRef, useState } from "react";
import { useAccountSearch, type AccountMatch } from "./use-account-search";

export type EntryChoice =
  | { mode: "account"; userId: number; label: string }
  | { mode: "guest"; name: string; email?: string; label: string }
  | { mode: "invite"; name: string; email: string; label: string };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function buildChoices(
  raw: string,
  matches: AccountMatch[],
  addedUserIds: Set<number>,
): EntryChoice[] {
  const text = raw.trim();
  if (!text) return [];
  const choices: EntryChoice[] = [];
  for (const m of matches) {
    choices.push({
      mode: "account",
      userId: m.id,
      label: `@${m.username} · ${m.displayName}${addedUserIds.has(m.id) ? " (already added)" : ""}`,
    });
  }
  // Detect "Name email@domain.com" pattern for guest-with-email
  const nameEmailMatch = text.match(/^(.+?)\s+([^\s@]+@[^\s@]+\.[^\s@]+)$/);
  if (nameEmailMatch) {
    const [, namePart, emailPart] = nameEmailMatch;
    const email = emailPart.toLowerCase();
    choices.push({
      mode: "guest",
      name: namePart.trim(),
      email,
      label: `Add "${namePart.trim()}" as guest (${email})`,
    });
  }

  // Bare email → invite mode
  if (EMAIL_RE.test(text)) {
    const [namePart, domain] = text.split("@");
    choices.push({
      mode: "invite",
      name: namePart.charAt(0).toUpperCase() + namePart.slice(1),
      email: `${namePart}@${domain}`.toLowerCase(),
      label: `Invite ${text} to sign up`,
    });
  }

  // Plain guest (always last)
  choices.push({ mode: "guest", name: text, label: `Add "${text}" without an account` });
  return choices;
}

/** Shared search input; onSelect receives an explicit, user-chosen entry. */
export function SearchChooser({
  addedUserIds,
  placeholder,
  inputLabel,
  onSelect,
}: {
  addedUserIds: Set<number>;
  placeholder: string;
  inputLabel: string;
  onSelect: (choice: EntryChoice) => void;
}) {
  const [raw, setRaw] = useState("");
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  const matches = useAccountSearch(raw, true);
  const choices = buildChoices(raw, matches, addedUserIds);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  return (
    <div ref={boxRef} className="relative">
      <input
        value={raw}
        onChange={(e) => {
          setRaw(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
        aria-label={inputLabel}
        className="input-ink w-full"
        autoComplete="off"
      />
      {open && raw.trim().length >= 2 && (
        <ul className="paper-card absolute z-20 mt-1 max-h-64 w-full overflow-auto p-1">
          {choices.map((c, i) => {
            const disabled = c.mode === "account" && addedUserIds.has(c.userId);
            return (
              <li key={`${c.mode}-${i}`}>
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => {
                    setOpen(false);
                    setRaw("");
                    onSelect(c);
                  }}
                  className={`block w-full px-3 py-2 text-left text-sm transition ${
                    disabled
                      ? "cursor-not-allowed text-stone-300"
                      : "hover:bg-paper hover:text-accent-strong"
                  }`}
                >
                  {c.mode === "account" ? (
                    <span className="font-medium">{c.label}</span>
                  ) : (
                    <span>{c.label}</span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
