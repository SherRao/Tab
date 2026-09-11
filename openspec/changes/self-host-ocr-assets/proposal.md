## Why

Receipt OCR runs in the browser with tesseract.js. The photo genuinely never
leaves the device, but the OCR **engine assets** are not shipped by the app.
`createWorker("eng", 1, …)` in `src/components/expense/scan-receipt.tsx` passes
no `workerPath`, `corePath`, or `langPath`, so tesseract.js falls back to the
public jsdelivr CDN for all three: the worker script, the WebAssembly core, and
the `eng` traineddata.

This has three problems:

- **The privacy claim is imprecise.** The scan UI has said "everything stays on
  your device", but at scan time the browser fetches ~7–17MB from a third party,
  leaking the user's IP and user-agent to that CDN. (Interim fix already shipped:
  the copy now reads "your photo never leaves your device".)
- **Third-party code executes in our origin.** The worker/core are loaded via
  `importScripts("<remote url>")` — remote code running in the app's origin, not
  covered by the lockfile and with no Subresource Integrity check. A CDN
  compromise would run in users' sessions.
- **Scanning breaks offline or during a jsdelivr outage**, an availability
  dependency on infrastructure we don't control.

## What Changes

- **Serve the OCR assets from our own CDN.** Host the tesseract worker, the
  WebAssembly core (the `-lstm` variants matched to `oem: 1`), and the `eng`
  traineddata on the project's own CDN / asset origin, pinned to the installed
  `tesseract.js` / `tesseract.js-core` version.
- **Point tesseract.js at those assets explicitly.** Pass `workerPath`,
  `corePath`, and `langPath` (or `workerBlobURL`/options as the API requires) to
  `createWorker` so no request ever goes to jsdelivr at runtime.
- **Pin and integrity-check.** Version the asset URLs and add integrity
  verification (SRI on the worker script where feasible, and/or a checksum of the
  fetched core/traineddata) so a swapped asset is rejected.
- **Keep assets in sync with the package version.** A build/release step derives
  the assets from the installed packages (copy worker + core from
  `node_modules`, obtain the matching traineddata) and uploads them to the CDN,
  so a `tesseract.js` bump can't silently drift from the served files.
- **Tighten the spec.** Receipt-scanning requires that no runtime request goes to
  a third-party origin; all OCR assets come from a first-party / project-owned
  origin.

## Non-goals

- Committing the multi-MB binaries into the git repository. Delivery is via the
  project CDN, not git history.
- Changing the OCR engine, language coverage, or parsing heuristics.
- Server-side OCR. The image still never leaves the device.

## Capabilities

### Modified Capabilities

- `receipt-scanning`: The existing on-device OCR requirement is strengthened so
  that OCR engine assets (worker, WebAssembly core, traineddata) are served from
  a first-party / project-owned origin with pinned versions and integrity
  verification, and no OCR request is made to a third-party CDN at runtime.

## Impact

- `src/components/expense/scan-receipt.tsx`: `createWorker` is given explicit
  `workerPath` / `corePath` / `langPath` pointing at the project CDN; the
  interim copy fix stays.
- `package.json`: add `tesseract.js-core` as an explicit dependency so the core
  version is lockfile-pinned and available to the asset build step.
- Build/release tooling: a script (e.g. `scripts/build-ocr-assets`) that copies
  the worker + core from `node_modules`, obtains the matching `eng` traineddata,
  computes integrity hashes, and publishes to the CDN.
- Infra: a CDN bucket/path for the OCR assets and the env/config that tells the
  app where to load them from (with a documented local-dev fallback).
- `openspec/specs/receipt-scanning/spec.md`: updated per the modified capability.
