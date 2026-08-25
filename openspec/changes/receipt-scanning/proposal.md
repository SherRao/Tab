## Why

Typing a long receipt by hand is the most tedious part of expense entry and the main reason people abandon splitting apps. Phone cameras already capture the receipt at the table — the app should read it, draft the line items, and let the user just confirm who got what.

## What Changes

- Add receipt photo capture/upload to the expense entry flow (camera on mobile, file picker everywhere).
- Add in-browser OCR (Tesseract.js) that extracts line items, tax, tip, and total from the photo. Photos are processed on-device and never uploaded or stored.
- Add a parse layer that converts raw OCR text into a structured expense draft (items, tax, tip, total) using amount/keyword heuristics.
- Scanned results pre-fill the existing expense editor as an editable draft; the user reviews and corrects before saving. Scanning never auto-saves.
- Add a "Scan receipt" entry point on the new-expense screen alongside manual entry; manual entry remains fully available as the fallback when scanning fails or is inaccurate.

## Capabilities

### New Capabilities

- `receipt-scanning`: Capturing receipt photos, on-device OCR, parsing into an editable expense draft, and graceful failure/fallback behavior.

### Modified Capabilities

(none — the expense editor's save/edit behavior is unchanged; scanning only pre-fills it)

## Impact

- New dependency: `tesseract.js` (+ WASM worker assets, lazy-loaded only on the scan screen).
- New UI: scan screen/capture step feeding the existing `ExpenseEditor` via its `initial` prop — no changes to the editor's save pipeline or the ledger.
- New pure parser module (`src/lib/receipt-parse.ts`) with fixture-based tests.
- No server changes, no schema changes, no new external services. Privacy posture: images stay client-side.
