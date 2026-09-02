import { completeSignUpAction } from "@/lib/auth-actions";
import { ErrorNote } from "@/components/ui/error-note";
import { Field } from "@/components/ui/field";

const ERRORS: Record<string, string> = {
  username: "That username is taken (2–24 chars: a–z, 0–9, underscore).",
  name: "Please enter a display name.",
};

export function SignUpForm({
  token,
  error,
  next,
}: {
  token: string;
  error?: string;
  next?: string;
}) {
  return (
    <form action={completeSignUpAction} className="paper-card mt-8 space-y-4 p-6">
      {error && (
        <ErrorNote variant="form">{ERRORS[error] ?? "Something went wrong."}</ErrorNote>
      )}
      <input type="hidden" name="token" value={token} />
      <input type="hidden" name="next" value={next ?? ""} />
      <Field label="Username" htmlFor="username">
        <input
          id="username"
          name="username"
          required
          pattern="[a-zA-Z0-9_]{2,24}"
          placeholder="lowercase, no spaces"
          className="input-ink mt-1.5"
        />
      </Field>
      <Field label="Display name" htmlFor="displayName">
        <input
          id="displayName"
          name="displayName"
          required
          maxLength={60}
          placeholder="How friends see you"
          className="input-ink mt-1.5"
        />
      </Field>
      <button type="submit" className="btn-ink w-full">
        Create account →
      </button>
    </form>
  );
}
