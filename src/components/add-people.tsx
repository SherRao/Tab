"use client";

import { useEffect, useRef, useState } from "react";

interface AccountMatch {
  id: number;
  username: string;
  displayName: string;
  email: string;
}

export type EntryChoice =
  | { mode: "account"; userId: number; label: string }
  | { mode: "guest"; name: string; label: string }
  | { mode: "invite"; name: string; email: string; label: string };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function useAccountSearch(query: string, enabled: boolean) {
  const [matches, setMatches] = useState<AccountMatch[]>([]);
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      if (!enabled || query.trim().length < 2) {
        setMatches([]);
        return;
      }
      try {
        const res = await fetch(`/api/accounts/search?q=${encodeURIComponent(query.trim())}`, {
          signal: controller.signal,
        });
        if (!res.ok) throw new Error("search failed");
        const data = (await res.json()) as { accounts: AccountMatch[] };
        setMatches(data.accounts);
      } catch {
        /* aborted or offline */
      }
    }, 150);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, enabled]);
  return matches;
}

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
  if (EMAIL_RE.test(text)) {
    const [namePart, domain] = text.split("@");
    choices.push({
      mode: "invite",
      name: namePart.charAt(0).toUpperCase() + namePart.slice(1),
      email: `${namePart}@${domain}`.toLowerCase(),
      label: `Invite ${text} to sign up`,
    });
  }
  choices.push({ mode: "guest", name: text, label: `Add “${text}” without an account` });
  return choices;
}

/** Shared search input; onSelect receives an explicit, user-chosen entry. */
function SearchChooser({
  addedUserIds,
  placeholder,
  onSelect,
}: {
  addedUserIds: Set<number>;
  placeholder: string;
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

const MODE_BADGE: Record<EntryChoice["mode"], string> = {
  account: "account",
  guest: "no account",
  invite: "invited",
};

/** Landing page: collect multiple entries into a participantsJson payload. */
export function CreateEventPeopleInput() {
  const [entries, setEntries] = useState<EntryChoice[]>([]);
  const addedUserIds = new Set(entries.map((e) => (e.mode === "account" ? e.userId : -1)));

  function addEntry(choice: EntryChoice) {
    if (choice.mode === "account" && addedUserIds.has(choice.userId)) return;
    setEntries((prev) => [...prev, choice]);
  }

  return (
    <>
      <input type="hidden" name="participantsJson" value={JSON.stringify(entries)} />
      <div className="mt-1.5">
        <SearchChooser
          addedUserIds={addedUserIds}
          placeholder="@username, email, or just a name…"
          onSelect={addEntry}
        />
      </div>
      {entries.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {entries.map((e, i) => (
            <li key={i}>
              <span className="label-mono inline-flex items-center gap-2 border border-foreground/25 px-2 py-1">
                {e.label.replace(/ \(already added\)$/, "")}
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
      {entries.length < 2 && (
        <p className="label-mono mt-2 text-stone-400">add at least two people</p>
      )}
    </>
  );
}

/** Event page: one explicit pick submits straight to the server action. */
export function AddSomeoneControl({
  token,
  addedUserIds,
  addAction,
}: {
  token: string;
  addedUserIds: number[];
  addAction: (formData: FormData) => void | Promise<void>;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const entryRef = useRef<HTMLInputElement>(null);
  const added = new Set(addedUserIds);

  return (
    <form ref={formRef} action={addAction} className="mt-3">
      <input type="hidden" name="token" value={token} />
      <input type="hidden" name="entry" ref={entryRef} />
      <SearchChooser
        addedUserIds={added}
        placeholder="+ Add someone — @username, email, or a name"
        onSelect={(choice) => {
          entryRef.current!.value = JSON.stringify(choice);
          formRef.current!.requestSubmit();
        }}
      />
    </form>
  );
}
