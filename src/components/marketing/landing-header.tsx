import Link from "next/link";

export function LandingHeader({ viewerSignedIn }: { viewerSignedIn: boolean }) {
  return (
    <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-6">
      <Link href="/" className="flex items-baseline gap-2">
        <span className="font-mono text-lg font-bold tracking-tight">tab.</span>
        <span className="label-mono hidden text-stone-400 sm:inline">expense ledger</span>
      </Link>
      <nav className="flex items-center gap-5">
        <a href="#how" className="label-mono text-stone-500 transition hover:text-foreground">
          How it works ↓
        </a>
        {viewerSignedIn ? (
          <Link href="/tabs" className="label-mono text-accent-strong transition hover:underline">
            My tabs
          </Link>
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
