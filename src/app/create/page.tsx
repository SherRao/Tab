import { createEventAction } from "@/lib/actions";
import { getSessionUser } from "@/lib/auth";
import { CreateTabForm } from "@/components/create-tab-form";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { CSSProperties } from "react";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Create a new tab" };

const delayStyle = (ms: number) => ({ "--delay": `${ms}ms` }) as CSSProperties;

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
    <main className="relative mx-auto w-full max-w-2xl flex-1 px-6 pt-8 pb-20">
      <span
        aria-hidden
        className="pointer-events-none absolute right-0 top-16 -z-10 select-none font-mono text-[10rem] font-bold leading-none tracking-tight text-foreground/[0.06] sm:text-[16rem]"
      >
        tab.
      </span>
      <header className="flex items-baseline justify-between gap-3">
        <Link
          href="/"
          className="label-mono text-stone-400 transition hover:text-foreground"
        >
          ← back home
        </Link>
      </header>
      <p className="label-mono rise-in mt-6 text-accent-strong">tab.</p>
      <h1 className="display rise-in mt-3 text-5xl sm:text-6xl" style={delayStyle(90)}>
        New tab
      </h1>
      <p className="rise-in mt-3 max-w-md text-lg leading-relaxed text-stone-600" style={delayStyle(180)}>
        Split it, settle it, keep the receipts. Name it, add your people, and Tab works out who
        owes whom.
      </p>

      <CreateTabForm action={createEventAction} error={error} />
    </main>
  );
}
