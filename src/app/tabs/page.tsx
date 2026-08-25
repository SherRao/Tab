import Link from "next/link";
import { redirect } from "next/navigation";
import { getOwnedEvents } from "@/lib/queries";
import { getSessionUser } from "@/lib/auth";
import { signOutAction } from "@/lib/auth-actions";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "My tabs" };

export default async function TabsPage() {
  const viewer = await getSessionUser();
  if (!viewer) redirect("/signin?next=%2Ftabs");

  const events = await getOwnedEvents(viewer.id);

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-6 pt-8 pb-20">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="display text-5xl sm:text-6xl">My tabs</h1>
        <span className="flex items-center gap-3">
          <Link href="/create" className="label-mono text-accent-strong transition hover:underline">
            Start a new tab →
          </Link>
          <span className="label-mono text-stone-400">
            @{viewer.username} · {viewer.displayName}
          </span>
          <form action={signOutAction}>
            <button
              type="submit"
              className="label-mono text-stone-400 transition hover:text-red-600"
            >
              Sign out
            </button>
          </form>
        </span>
      </div>

      <section className="mt-12">
        <h2 className="label-mono border-b border-foreground/15 pb-2 text-stone-400">
          Events you own
        </h2>
        {events.length === 0 ? (
          <div className="mt-4 border border-dashed border-foreground/25 p-10 text-center">
            <p className="font-medium text-stone-500">No tabs yet.</p>
            <Link
              href="/create"
              className="label-mono mt-2 inline-block text-accent-strong hover:underline"
            >
              Start your first one →
            </Link>
          </div>
        ) : (
          <ul className="divide-y divide-dashed divide-foreground/10">
            {events.map((event) => (
              <li key={event.id}>
                <Link
                  href={`/e/${event.shareToken}`}
                  className="group flex items-baseline justify-between gap-3 py-3.5 transition"
                >
                  <span className="truncate font-medium group-hover:text-accent-strong">
                    {event.name}
                  </span>
                  <span className="label-mono shrink-0 text-stone-400">
                    {event.createdAt.toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })}
                    <span className="ml-3 inline-block transition group-hover:translate-x-0.5">
                      →
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
