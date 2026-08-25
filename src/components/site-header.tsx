import Link from "next/link";
import { getSessionUser } from "@/lib/auth";
import { signOutAction } from "@/lib/auth-actions";

export default async function SiteHeader() {
  const viewer = await getSessionUser();
  return (
    <header className="mx-auto flex w-full max-w-2xl items-center justify-between px-6 py-6">
      <Link href="/" className="font-mono text-lg font-bold tracking-tight">
        tab.
      </Link>
      <nav className="flex items-center gap-5">
        {viewer ? (
          <>
            <Link
              href="/tabs"
              className="label-mono text-stone-500 transition hover:text-foreground"
            >
              My tabs
            </Link>
            <Link
              href="/create"
              className="label-mono text-accent-strong transition hover:underline"
            >
              New tab
            </Link>
            <form action={signOutAction}>
              <button
                type="submit"
                className="label-mono text-stone-400 transition hover:text-red-600"
              >
                Sign out
              </button>
            </form>
          </>
        ) : (
          <Link
            href="/signin"
            className="label-mono text-accent-strong transition hover:underline"
          >
            Sign in
          </Link>
        )}
      </nav>
    </header>
  );
}