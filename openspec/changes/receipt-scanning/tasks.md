## 1. Setup

- [x] 1.1 Install `tesseract.js` and verify the dev server still builds and serves (`npm run dev`, `npm run build`)
- [x] 1.2 Create fixture transcripts directory `src/lib/__fixtures__/receipts/` with 3–5 sample OCR text transcripts (clean receipt, no-tip receipt, comma-decimal amounts, noisy receipt, unreadable junk) and verify files exist

## 2. Parser (pure functions)

- [x] 2.1 Implement `ReceiptDraft` type and amount-regex line extraction (rightmost price per line, text left = item name); verify unit tests pass on fixture transcripts for item extraction
- [x] 2.2 Implement keyword classification (subtotal excluded, tax, tip/gratuity, grand total = last total-labeled line) and `confidence` scoring; verify unit tests match spec scenarios including "Total Taco" style mislead lines
- [x] 2.3 Implement failure semantics: no items and no total → draft marked unusable; verify unit test asserts the unreadable-junk fixture fails cleanly

## 3. Scan UI

- [x] 3.1 Add "Scan receipt" entry point on the new-expense screen with camera capture input (`capture="environment"`) and file-picker fallback; verify both paths load an image into the scan flow
- [x] 3.2 Implement canvas preprocessing (downscale ≤1600px longest edge, grayscale, contrast) and verify a processed canvas is produced from a sample image
- [x] 3.3 Integrate lazy-loaded Tesseract worker with progress indication and a "preparing scanner" first-use state; verify OCR completes on a sample receipt image and the worker is not loaded on plain manual entry
- [x] 3.4 Wire `parseReceipt(ocrText)` output into `ExpenseEditor` via the `initial` prop with a "scanned — please review" banner, payer unselected; verify a scan pre-fills items, tax, tip, total and saves through the normal pipeline
- [x] 3.5 Implement failure and re-scan states: unusable draft shows fallback message preserving partial values, "Re-scan" resets the capture input; verify both paths

## 4. Privacy & Polish

- [x] 4.1 Verify no network requests carry image data during a scan (devtools/network assertion) and object URLs are revoked after use
- [x] 4.2 Add integration test: fixture transcript → parseReceipt → editor-shaped draft matches expected items/tax/tip/total; run full suite

## 5. Quality

- [x] 5.1 Run lint, typecheck, production build, and full test suite; fix any issues
