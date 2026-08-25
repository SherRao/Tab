import { createEventAction } from "@/lib/actions";
import { getSessionUser } from "@/lib/auth";
import { CreateTabForm } from "@/components/create-tab-form";
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

      <CreateTabForm action={createEventAction} error={error} />
    </main>
  );
}
