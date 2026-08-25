import { createEventAction } from "@/lib/actions";
import { getSessionUser } from "@/lib/auth";
import { CreateEventPeopleInput } from "@/components/add-people";
import Link from "next/link";

const SAMPLE_RECEIPTS = [
  {
    title: "Taqueria El Sol",
    date: "FRI 21 AUG",
    items: [
      ["Tacos al pastor x3", "13.50"],
      ["Agua fresca", "3.00"],
    ],
    tax: "1.24",
    total: "17.74",
  },
  {
    title: "Beach house groceries",
    date: "SAT 22 AUG",
    items: [
      ["Ice", "4.99"],
      ["Limes (bag)", "6.40"],
      ["Tortillas", "3.29"],
    ],
    tax: "0.98",
    total: "15.66",
  },
  {
    title: "Uber to the venue",
    date: "SAT 22 AUG",
    items: [["Ride, split 4 ways", "22.00"]],
    total: "22.00",
  },
];

function MiniReceipt({
  title,
  date,
  items,
  total,
  className,
}: {
  title: string;
  date: string;
  items: string[][];
  total: string;
  className?: string;
}) {
  return (
    <div className={`receipt-card receipt-edge receipt-lined w-64 p-5 pb-7 ${className}`}>
      <p className="label-mono text-center text-stone-500">{title}</p>
      <p className="label-mono mt-1 text-center text-stone-400">{date}</p>
      <div className="rule-dashed mt-3" />
      <ul className="mt-2 space-y-1.5 font-mono text-[11px] tabular-nums">
        {items.map(([name, price]) => (
          <li key={name} className="flex gap-2">
            <span className="truncate">{name}</span>
            <span className="leader-dots" />
            <span>{price}</span>
          </li>
        ))}
      </ul>
      <div className="rule-dashed mt-2" />
      <div className="mt-2 flex items-baseline justify-between font-mono text-sm font-semibold tabular-nums">
        <span>TOTAL</span>
        <span>${total}</span>
      </div>
    </div>
  );
}

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const viewer = await getSessionUser();
  return (
    <main className="flex-1">
      {/* header */}
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-6">
        <Link href="/" className="flex items-baseline gap-2">
          <span className="font-mono text-lg font-bold tracking-tight">tab.</span>
          <span className="label-mono hidden text-stone-400 sm:inline">expense ledger</span>
        </Link>
        <nav className="flex items-center gap-5">
          <a href="#how" className="label-mono text-stone-500 transition hover:text-foreground">
            How it works ↓
          </a>
          {viewer ? (
            <Link href="/tabs" className="label-mono text-accent-strong transition hover:underline">
              My tabs
            </Link>
          ) : (
            <Link
              href="/signin"
              className="label-mono text-accent-strong transition hover:underline"
            >
              Sign in
            </Link>
          )}
        </nav>
      </header>

      {/* hero */}
      <section className="mx-auto grid w-full max-w-6xl gap-12 px-6 pt-10 pb-20 lg:grid-cols-12 lg:gap-8 lg:pt-16">
        <div className="lg:col-span-7">
          <p className="label-mono text-accent-strong">Receipts in — balances out.</p>
          <h1 className="display mt-5 text-6xl sm:text-7xl lg:text-8xl">
            Split the bill.
            <br />
            Keep the receipts<span className="text-accent">.</span>
          </h1>
          <p className="mt-6 max-w-md text-lg leading-relaxed text-stone-600">
            Add an itemized receipt — or snap a photo of one — tag who got what, and Tab works out
            exactly who owes whom. No passwords, no spreadsheets, no &ldquo;wait, what do I owe you
            again?&rdquo;
          </p>

          {/* create-event form */}
          <form action={createEventAction} className="paper-card mt-10 max-w-lg p-6" id="start">
            {viewer ? (
              <>
                <div>
                  <label htmlFor="name" className="label-mono block text-stone-500">
                    Event name
                  </label>
                  <input
                    id="name"
                    name="name"
                    required
                    placeholder="Vegas trip…"
                    className="input-ink mt-1.5"
                  />
                </div>
                <div className="mt-4">
                  <span className="label-mono block text-stone-500">
                    Who&apos;s in?{" "}
                    <span className="text-stone-300">(@username · email invite · plain name)</span>
                  </span>
                  <CreateEventPeopleInput />
                </div>
                {error && (
                  <p className="mt-4 border border-red-200 bg-red-50 px-3 py-2 font-mono text-xs text-red-700">
                    Please provide a name and at least two participants.
                  </p>
                )}
                <button type="submit" className="btn-ink mt-5 w-full">
                  Start a new tab &rarr;
                </button>
              </>
            ) : (
              <div className="py-2 text-center">
                <p className="font-medium">Sign in to start a tab</p>
                <p className="mt-2 font-mono text-xs leading-relaxed text-stone-500">
                  Magic link, no password. You&apos;ll get a shareable link anyone can view.
                </p>
                <Link
                  href={`/signin?next=${encodeURIComponent("/#start")}`}
                  className="btn-ink mt-4 inline-flex w-full justify-center"
                >
                  Sign in &rarr;
                </Link>
              </div>
            )}
          </form>
        </div>

        {/* stacked receipts */}
        <div className="relative hidden min-h-[520px] select-none lg:col-span-5 lg:block">
          <MiniReceipt {...SAMPLE_RECEIPTS[0]} className="absolute top-0 left-2 -rotate-6" />
          <MiniReceipt {...SAMPLE_RECEIPTS[1]} className="absolute top-36 right-0 rotate-3" />
          <MiniReceipt {...SAMPLE_RECEIPTS[2]} className="absolute top-72 left-8 rotate-[-2deg]" />
          <span className="stamp absolute right-6 bottom-2">settled ✓</span>
        </div>
      </section>

      {/* features */}
      <section className="border-t border-foreground/10 bg-paper/60">
        <div className="mx-auto w-full max-w-6xl px-6 py-20">
          <h2 className="display text-4xl sm:text-5xl">Built for the group chat</h2>
          <ul className="mt-12 divide-y divide-foreground/10 border-y border-foreground/10">
            <FeatureRow
              num="01"
              title="Itemized to the line"
              copy="Every taco, every Uber, every round of drinks — assign line items to the people who actually had them."
            />
            <FeatureRow
              num="02"
              title="Scan, don't type"
              copy="Photograph the paper receipt and Tab reads the lines, tax and tip right on your device. Nothing leaves your phone."
            />
            <FeatureRow
              num="03"
              title="Fewest payments possible"
              copy="Tab nets everything out and suggests the minimum set of transfers so settling up takes minutes, not math."
            />
          </ul>
        </div>
      </section>

      {/* how it works */}
      <section id="how" className="mx-auto w-full max-w-6xl px-6 py-20">
        <h2 className="display text-4xl sm:text-5xl">How it works</h2>
        <ol className="mt-12 grid gap-10 md:grid-cols-3">
          {[
            ["Name the event", "Trips, dinners, birthdays — anything with a shared bill."],
            [
              "Share one link",
              "Anyone with the link can watch the tab; friends sign in with a magic link to add their share.",
            ],
            ["Settle up", "Watch balances zero out as receipts pile up."],
          ].map(([title, copy], i) => (
            <li key={title}>
              <p className="font-mono text-5xl font-bold tracking-tight text-accent">
                {String(i + 1).padStart(2, "0")}
              </p>
              <h3 className="mt-4 text-xl font-semibold">{title}</h3>
              <p className="mt-2 leading-relaxed text-stone-600">{copy}</p>
            </li>
          ))}
        </ol>
        <a href="#start" className="btn-ink mt-14 inline-flex">
          Start a tab — it&apos;s free
        </a>
      </section>

      <footer className="border-t border-foreground/10">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-2 px-6 py-8">
          <span className="font-mono text-sm font-bold tracking-tight">tab.</span>
          <p className="label-mono text-stone-400">Split expenses, not friendships</p>
        </div>
      </footer>
    </main>
  );
}

function FeatureRow({ num, title, copy }: { num: string; title: string; copy: string }) {
  return (
    <li className="group grid gap-3 py-8 sm:grid-cols-12 sm:items-baseline">
      <span className="label-mono text-stone-400 transition group-hover:text-accent sm:col-span-1">
        {num}
      </span>
      <h3 className="text-2xl font-semibold tracking-tight sm:col-span-4">{title}</h3>
      <p className="max-w-md leading-relaxed text-stone-600 sm:col-span-7">{copy}</p>
    </li>
  );
}
