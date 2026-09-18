"use client";

import type { ReactNode, Ref } from "react";
import { useScrollProgress } from "@/lib/use-scroll-progress";

type RevealProps = {
  children: ReactNode;
  as?: "div" | "li";
  className?: string;
  /**
   * Stagger against siblings, in the ms the old timer-based reveal used. It is
   * converted to a slice of the scroll window, so the offset scrubs with the
   * scroll rather than running on a clock.
   */
  delay?: number;
  variant?: "up" | "stamp";
};

/** ms of the old timer-based stagger that maps to the full scroll window. */
const STAGGER_SCALE = 1600;

export function Reveal({
  children,
  as = "div",
  className = "",
  delay = 0,
  variant = "up",
}: RevealProps) {
  const ref = useScrollProgress<HTMLElement>({
    mode: "enter",
    stagger: Math.min(delay / STAGGER_SCALE, 0.6),
  });

  const classes = ["reveal", variant === "stamp" ? "reveal-stamp" : "", className]
    .filter(Boolean)
    .join(" ");

  return as === "li" ? (
    <li ref={ref as Ref<HTMLLIElement>} className={classes}>
      {children}
    </li>
  ) : (
    <div ref={ref as Ref<HTMLDivElement>} className={classes}>
      {children}
    </div>
  );
}
