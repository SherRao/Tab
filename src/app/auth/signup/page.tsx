import { redirect } from "next/navigation";
import { peekLoginToken } from "@/lib/auth";
import { completeSignUpAction } from "@/lib/auth-actions";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Create your account" };

const ERRORS: Record<string, string> = {
  username: "That username is taken (2–24 chars: a–z, 0–9, underscore).",
  name: "Please enter a display name.",
};

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; error?: string; next?: string }>;
}) {
  const { token = "", error, next } = await searchParams;
  const peeked = await peekLoginToken(token);
  if (!peeked) redirect("/signin?error=expired");

  return (
    <main className="mx-auto w-full max-w-sm flex-1 px-6 pt-20 pb-20">
      <h1 className="display text-4xl">Create your account</h1>
      <p className="mt-3 leading-relaxed text-stone-600">
        Signing up as{" "}
        <span className="font-mono text-sm">{peeked.email}</span>
      </p>

      <form action={completeSignUpAction} className="paper-card mt-8 space-y-4 p-6">
        {error && (
          <p className="border border-red-200 bg-red-50 px-3 py-2 font-mono text-xs text-red-700">
            {ERRORS[error] ?? "Something went wrong."}
          </p>
        )}
        <input type="hidden" name="token" value={token} />
        <input type="hidden" name="next" value={next ?? ""} />
        <div>
          <label htmlFor="username" className="label-mono block text-stone-500">
            Username
          </label>
          <input
            id="username"
            name="username"
            required
            pattern="[a-zA-Z0-9_]{2,24}"
            placeholder="lowercase, no spaces"
            className="input-ink mt-1.5"
          />
        </div>
        <div>
          <label htmlFor="displayName" className="label-mono block text-stone-500">
            Display name
          </label>
          <input
            id="displayName"
            name="displayName"
            required
            maxLength={60}
            placeholder="How friends see you"
            className="input-ink mt-1.5"
          />
        </div>
        <button type="submit" className="btn-ink w-full">
          Create account →
        </button>
      </form>
    </main>
  );
}
