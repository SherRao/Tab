import Link from "next/link";
import { Reveal } from "@/components/ui/reveal";

const STEPS: Array<[string, string]> = [
  ["Name the event", "Trips, dinners, birthdays — anything with a shared bill."],
  [
    "Share one link",
    "Anyone with the link can watch the tab; friends sign in with a magic link to add their share.",
  ],
  ["Settle up", "Watch balances zero out as receipts pile up."],
];

export function HowItWorks() {
  return (
    <section id="how" className="mx-auto w-full max-w-6xl px-6 py-20">
      <Reveal>
        <h2 className="display text-4xl sm:text-5xl">How it works</h2>
      </Reveal>
      <ol className="mt-12 grid gap-10 md:grid-cols-3">
        {STEPS.map(([title, copy], i) => (
          <Reveal key={title} as="li" delay={i * 120}>
            <p className="font-mono text-5xl font-bold tracking-tight text-accent">
              {String(i + 1).padStart(2, "0")}
            </p>
            <h3 className="mt-4 text-xl font-semibold">{title}</h3>
            <p className="mt-2 leading-relaxed text-stone-600">{copy}</p>
          </Reveal>
        ))}
      </ol>
      <Reveal delay={360}>
        <Link
          href="/create"
          className="label-mono mt-14 inline-block text-accent-strong transition hover:underline"
        >
          Start a tab — it&apos;s free →
        </Link>
      </Reveal>
    </section>
  );
}
