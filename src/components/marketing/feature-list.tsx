import { Reveal } from "@/components/ui/reveal";

function FeatureRow({ num, title, copy }: { num: string; title: string; copy: string }) {
  return (
    <div className="group grid gap-3 py-8 sm:grid-cols-12 sm:items-baseline">
      <span className="label-mono text-stone-400 transition group-hover:text-accent sm:col-span-1">
        {num}
      </span>
      <h3 className="text-2xl font-semibold tracking-tight sm:col-span-4">{title}</h3>
      <p className="max-w-md leading-relaxed text-stone-600 sm:col-span-7">{copy}</p>
    </div>
  );
}

export function FeatureList() {
  return (
    <section className="border-t border-foreground/10 bg-paper/60">
      <div className="mx-auto w-full max-w-6xl px-6 py-20">
        <Reveal>
          <h2 className="display text-4xl sm:text-5xl">Built for the group chat</h2>
        </Reveal>
        <ul className="mt-12 divide-y divide-foreground/10 border-y border-foreground/10">
          <Reveal as="li">
            <FeatureRow
              num="01"
              title="Itemized to the line"
              copy="Every taco, every Uber, every round of drinks — assign line items to the people who actually had them."
            />
          </Reveal>
          <Reveal as="li" delay={120}>
            <FeatureRow
              num="02"
              title="Scan, don't type"
              copy="Photograph the paper receipt and Tab reads the lines, tax and tip right on your device. Nothing leaves your phone."
            />
          </Reveal>
          <Reveal as="li" delay={240}>
            <FeatureRow
              num="03"
              title="Fewest payments possible"
              copy="Tab nets everything out and suggests the minimum set of transfers so settling up takes minutes, not math."
            />
          </Reveal>
        </ul>
      </div>
    </section>
  );
}
