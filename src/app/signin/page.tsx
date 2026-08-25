import { redirect } from "next/navigation";
import Link from "next/link";
import { requestSignInAction } from "@/lib/auth-actions";
import { getSessionUser } from "@/lib/auth";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Sign in" };

const ERRORS: Record<string, string> = {
  invalid: "That doesn't look like an email address.",
  expired: "That link was used or has expired — request a fresh one below.",
};

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string; error?: string; next?: string }>;
}) {
  const { sent, error, next } = await searchParams;
  const user = await getSessionUser();
  if (user && !error) redirect("/tabs");

  return (
    <main className="mx-auto w-full max-w-sm flex-1 px-6 pt-20 pb-20">
      <h1 className="display text-4xl">Sign in to tab.</h1>
      <p className="mt-3 leading-relaxed text-stone-600">
        We&apos;ll email you a magic link — no password needed.
      </p>

      {sent ? (
        <div className="paper-card mt-8 p-6">
          <p className="font-medium">Check your inbox</p>
          <p className="mt-2 font-mono text-xs leading-relaxed text-stone-500">
            If that address has a Tab account (or is new), a sign-in link is on
            its way. It expires in 15 minutes.
          </p>
          <Link
            href="/"
            className="label-mono mt-4 inline-block text-accent-strong hover:underline"
          >
            ← back home
          </Link>
        </div>
      ) : (
        <form action={requestSignInAction} className="paper-card mt-8 space-y-4 p-6">
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
