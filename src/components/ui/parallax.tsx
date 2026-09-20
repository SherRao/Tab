"use client";

import type { CSSProperties, ReactNode } from "react";
import { useScrollProgress } from "@/lib/use-scroll-progress";

/**
 * Drifts its children vertically as the section scrolls past. `distance` is the
 * total travel in px across the whole passage: negative drifts the layer upward
 * (it outruns the scroll and reads as nearer), positive holds it back.
 */
export function Parallax({
  distance,
  className = "",
  children,
}: {
  distance: number;
  className?: string;
  children: ReactNode;
}) {
  const ref = useScrollProgress<HTMLDivElement>({ mode: "through" });

  return (
    <div
      ref={ref}
      className={`parallax ${className}`}
      style={{ "--parallax": `${distance}px` } as CSSProperties}
    >
      {children}
    </div>
  );
}
