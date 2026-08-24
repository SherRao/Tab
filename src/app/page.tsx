import { createEventAction } from "@/lib/actions";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 py-16">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-600 text-2xl shadow-lg shadow-emerald-600/20">
            🧾
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Split the bill</h1>
          <p className="mt-2 leading-relaxed text-stone-500">
            Add an itemized receipt, tag who got what, and we&apos;ll figure out
            exactly who owes whom.
          </p>
        </div>

        <form
          action={createEventAction}
          className="space-y-5 rounded-2xl border border-stone-200/70 bg-white p-6 shadow-xl shadow-stone-900/5"
        >
          <div>
            <label htmlFor="name" className="block text-sm font-medium">
              Event name
            </label>
            <input
              id="name"
              name="name"
              required
              placeholder="Vegas trip, Friday night out…"
              className="mt-1.5 w-full rounded-lg border border-stone-300 px-3.5 py-2.5 transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/15 focus:outline-none"
            />
          </div>
          <div>
            <label htmlFor="participants" className="block text-sm font-medium">
              Who&apos;s in?
            </label>
            <input
              id="participants"
              name="participants"
              required
              placeholder="Alice, Bob, Carol"
              className="mt-1.5 w-full rounded-lg border border-stone-300 px-3.5 py-2.5 transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/15 focus:outline-none"
            />
            <p className="mt-1.5 text-xs text-stone-400">
              Comma-separated — at least two people.
            </p>
          </div>
          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              Please provide a name and at least two participants.
            </p>
          )}
          <button
            type="submit"
            className="w-full rounded-lg bg-emerald-600 px-4 py-3 font-semibold text-white shadow-lg shadow-emerald-600/25 transition hover:bg-emerald-700 active:scale-[0.98]"
          >
            Create event
          </button>
          <p className="text-center text-xs text-stone-400">
            No sign-up needed — you&apos;ll get a shareable link.
          </p>
        </form>

        <div className="mt-8 grid grid-cols-3 gap-3 text-center text-xs text-stone-500">
          <div className="rounded-xl border border-stone-200/70 bg-white/60 p-3">
            <div className="mb-1 text-lg">🧾</div>
            Itemized receipts
          </div>
          <div className="rounded-xl border border-stone-200/70 bg-white/60 p-3">
            <div className="mb-1 text-lg">🎂</div>
            Birthday splits
          </div>
          <div className="rounded-xl border border-stone-200/70 bg-white/60 p-3">
            <div className="mb-1 text-lg">🤝</div>
            Fewest payments
          </div>
        </div>
      </div>
    </main>
  );
}
