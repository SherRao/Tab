# Tab

Split expenses, not friendships. Tab is a shared expense tracker for trips and
events: add itemized receipts (or scan a photo of one), tag who got what, and
Tab works out exactly who owes whom — with the fewest transfers possible.

No sign-up: create an event and share the link.

## Getting Started

```bash
npm install
npm run db:migrate
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and start a new tab.

## Scripts

- `npm run dev` — start the dev server
- `npm run build` / `npm start` — production build and serve
- `npm test` — run tests (vitest)
- `npm run lint` — eslint
- `npm run db:generate` / `npm run db:migrate` — drizzle schema migrations

## Stack

Next.js (App Router), React, Tailwind CSS, Drizzle ORM + SQLite, Tesseract.js
for on-device receipt OCR.
