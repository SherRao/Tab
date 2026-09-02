import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { SignInForm } from "@/components/auth/sign-in-form";
import { Watermark } from "@/components/ui/watermark";
import { delayStyle } from "@/lib/motion";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Sign in" };

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
      <Watermark
        position="inset-x-0 top-8"
        size="text-[9rem]"
        sizeLg="sm:text-[15rem]"
        center
      >
        tab.
      </Watermark>
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

      <SignInForm sent={sent} error={error} next={next} />
    </main>
  );
}
