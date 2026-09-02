import Link from "next/link";
import { requestSignInAction } from "@/lib/auth-actions";
import { delayStyle } from "@/lib/motion";
import { ErrorNote } from "@/components/ui/error-note";
import { Field } from "@/components/ui/field";

const ERRORS: Record<string, string> = {
  invalid: "That doesn't look like an email address.",
  expired: "That link was used or has expired — request a fresh one below.",
};

export function SignInForm({
  sent,
  error,
  next,
}: {
  sent?: string;
  error?: string;
  next?: string;
}) {
  if (sent) {
    return (
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
    );
  }

  return (
    <form
      action={requestSignInAction}
      className="paper-card receipt-edge rise-in mt-10 w-full space-y-4 p-7"
      style={delayStyle(280)}
    >
      <span className="stamp absolute top-5 right-5">no password</span>
      {error && (
        <ErrorNote variant="form">{ERRORS[error] ?? "Something went wrong."}</ErrorNote>
      )}
      <input type="hidden" name="next" value={next ?? ""} />
      <Field label="Email" htmlFor="email">
        <input
          id="email"
          name="email"
          type="email"
          required
          placeholder="you@example.com"
          className="input-ink mt-1.5"
        />
      </Field>
      <button type="submit" className="btn-ink w-full">
        Email me a magic link →
      </button>
    </form>
  );
}
