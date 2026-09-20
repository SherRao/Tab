"use client";

import { useState, type CSSProperties } from "react";
import { formatCents } from "@/lib/format";
import {
  computeNetBalances,
  simplifyDebts,
  type LedgerExpense,
  type LedgerParticipant,
} from "@/lib/ledger";
import { useScrollProgress } from "@/lib/use-scroll-progress";

/* ---- the worked example ------------------------------------------------ */

const PEOPLE: LedgerParticipant[] = [
  { id: 1, name: "Maya" },
  { id: 2, name: "Dev" },
  { id: 3, name: "Sam" },
  { id: 4, name: "Ari" },
];

const DINNER_ITEMS = [
  { id: 1, name: "Tacos al pastor ×3", amountCents: 1350, participantIds: [2, 3] },
  { id: 2, name: "Ceviche", amountCents: 1800, participantIds: [1, 4] },
  { id: 3, name: "Margarita pitcher", amountCents: 3200, participantIds: [1, 2, 3, 4] },
  { id: 4, name: "Churros", amountCents: 900, participantIds: [3] },
];

const DINNER_TAX = 620;
const DINNER_TIP = 1400;
const DINNER_SUBTOTAL = DINNER_ITEMS.reduce((a, b) => a + b.amountCents, 0);
const DINNER_TOTAL = DINNER_SUBTOTAL + DINNER_TAX + DINNER_TIP;

const EXPENSES: LedgerExpense[] = [
  {
    id: 1,
    payerId: 1,
    description: "Taqueria El Sol",
    splitMode: "itemized",
    taxCents: DINNER_TAX,
    tipCents: DINNER_TIP,
    totalCents: DINNER_TOTAL,
    lineItems: DINNER_ITEMS,
  },
  {
    id: 2,
    payerId: 2,
    description: "Uber home",
    splitMode: "even",
    taxCents: 0,
    tipCents: 0,
    totalCents: 2400,
    lineItems: [],
  },
  {
    id: 3,
    payerId: 3,
    description: "Beach house groceries",
    splitMode: "even",
    taxCents: 0,
    tipCents: 0,
    totalCents: 5240,
    lineItems: [],
  },
];

// The real ledger, run at module load — these are not mocked numbers.
const NETS = computeNetBalances(PEOPLE, EXPENSES);
const TRANSFERS = simplifyDebts(NETS);
const PEAK_NET = Math.max(...PEOPLE.map((p) => Math.abs(NETS.get(p.id) ?? 0)), 1);

const nameOf = (id: number) => PEOPLE.find((p) => p.id === id)?.name ?? "";

const NUMBER_WORDS = ["Zero", "One", "Two", "Three", "Four", "Five", "Six"];
/** Spelled out for the headline, read off the real result so the copy can't drift. */
const countWord = (n: number) => NUMBER_WORDS[n] ?? String(n);

/* ---- scroll choreography ----------------------------------------------- */

/**
 * The pinned panel is scrubbed through `BEATS` discrete steps. Elements key off
 * `beat >= n` and let CSS transitions do the smoothing, so a fast scroll skips
 * ahead cleanly instead of queueing up animations.
 */
const BEATS = 12;
const FIRST_ITEM = 1; // beats 1–4 lay the line items down
const FIRST_CHIP = 5; // beats 5–8 assign each item to people
const TOTALS = 9;
const BALANCES = 10;
const SETTLED = 11;

const CHAPTERS: Array<[string, string]> = [
  ["Itemize", "Type the receipt in, or scan it."],
  ["Assign", "Tag who actually had each line."],
  ["Net out", "Tax and tip follow what you ate."],
  ["Settle", "The fewest payments that clear it."],
];

function chapterOf(beat: number): number {
  if (beat < FIRST_CHIP) return 0;
  if (beat < TOTALS) return 1;
  if (beat < SETTLED) return 2;
  return 3;
}

export function LedgerDemo() {
  const [beat, setBeat] = useState(0);
  const trackRef = useScrollProgress<HTMLDivElement>({
    mode: "pin",
    onProgress: (p) => setBeat(Math.min(BEATS - 1, Math.floor(p * BEATS))),
  });

  const chapter = chapterOf(beat);

  return (
    <section className="border-t border-foreground/10 bg-paper/40">
      {/* Below lg the panel is too tall to pin, so the track collapses and the
          whole walkthrough renders at once as a plain stacked section. */}
      <div ref={trackRef} className="relative lg:h-[420vh]">
        <div className="flex items-center py-20 lg:sticky lg:top-0 lg:h-screen lg:overflow-hidden lg:py-0">
          <div className="mx-auto grid w-full max-w-6xl gap-10 px-6 lg:grid-cols-12 lg:gap-12">
            <Narrative chapter={chapter} />
            <div className="grid gap-6 sm:grid-cols-2 lg:col-span-7">
              <DemoReceipt beat={beat} />
              <Outcome beat={beat} />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Narrative({ chapter }: { chapter: number }) {
  return (
    <div className="lg:col-span-5">
      <p className="label-mono text-accent-strong">Watch it work</p>
      <h2 className="display mt-4 text-4xl sm:text-5xl">
        {countWord(PEOPLE.length)} people.
        <br />
        {countWord(TRANSFERS.length)} payments.
      </h2>
      <p className="mt-5 max-w-sm leading-relaxed text-stone-600">
        A real receipt, run through the same ledger the app uses. Nothing here is a mock-up.
      </p>
      <ol className="mt-8 space-y-1">
        {CHAPTERS.map(([title, copy], i) => (
          <li
            key={title}
            className={`chapter grid grid-cols-[2rem_1fr] gap-x-3 py-2 ${
              i === chapter ? "is-active" : ""
            }`}
          >
            <span className="label-mono pt-1 text-stone-400">{String(i + 1).padStart(2, "0")}</span>
            <div>
              <p className="font-semibold">{title}</p>
              <p className="text-sm leading-relaxed text-stone-600">{copy}</p>
            </div>
          </li>
        ))}
      </ol>
      <p className="label-mono mt-8 hidden text-stone-400 lg:block">Keep scrolling ↓</p>
    </div>
  );
}

function DemoReceipt({ beat }: { beat: number }) {
  return (
    <div className="receipt-card receipt-edge receipt-lined self-start p-6 pb-8">
      <p className="label-mono text-center text-stone-500">Taqueria El Sol</p>
      <p className="label-mono mt-1 text-center text-stone-400">Maya paid</p>
      <div className="rule-dashed mt-4" />

      <ul className="mt-3 space-y-3 font-mono text-xs tabular-nums">
        {DINNER_ITEMS.map((item, i) => (
          <li key={item.id} className={`step ${beat >= FIRST_ITEM + i ? "is-in" : ""}`}>
            <div className="flex gap-2">
              <span className="truncate">{item.name}</span>
              <span className="leader-dots" />
              <span>{formatCents(item.amountCents)}</span>
            </div>
            <div
              className={`step mt-1.5 flex flex-wrap gap-1 ${
                beat >= FIRST_CHIP + i ? "is-in" : ""
              }`}
            >
              {item.participantIds.map((id) => (
                <span
                  key={id}
                  className="border border-accent/40 bg-accent/5 px-1.5 py-0.5 text-[10px] tracking-wide text-accent-strong"
                >
                  {nameOf(id)}
                </span>
              ))}
            </div>
          </li>
        ))}
      </ul>

      <div className={`step ${beat >= TOTALS ? "is-in" : ""}`}>
        <div className="rule-dashed mt-4" />
        <dl className="mt-3 space-y-1 font-mono text-xs tabular-nums text-stone-500">
          <Row label="Tax" value={DINNER_TAX} />
          <Row label="Tip" value={DINNER_TIP} />
        </dl>
        <div className="mt-2 flex items-baseline justify-between font-mono text-sm font-semibold tabular-nums">
          <span>TOTAL</span>
          <span>{formatCents(DINNER_TOTAL)}</span>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex justify-between">
      <dt>{label}</dt>
      <dd>{formatCents(value)}</dd>
    </div>
  );
}

function Outcome({ beat }: { beat: number }) {
  const settled = beat >= SETTLED;

  return (
    <div className={`step self-start ${beat >= BALANCES ? "is-in" : ""}`}>
      <div className="paper-card p-6">
        <p className="label-mono text-stone-500">
          {/* Below lg both lists are shown at once, so each gets its own
              heading instead and the card header only counts the receipts. */}
          <span className="hidden lg:inline">{settled ? "Settle up" : "Net balances"} · </span>
          <span className="text-stone-400">across {EXPENSES.length} receipts</span>
        </p>

        {/* balances and transfers stack in one cell and cross-fade */}
        <div className="mt-5 grid">
          <div className={`swap ${settled ? "is-out" : ""}`}>
            <p className="label-mono mb-3 hidden text-stone-400 max-lg:block">Net balances</p>
            <ul className="space-y-3">
              {PEOPLE.map((person) => {
                const net = NETS.get(person.id) ?? 0;
                return (
                  <li key={person.id}>
                    <div className="flex items-baseline justify-between text-sm">
                      <span className="font-medium">{person.name}</span>
                      <span
                        className={`font-mono tabular-nums ${
                          net > 0
                            ? "text-accent-strong"
                            : net < 0
                              ? "text-orange-600"
                              : "text-stone-400"
                        }`}
                      >
                        {net > 0 ? "+" : ""}
                        {formatCents(net)}
                      </span>
                    </div>
                    <div className="mt-1.5 h-1.5 bg-stone-200">
                      {/* Width lives in CSS off `--fill`, because the unpinned
                          mobile layout never advances `beat` far enough to
                          fill the bar from here. */}
                      <div
                        className={`bar-fill h-full ${net > 0 ? "bg-accent" : "bg-orange-500"}`}
                        data-filled={beat >= BALANCES}
                        style={
                          { "--fill": `${(Math.abs(net) / PEAK_NET) * 100}%` } as CSSProperties
                        }
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>

          {/* transfers */}
          <div className={`swap-in ${settled ? "is-in" : ""}`}>
            <p className="label-mono mb-3 hidden text-stone-400 max-lg:block">Settle up</p>
            <ul className="space-y-2">
              {TRANSFERS.map((t) => (
                <li
                  key={`${t.fromId}-${t.toId}`}
                  className="flex items-baseline justify-between border-b border-dashed border-foreground/15 pb-2 text-sm"
                >
                  <span>
                    <span className="font-medium">{nameOf(t.fromId)}</span>
                    <span className="mx-2 font-mono text-accent">→</span>
                    <span className="font-medium">{nameOf(t.toId)}</span>
                  </span>
                  <span className="border border-accent-strong/60 px-2 py-0.5 font-mono text-sm font-semibold tabular-nums text-accent-strong">
                    {formatCents(t.amountCents)}
                  </span>
                </li>
              ))}
              <li className="pt-3 text-right">
                <span className={`stamp ${settled ? "stamp-pop" : ""}`}>settled ✓</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
