import { createEventAction } from "@/lib/actions";
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Create a new tab" };

export default function CreatePage() {
  return (
    <main className="mx-auto w-full max-w-2xl px-6 pt-8 pb-20">
      <header className="flex items-center justify-between mb-6">
        <h1 className="display text-4xl font-bold">Create a new tab</h1>
        <Link
          href="/"
          className="label-mono text-stone-400 transition hover:text-foreground"
        >
          ← Back to home
        </Link>
      </header>

      <form action={createEventAction} className="paper-card mt-10 max-w-lg p-6" id="start">
        { /* Viewer check would be handled by the action requiring session */ }
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
            Who's in?{" "}
            <span className="text-stone-300">(@username · email invite · plain name)</span>
          </span>
        </div>
        <button type="submit" className="btn-ink mt-5 w-full">
          Create tab →
        </button>
      </form>
    </main>
  );
}