import { Reveal } from "@/components/ui/reveal";

type Mark = "yes" | "partial" | "no";

const COLUMNS = ["Tab", "Splitwise", "Venmo groups", "A spreadsheet"];

/** One row per capability; marks line up with COLUMNS. */
const ROWS: Array<{ label: string; note: string; marks: Mark[] }> = [
  {
    label: "Split one receipt line by line",
    note: "Assign the churros to the person who ate the churros.",
    marks: ["yes", "partial", "no", "partial"],
  },
  {
    label: "Read a paper receipt from a photo",
    note: "Snap it and the lines, tax and tip come out filled in.",
    marks: ["yes", "partial", "no", "no"],
  },
  {
    label: "Receipt photos never leave your device",
    note: "Tab runs the OCR in your browser — nothing is uploaded.",
    marks: ["yes", "no", "no", "yes"],
  },
  {
    label: "Tax and tip follow what you ordered",
    note: "Allocated against each person's pre-tax subtotal, not split evenly.",
    marks: ["yes", "partial", "no", "partial"],
  },
  {
    label: "Nets down to the fewest transfers",
    note: "Four people and a pile of tangled IOUs come out as three payments.",
    marks: ["yes", "yes", "no", "no"],
  },
  {
    label: "Anyone with the link can watch the tab",
    note: "No account needed to see where the money landed.",
    marks: ["yes", "no", "no", "partial"],
  },
  {
    label: "No ads, no pro tier, no upsell",
    note: "There is nothing to upgrade to.",
    marks: ["yes", "no", "no", "yes"],
  },
];

const GLYPH: Record<Mark, string> = { yes: "✓", partial: "~", no: "—" };
const TONE: Record<Mark, string> = {
  yes: "text-accent-strong",
  partial: "text-stone-400",
  no: "text-stone-300",
};
const LABEL: Record<Mark, string> = { yes: "yes", partial: "partly", no: "no" };

export function Comparison() {
  return (
    <section id="compare" className="border-t border-foreground/10">
      <div className="mx-auto w-full max-w-6xl px-6 py-20">
        <Reveal>
          <p className="label-mono text-accent-strong">Versus the usual suspects</p>
          <h2 className="display mt-4 max-w-2xl text-4xl sm:text-5xl">
            Most apps split the bill. Tab splits the receipt.
          </h2>
          <p className="mt-5 max-w-xl leading-relaxed text-stone-600">
            Everything else starts from a total and divides it. Tab starts from the lines on the
            paper, which is where the arguing actually happens.
          </p>
        </Reveal>

        <Reveal>
          <p className="label-mono mt-10 hidden text-stone-400 max-lg:block">Swipe to compare →</p>
        </Reveal>

        <div className="mt-4 overflow-x-auto lg:mt-12">
          <div className="min-w-[46rem]">
            {/* column heads */}
            <Reveal>
              <div className="grid grid-cols-[1.7fr_repeat(4,1fr)] items-end gap-4 border-b border-foreground/15 pb-3">
                <span className="label-mono text-stone-400">Capability</span>
                {COLUMNS.map((name, i) => (
                  <span
                    key={name}
                    className={`label-mono text-center ${
                      i === 0 ? "text-accent-strong" : "text-stone-400"
                    }`}
                  >
                    {name}
                  </span>
                ))}
              </div>
            </Reveal>

            <ul className="divide-y divide-foreground/10">
              {ROWS.map((row, i) => (
                <Reveal key={row.label} as="li" delay={i * 70}>
                  <div className="grid grid-cols-[1.7fr_repeat(4,1fr)] items-stretch gap-4">
                    <div className="py-5">
                      <p className="font-medium">{row.label}</p>
                      <p className="mt-1 text-sm leading-relaxed text-stone-500">{row.note}</p>
                    </div>
                    {row.marks.map((mark, col) => (
                      <span
                        key={COLUMNS[col]}
                        // Tab's cells stretch the full row so its column reads
                        // as one continuous stripe rather than stacked blocks.
                        className={`flex items-center justify-center font-mono text-xl ${
                          TONE[mark]
                        } ${col === 0 ? "bg-accent/5" : ""}`}
                      >
                        <span aria-hidden="true">{GLYPH[mark]}</span>
                        <span className="sr-only">{`${COLUMNS[col]}: ${LABEL[mark]}`}</span>
                      </span>
                    ))}
                  </div>
                </Reveal>
              ))}
            </ul>
          </div>
        </div>

        <Reveal delay={200}>
          <p className="label-mono mt-6 text-stone-400">
            ~ means it&apos;s possible but awkward, or behind a paid tier. Compared Sep 2026.
          </p>
        </Reveal>
      </div>
    </section>
  );
}
