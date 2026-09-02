import { redirect } from "next/navigation";
import { peekLoginToken } from "@/lib/auth";
import { SignUpForm } from "@/components/auth/sign-up-form";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Create your account" };

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
        Signing up as <span className="font-mono text-sm">{peeked.email}</span>
      </p>

      <SignUpForm token={token} error={error} next={next} />
    </main>
  );
}
