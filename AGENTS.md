# Tab — agent guide

Tab is a shared expense tracker ("split expenses, not friendships"): events are
created via a link with a token (`/e/[token]`), participants add itemized
receipts, and the ledger nets everything out to the fewest transfers.

## Commands

- `npm run dev` — dev server (port 3000)
- `npm run build` / `npm start` — production build and serve
- `npm test` — vitest (all tests)
- `npm run lint` — eslint
- `npm run db:generate` — regenerate drizzle migrations after schema changes
- `npm run db:migrate` — apply migrations to `data/app.db`

## Architecture

- `src/app/` — App Router pages: `/` (landing + create event),
  `/e/[token]` (event dashboard: balances, settle-up, receipts),
  `/e/[token]/expenses/new` and `/[id]/edit` (expense editor).
- `src/lib/ledger.ts` — core money math: `computeNetBalances`,
  `simplifyDebts`. All amounts are integer **cents**; never use floats.
- `src/lib/queries.ts` — read queries; `src/lib/actions.ts` — server actions
  (create event, add participant, save/update/delete expense).
- `src/db/schema.ts` — drizzle schema (events, participants, expenses,
  line_items, line_item_shares). SQLite via better-sqlite3, WAL mode.
- `src/lib/receipt-parse.ts` + `src/lib/image-preprocess.ts` — on-device
  receipt OCR (tesseract.js, client-side only).
- `src/components/expense-editor.tsx` — the shared new/edit expense form
  (client component). `new-expense-flow.tsx` wraps it with the scan step.

## Conventions

- Money is always integer cents end-to-end; format with `toLocaleString` for
  display, `toFixed(2)` only for editor string state.
- Design system lives in `src/app/globals.css`: paper/ink tokens
  (`--background`, `--paper`, `--accent`), and utilities `receipt-card`,
  `receipt-edge`, `receipt-lined`, `label-mono`, `leader-dots`, `paper-card`,
  `input-ink`, `btn-ink`, `btn-ghost`. Use these instead of one-off styles;
  Tailwind v4 `@theme inline` maps them to `bg-paper`, `text-accent`, etc.
- Server components by default; `"use client"` only where state is needed.
- Event access is the share token — there is no auth. Don't add endpoints that
  assume a user session.

## Testing

`npm test` covers the ledger math (`src/lib/__tests__/`) including a full
flow integration test. Run it before committing anything that touches money
logic.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
