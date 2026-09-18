"use client";

import { useEffect, useRef, type RefObject } from "react";

export type ProgressMode =
  /** 0 as the element's top reaches the viewport bottom, 1 once it has fully passed the top. */
  | "through"
  /** 0 as the top edge enters, 1 once it has risen a third of the viewport. For reveals. */
  | "enter"
  /** For a tall track holding a sticky child: 0 at the top of the track, 1 at the end of its travel. */
  | "pin";

type Options = {
  mode?: ProgressMode;
  /**
   * Hold at 0 until the raw progress passes this fraction, then rescale to
   * 0..1. Staggers siblings without timers, so it stays tied to the scrub.
   */
  stagger?: number;
  /** Called with the staggered progress on every frame it changes. */
  onProgress?: (p: number) => void;
};

/**
 * Writes a `--p` custom property (0..1) on the returned element every frame it
 * changes, so animation can live in CSS instead of re-rendering React. Driven
 * by native scroll events, which Lenis also emits as it scrolls the window.
 */
export function useScrollProgress<T extends HTMLElement>({
  mode = "through",
  stagger = 0,
  onProgress,
}: Options = {}): RefObject<T | null> {
  const ref = useRef<T | null>(null);
  const callback = useRef(onProgress);
  useEffect(() => {
    callback.current = onProgress;
  }, [onProgress]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    let frame = 0;
    let previous = -1;

    const measure = () => {
      frame = 0;
      const rect = el.getBoundingClientRect();
      const vh = window.innerHeight || 1;

      let raw: number;
      if (mode === "pin") {
        const travel = rect.height - vh;
        raw = travel <= 0 ? (rect.top <= 0 ? 1 : 0) : -rect.top / travel;
      } else if (mode === "enter") {
        raw = (vh - rect.top) / (vh * 0.35);
      } else {
        raw = (vh - rect.top) / (vh + rect.height);
      }

      const span = 1 - stagger;
      const p = clamp01(span <= 0 ? raw : (raw - stagger) / span);
      if (Math.abs(p - previous) < 0.0005) return;
      previous = p;
      el.style.setProperty("--p", p.toFixed(4));
      callback.current?.(p);
    };

    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };

    measure();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    const observer = new ResizeObserver(schedule);
    observer.observe(el);

    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      observer.disconnect();
    };
  }, [mode, stagger]);

  return ref;
}

export function clamp01(n: number): number {
  return n < 0 ? 0 : n > 1 ? 1 : n;
}

/** Rescale `p` so that it runs 0..1 across the [from, to] slice of the scrub. */
export function segment(p: number, from: number, to: number): number {
  return clamp01((p - from) / (to - from));
}
