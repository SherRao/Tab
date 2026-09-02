import type { CSSProperties } from "react";

/** Style object feeding the `--delay` custom property used by rise-in animations. */
export function delayStyle(ms: number): CSSProperties {
  return { "--delay": `${ms}ms` } as CSSProperties;
}
