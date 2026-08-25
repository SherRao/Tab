import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { events, participants } from "@/db/schema";
import {
  consumeLoginToken,
  createSession,
  findUserByEmail,
  peekLoginToken,
} from "@/lib/auth";
import { linkAccountToParticipant, ParticipantError } from "@/lib/participants";

async function eventPathFor(participantId: number): Promise<string | null> {
  const [row] = await db
    .select({ shareToken: events.shareToken })
    .from(participants)
    .innerJoin(events, eq(participants.eventId, events.id))
    .where(eq(participants.id, participantId));
  return row ? `/e/${row.shareToken}` : null;
}

async function tryClaim(participantId: number, userId: number): Promise<void> {
  try {
    await linkAccountToParticipant(participantId, userId);
  } catch (e) {
    if (!(e instanceof ParticipantError)) throw e;
    // Claim conflicts are non-fatal; the person still gets signed in.
  }
}

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const token = url.searchParams.get("token") ?? "";
  const next = url.searchParams.get("next");

  const peeked = token ? await peekLoginToken(token) : null;
  if (!peeked) {
    redirect("/signin?error=expired");
  }

  const target =
    next ||
    (peeked.participantId != null ? await eventPathFor(peeked.participantId) : null) ||
    "/tabs";

  if (peeked.hasAccount) {
    const consumed = await consumeLoginToken(token);
    if (!consumed) redirect("/signin?error=expired");
    const user = await findUserByEmail(consumed.email);
    if (!user) redirect("/signin?error=expired");
    await createSession(user.id);
    if (consumed.participantId != null) {
      await tryClaim(consumed.participantId, user.id);
    }
    revalidatePath("/", "layout");
    redirect(target);
  }

  // No account yet: send to signup completion; the token stays unconsumed
  // so the form submission can consume it atomically.
  const signupUrl = new URL("/auth/signup", url.origin);
  signupUrl.searchParams.set("token", token);
  if (next) signupUrl.searchParams.set("next", next);
  redirect(signupUrl.toString());
}
