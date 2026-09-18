"use client";

import { useEffect } from "react";
import Lenis from "lenis";

/**
 * Mounts Lenis smooth scrolling on the window. Renders nothing, so it can sit
 * in the root layout without wrapping the tree in an extra element.
 *
 * Lenis honors `prefers-reduced-motion` on its own (it forces `lerp` to 1 and
 * makes programmatic scrolls instant), so there is no separate opt-out here.
 */
export function SmoothScroll() {
  useEffect(() => {
    const lenis = new Lenis({
      lerp: 0.085,
      wheelMultiplier: 0.9,
      touchMultiplier: 1.6,
      // Let `href="#how"` links glide instead of jumping.
      anchors: { offset: -24 },
      autoRaf: true,
    });
    return () => lenis.destroy();
  }, []);

  return null;
}
