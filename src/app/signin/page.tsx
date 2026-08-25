import { redirect } from "next/navigation";
import Link from "next/link";
import { requestSignInAction } from "@/lib/auth-actions";
import { getSessionUser } from "@/lib/auth";
import type { CSSProperties } from "react";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Sign in" };

const ERRORS: Record<string, string> = {
  invalid: "That doesn't look like an email address.",
  expired: "That link was used or has expired — request a fresh one below.",
};

const delayStyle = (ms: number) => ({ "--delay": `${ms}ms` }) as CSSProperties;

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string; error?: string; next?: string }>;
}) {
  const { sent, error, next } = await searchParams;
  const user = await getSessionUser();
  if (user && !error) redirect("/tabs");

  return (
    <main className="relative mx-auto flex w-full max-w-md flex-1 flex-col items-center px-6 pt-16 pb-20 sm:pt-24">
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-8 -z-10 select-none text-center font-mono text-[9rem] font-bold leading-none tracking-tight text-foreground/[0.06] sm:text-[15rem]"
      >
        tab.
      </span>
      <p className="label-mono rise-in text-accent-strong">tab. — expense ledger</p>
      <h1 className="display rise-in mt-4 text-center text-5xl" style={delayStyle(90)}>
        Sign in to tab.
      </h1>
      <p
        className="rise-in mt-4 max-w-sm text-center text-lg leading-relaxed text-stone-600"
        style={delayStyle(180)}
      >
        Split it. Settle it. Keep the receipts. We&apos;ll email you a magic link — no password.
      </p>

      {sent ? (
        <div
          className="paper-card receipt-edge rise-in mt-10 w-full p-7"
          style={delayStyle(280)}
        >
          <span className="stamp absolute top-5 right-5">sent ✓</span>
          <p className="font-medium">Check your inbox</p>
          <p className="mt-2 max-w-xs font-mono text-xs leading-relaxed text-stone-500">
            If that address has a Tab account (or is new), a sign-in link is on its way. It expires
            in 15 minutes.
          </p>
          <Link
            href="/"
            className="label-mono mt-4 inline-block text-accent-strong hover:underline"
          >
            ← back home
          </Link>
        </div>
      ) : (
        <form
          action={requestSignInAction}
          className="paper-card receipt-edge rise-in mt-10 w-full space-y-4 p-7"
          style={delayStyle(280)}
        >
          <span className="stamp absolute top-5 right-5">no password</span>
          {error && (
            <p className="border border-red-200 bg-red-50 px-3 py-2 font-mono text-xs text-red-700">
              {ERRORS[error] ?? "Something went wrong."}
            </p>
          )}
          <input type="hidden" name="next" value={next ?? ""} />
          <div>
            <label htmlFor="email" className="label-mono block text-stone-500">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              placeholder="you@example.com"
              className="input-ink mt-1.5"
            />
          </div>
          <button type="submit" className="btn-ink w-full">
            Email me a magic link →
          </button>
        </form>
      )}
    </main>
  );
}