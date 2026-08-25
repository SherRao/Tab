export interface ReceiptDraftItem {
  name: string;
  amountCents: number;
}

export interface ReceiptDraft {
  items: ReceiptDraftItem[];
  taxCents: number;
  tipCents: number;
  totalCents: number;
  confidence: number;
  usable: boolean;
}

const AMOUNT_RE = /(?:[$€£])?\s*(\d{1,3}(?:,\d{3})+\.\d{2}|\d+[.,]\d{2})(?!\d)/g;

const SUBTOTAL_RE = /^sub\s?tot/i;
const TAX_RE = /^(?:sales\s)?tax\b|^imposta\b/i;
const TIP_RE = /^(?:suggested\s+)?tip\b|^gratuity\b|^servizio\b|^service\b/i;
const TOTAL_RE = /^total\b|^balance\s?due\b|^amount\s?due\b|^due\b|^totale\b|^grand\s?total\b/i;
const IGNORE_RE =
  /^(?:cash|change|visa|master(?:card)?|amex|discover|debit|credit|card|thank|order|table|check|server|guest|receipt|store|paid)\b/i;

const FILLER_RE = /\b(?:due|amount|usd|cad|eur)\b/gi;

function labelRemainderIsEmpty(name: string, labelMatch: RegExpMatchArray): boolean {
  const rest = cleanName(name.slice(labelMatch[0].length).replace(FILLER_RE, " "));
  return rest === "";
}

function parseAmountCents(raw: string): number {
  const cleaned = raw.replace(/[$€£\s]/g, "");
  let normalized: string;
  if (cleaned.includes(".")) {
    normalized = cleaned.replace(/,/g, "");
  } else {
    normalized = cleaned.replace(/,/g, ".");
  }
  const value = Number(normalized);
  if (!Number.isFinite(value)) return NaN;
  return Math.round(value * 100);
}

function cleanName(raw: string): string {
  return raw
    .replace(/[\s\-–—:.•*·]+$/g, "")
    .replace(/^[\s\-–—:.•*·]+/g, "")
    .trim();
}

export function parseReceipt(text: string): ReceiptDraft {
  const items: ReceiptDraftItem[] = [];
  let taxCents = 0;
  let tipCents = 0;
  let totalCents = 0;

  for (const line of text.split(/\r?\n/)) {
    AMOUNT_RE.lastIndex = 0;
    const matches = [...line.matchAll(AMOUNT_RE)];
    if (matches.length === 0) continue;
    const last = matches[matches.length - 1];
    const amountCents = parseAmountCents(last[1]);
    if (!Number.isFinite(amountCents)) continue;

    const name = cleanName(line.slice(0, last.index ?? 0));
    const nameForClassify = name.replace(/\([^)]*\)/g, " ");
    const lower = nameForClassify.toLowerCase();

    if (SUBTOTAL_RE.test(lower)) {
      continue;
    }

    if (TAX_RE.test(lower)) {
      taxCents = amountCents;
      continue;
    }

    if (TIP_RE.test(lower)) {
      tipCents = amountCents;
      continue;
    }

    if (TOTAL_RE.test(lower)) {
      const labelMatch = nameForClassify.match(TOTAL_RE);
      const isEmpty = labelMatch ? labelRemainderIsEmpty(nameForClassify, labelMatch) : false;
      if (isEmpty) {
        totalCents = amountCents;
        continue;
      }
    }

    if (IGNORE_RE.test(lower)) {
      continue;
    }

    if (name === "") {
      continue;
    }

    items.push({ name, amountCents });
  }

  const itemsSum = items.reduce((a, b) => a + b.amountCents, 0);
  const expected = itemsSum + taxCents + tipCents;
  const sumsMatch = totalCents > 0 && Math.abs(expected - totalCents) <= 2;

  const signals = [items.length > 0, totalCents > 0, sumsMatch];
  const confidence = signals.filter(Boolean).length / signals.length;
  const usable = items.length > 0 || totalCents > 0;

  return { items, taxCents, tipCents, totalCents, confidence, usable };
}
