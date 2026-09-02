import { Reveal } from "@/components/ui/reveal";
import type { CSSProperties } from "react";

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
    <div
      className={`receipt-card receipt-edge receipt-lined w-64 translate-y-0 p-5 pb-7 transition-transform duration-300 ease-out hover:-translate-y-1.5 hover:rotate-0 ${className}`}
    >
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

export function ReceiptStack() {
  return (
    <div className="relative hidden min-h-[520px] select-none lg:col-span-5 lg:block">
      <div className="rise-in absolute top-0 left-2" style={{ "--delay": "420ms" } as CSSProperties}>
        <div
          className="sway"
          style={{ "--sway-duration": "7s", "--sway-delay": "-2s" } as CSSProperties}
        >
          <MiniReceipt {...SAMPLE_RECEIPTS[0]} className="-rotate-6" />
        </div>
      </div>
      <div
        className="rise-in absolute top-36 right-0"
        style={{ "--delay": "540ms" } as CSSProperties}
      >
        <div
          className="sway"
          style={{ "--sway-duration": "9s", "--sway-delay": "-5s" } as CSSProperties}
        >
          <MiniReceipt {...SAMPLE_RECEIPTS[1]} className="rotate-3" />
        </div>
      </div>
      <div
        className="rise-in absolute top-72 left-8"
        style={{ "--delay": "660ms" } as CSSProperties}
      >
        <div
          className="sway"
          style={{ "--sway-duration": "8s", "--sway-delay": "-3.5s" } as CSSProperties}
        >
          <MiniReceipt {...SAMPLE_RECEIPTS[2]} className="rotate-[-2deg]" />
        </div>
      </div>
      <Reveal variant="stamp" delay={500} className="absolute right-6 bottom-2">
        <span className="stamp">settled ✓</span>
      </Reveal>
    </div>
  );
}
