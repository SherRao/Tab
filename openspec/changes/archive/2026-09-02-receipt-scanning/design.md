## Context

The app has a working manual expense editor (`ExpenseEditor`) that accepts an `initial` draft prop — scanned results can pre-fill it without touching its save pipeline or the ledger. See proposal.md for motivation. Constraint from the accepted decision: OCR must run client-side via Tesseract.js; no image uploads.

## Goals / Non-Goals

**Goals:**

- Scan → review → save feels faster than typing, or it's not worth having
- Parser is a pure, fixture-testable function; OCR engine is an implementation detail behind it
- Zero image data leaves the device; no new server surface

**Non-Goals:**

- Server-side OCR or LLM vision providers (future change can slot in behind the parser interface)
- Image storage / receipt archive attachments
- Multi-receipt or multi-page scanning; non-English receipts beyond what Tesseract's eng model handles

## Decisions

### D1: Tesseract.js v6, lazy-loaded

The scan screen dynamically `import`s Tesseract so the ~few-MB WASM/worker assets load only when a user first scans; browser caches them afterward. Manual-entry users never pay the cost.

### D2: Pipeline: preprocess → OCR → parse → draft

```
photo ─▶ canvas preprocess ─▶ Tesseract.recognize ─▶ parseReceipt(text) ─▶ ExpenseDraft
        (downscale ≤1600px,             (pure, fixture-tested)
         grayscale, contrast)
```

Preprocessing via canvas: longest edge scaled to ≤1600px, grayscale + contrast boost. This materially improves Tesseract accuracy on phone photos and bounds WASM memory use on mobile Safari.

### D3: Parser as pure function with typed draft

`parseReceipt(text: string): ReceiptDraft` where `ReceiptDraft = { items: {name, amountCents}[], taxCents, tipCents, totalCents, confidence }`. Heuristics:

- Amount regex: `-?\$?\s?\d{1,6}[.,]\d{2}\b` (rightmost match per line is the price; text left of it is the item name).
- Classification by keyword: `/^sub ?total/i` (kept as reference, not an item), `/tax/i`, `/tip|gratuity/i`, `/total|balance due/i` (grand total = the _last_ total-labeled line; `subtotal` excluded).
- Lines without a parseable amount are ignored (headers, store name, card info).
- `confidence`: fraction of expected structure found (has items, has total, Σitems+tax+tip ≈ total). Drafts with zero items and no total count as failures (drives the fallback UX).

### D4: Cross-check drives soft confidence, not blocking

If Σitems + tax + tip ≠ total, the draft still pre-fills — the existing non-blocking reconciliation warning in the editor surfaces the discrepancy. Scanning and reconciliation stay independent concerns.

### D5: Capture UX

Single "Scan receipt" button on the new-expense screen. On phones, an `<input type="file" accept="image/*" capture="environment">` opens the camera; on desktop the same input opens the file picker. After OCR: editor opens pre-filled with a dismissible "scanned from receipt — please review" banner; "Re-scan" returns to the capture step.

### D6: No image persistence

The image lives in an object URL for the duration of the scan, is drawn to the preprocess canvas, then revoked. Nothing is sent to the server; nothing enters the DB.

## Risks / Trade-offs

- [Tesseract accuracy on real-world receipts (crumpled, low light, thermal fade)] → Preprocessing + review-first UX; every field editable; manual entry one tap away. Accuracy ceiling accepted by choosing on-device OCR.
- [First-scan WASM download (~2–5 MB)] → Lazy load + browser caching; show a "preparing scanner" state on first use.
- [Mobile Safari WASM memory limits on huge photos] → D2 downscaling before OCR.
- [Parser misclassification (item named "Total Taco") ] → Keyword rules anchored to line start and to lines whose amount is rightmost; mis-parses are user-correctable in review.
- [Amount formats vary (comma decimal, currency symbols)] → Regex covers common variants; fixtures encode them; misses degrade to manual entry, never to wrong silent saves.

## Migration Plan

Purely additive UI + one new dependency; no schema or data migration. Rollback = hide the scan entry point.

## Open Questions

None blocking. Exact preprocessing parameters (contrast curve, threshold) are tunable during implementation against fixture images without changing the approach.
