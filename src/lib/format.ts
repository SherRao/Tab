/** Display formatting for integer-cent money values (USD, thousands-separated). */
export function formatCents(cents: number): string {
  return (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
}

/** Editor-string formatting for integer cents: exactly two decimals ("12.34"). */
export function toFixedMoney(cents: number): string {
  return (cents / 100).toFixed(2);
}

/** Parse a user-entered money string into integer cents; NaN when unparseable. */
export function toCents(v: string): number {
  const n = Number(v.replace(/[$,\s]/g, ""));
  return Number.isFinite(n) ? Math.round(n * 100) : NaN;
}
