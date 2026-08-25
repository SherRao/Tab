"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import {
  appBaseUrl,
  consumeLoginToken,
  createLoginToken,
  createSession,
  destroySession,
  findUserByEmail,
  normalizeEmail,
} from "./auth";
import { linkAccountToParticipant, ParticipantError } from "./participants";
import { sendEmail } from "./email";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function loginUrl(token: string): string {
  return `${appBaseUrl()}/auth/verify?token=${token}`;
}

/**
 * Request a magic link. The response is identical whether or not the email
 * has an account, so account existence is not revealed.
 */
export async function requestSignInAction(formData: FormData) {
  const email = normalizeEmail(String(formData.get("email") ?? ""));
  const next = String(formData.get("next") ?? "");
  if (!EMAIL_RE.test(email)) {
    redirect("/signin?error=invalid");
  }

  const token = await createLoginToken(email);
  await sendEmail({
    to: email,
    subject: "Your Tab sign-in link",
    text: `Open this link to sign in to Tab (valid for 15 minutes):\n\n${loginUrl(token)}${
      next ? `\n\nAfter signing in you will return to ${next}` : ""
    }`,
  });
  redirect(next ? `/signin?sent=1&next=${encodeURIComponent(next)}` : "/signin?sent=1");
}

/**
 * Complete signup after following a magic link for an email without an
 * account. Consumes the token atomically, creates the user, signs them in,
 * and honors any invite binding on the token.
 */
export async function completeSignUpAction(formData: FormData): Promise<void> {
  const token = String(formData.get("token") ?? "");
  const username = String(formData.get("username") ?? "").trim().toLowerCase();
  const displayName = String(formData.get("displayName") ?? "").trim();
  const next = String(formData.get("next") ?? "");

  if (!/^[a-z0-9_]{2,24}$/.test(username)) {
    redirect("/auth/signup?error=username&token=" + encodeURIComponent(token) + (next ? `&next=${encodeURIComponent(next)}` : ""));
  }
  if (!displayName || displayName.length > 60) {
    redirect("/auth/signup?error=name&token=" + encodeURIComponent(token) + (next ? `&next=${encodeURIComponent(next)}` : ""));
  }

  // Check username availability before consuming the token so the person can
  // retry with a different name without requesting a new link.
  const [nameTaken] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.username, username));
  if (nameTaken) {
    redirect("/auth/signup?error=username&token=" + encodeURIComponent(token) + (next ? `&next=${encodeURIComponent(next)}` : ""));
  }

  const consumed = await consumeLoginToken(token);
  if (!consumed) {
    redirect("/signin?error=expired");
  }

  let [user] = await db.select().from(users).where(eq(users.email, consumed.email));
  if (!user) {
    try {
      [user] = await db
        .insert(users)
        .values({ email: consumed.email, username, displayName })
        .returning();
    } catch {
      // Unique violation: someone registered this email mid-flight.
      const existing = await findUserByEmail(consumed.email);
      if (existing) {
        user = existing;
      } else {
        // Rare username race after token consumption; request a new link.
        redirect("/signin?error=expired");
      }
    }
  }
  if (!user) redirect("/signin?error=expired");

  await createSession(user.id);

  if (consumed.participantId != null) {
    try {
      await linkAccountToParticipant(consumed.participantId, user.id);
    } catch (e) {
      if (!(e instanceof ParticipantError)) throw e;
      // Claim conflicts are non-fatal; the person still gets signed in.
    }
  }

  revalidatePath("/", "layout");
  redirect(next || "/tabs");
}

export async function signOutAction(): Promise<void> {
  await destroySession();
  revalidatePath("/", "layout");
  redirect("/");
}
