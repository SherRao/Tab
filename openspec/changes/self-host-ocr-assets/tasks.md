## 1. Copy accuracy (interim — shipped with this proposal)

- [x] 1.1 Change the scan copy from "everything stays on your device" to "your photo never leaves your device" in `src/components/expense/scan-receipt.tsx`

## 2. Pin the OCR core package

- [ ] 2.1 Add `tesseract.js-core` (matching `tesseract.js` major) as an explicit dependency in `package.json` so the core version is lockfile-pinned
- [ ] Verify: `node_modules/tesseract.js-core` is present and the worker/core files can be located

## 3. Asset build + publish

- [ ] 3.1 Add a script (e.g. `scripts/build-ocr-assets`) that copies `worker.min.js` and the `-lstm` core variants (`relaxedsimd`, `simd`, plain, plus `.wasm` siblings) from `node_modules`
- [ ] 3.2 Obtain the matching `eng.traineddata.gz` (`4.0.0_best_int`) and compute a checksum for it and the core files; fail the build on mismatch
- [ ] 3.3 Publish the assets to the project CDN under a version-pinned path
- [ ] Verify: the published paths return the expected bytes and hashes

## 4. Wire explicit paths into the scanner

- [ ] 4.1 Pass `workerPath`, `corePath` (directory, to keep runtime SIMD detection), and `langPath` to `createWorker` in `scan-receipt.tsx`, reading the asset base URL from config
- [ ] 4.2 Add integrity verification (SRI where the loader allows, otherwise the build-time checksum) and a documented local-dev fallback
- [ ] Verify: a scan completes and the devtools network panel shows **zero** requests to jsdelivr or any third-party origin

## 5. Spec update

- [ ] 5.1 Update `openspec/specs/receipt-scanning/spec.md` "On-device OCR" requirement to state that all OCR assets load from a first-party / project-owned origin with pinned versions and integrity verification, and no OCR request goes to a third-party CDN at runtime
- [ ] Verify: spec scenarios cover the no-third-party-request guarantee
