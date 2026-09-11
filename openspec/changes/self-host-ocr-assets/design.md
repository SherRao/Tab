## Context

tesseract.js 7.0.0 resolves three assets at scan time. When paths are omitted,
each defaults to jsdelivr:

- **Worker** — `worker.min.js` (`tesseract.js/src/worker/browser/defaultOptions.js`).
- **Core** — WebAssembly engine from `tesseract.js-core`
  (`worker-script/browser/getCore.js`). With `oem: 1` (LSTM-only) the `-lstm`
  variants are used, and the exact file is chosen at runtime by SIMD feature
  detection: `tesseract-core-relaxedsimd-lstm.wasm.js`,
  `tesseract-core-simd-lstm.wasm.js`, or `tesseract-core-lstm.wasm.js`
  (each with a sibling `.wasm`).
- **Traineddata** — `eng.traineddata.gz` from
  `@tesseract.js-data/eng/4.0.0_best_int` (`worker-script/index.js`).

Approximate sizes: worker ~0.1MB, a core `.wasm.js` ~3.9MB (+ `.wasm` ~2.9MB),
traineddata ~2.9MB. Shipping all core variants for full device coverage pushes
the total toward the high end (~14–17MB); a single forced variant is smaller but
costs SIMD performance or breaks on devices lacking the chosen instruction set.

## Goals / Non-goals

- **Goal:** no runtime request to a third-party origin; integrity-verified,
  version-pinned assets served from a project-owned origin.
- **Goal:** assets stay in lockstep with the installed package versions.
- **Non-goal:** vendoring binaries into git (see proposal Non-goals).

## Decisions

### Decision: Serve from a project-owned CDN, not `/public` in git

Keeps the repo small and history clean while removing the third-party dependency.
The app loads assets from a configured first-party origin. A local-dev fallback
(serving copied assets from a git-ignored folder, or a dev-only CDN path) keeps
`npm run dev` working offline once assets are fetched once.

- **Alternative — commit to `/public`:** simplest and fully offline, but adds
  ~7–17MB to git permanently and is hard to undo. Rejected per Non-goals.
- **Alternative — keep jsdelivr:** rejected; this is the finding.

### Decision: Which core variants to publish

Publish the `-lstm` set (`relaxedsimd`, `simd`, plain) plus their `.wasm`
siblings, and point `corePath` at the **directory** so tesseract.js keeps doing
runtime feature detection. This preserves SIMD performance where available and
correctness where not, at the cost of more bytes on the CDN (bytes on a CDN are
cheap; git bytes are not).

### Decision: Integrity and version pinning

Asset URLs include the package version. Add integrity verification: SRI on the
worker `<script>`/`importScripts` where the API allows, and a checksum check on
the core/traineddata downloads in the build step so a swapped upstream asset
fails the build rather than reaching users.

### Decision: Build step derives assets from installed packages

A release script copies `worker.min.js` and the core files from `node_modules`
(after adding `tesseract.js-core` as an explicit dep) and obtains the matching
`eng.traineddata.gz`, computes hashes, and publishes to the CDN. This prevents
drift when `tesseract.js` is upgraded.

## Risks / Trade-offs

- **First-build network dependency** to fetch traineddata (mitigated: cached,
  checksum-verified, and only at asset-build time, not per user).
- **CDN/infra ownership** — introduces an asset origin to operate and pay for.
- **Feature-detection footgun** — if only one core variant is published, some
  devices fail; hence publishing the full `-lstm` set.

## Migration Plan

1. Add `tesseract.js-core` as an explicit dependency (lockfile pin).
2. Add the asset-build/publish script with checksums.
3. Stand up the CDN path + app config for the asset base URL (with dev fallback).
4. Wire `workerPath` / `corePath` / `langPath` into `createWorker`.
5. Verify a scan makes zero requests to jsdelivr (devtools network panel).
6. Update the `receipt-scanning` spec.

## Open Questions

- Which CDN / asset origin, and how is the base URL configured per environment?
- Publish all `-lstm` core variants (chosen here) or force a single variant to
  minimize CDN footprint?
- Is SRI enforceable given tesseract.js's `importScripts` loading path, or is a
  build-time checksum the practical integrity control?
