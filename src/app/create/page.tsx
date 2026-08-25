import { createEventAction } from "@/lib/actions";
import { getSessionUser } from "@/lib/auth";
import { CreateEventPeopleInput } from "@/components/add-people";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Create a new tab" };

export default async function CreatePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const [{ error }, viewer] = await Promise.all([
    searchParams,
    getSessionUser(),
  ]);
  if (!viewer) redirect("/signin?next=%2Fcreate");

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-6 pt-8 pb-20">
      <header className="flex items-baseline justify-between gap-3">
        <Link
          href="/"
          className="label-mono text-stone-400 transition hover:text-foreground"
        >
          ← back home
        </Link>
      </header>
      <h1 className="display mt-4 text-5xl sm:text-6xl">New tab</h1>

      <form action={createEventAction} className="paper-card mt-8 p-6">
        <div>
          <label htmlFor="name" className="label-mono block text-stone-500">
            Event name
          </label>
          <input
            id="name"
            name="name"
            required
            placeholder="Vegas trip…"
            className="input-ink mt-1.5"
          />
        </div>
        <div className="mt-4">
          <span className="label-mono block text-stone-500">
            Who&apos;s in?{" "}
            <span className="text-stone-300">(@username · email invite · plain name)</span>
          </span>
          <CreateEventPeopleInput />
        </div>
        {error && (
          <p className="mt-4 border border-red-200 bg-red-50 px-3 py-2 font-mono text-xs text-red-700">
            Please provide a name and at least two participants.
          </p>
        )}
        <button type="submit" className="btn-ink mt-5 w-full">
          Start a new tab &rarr;
        </button>
      </form>
    </main>
  );
}
