import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { and, eq, gt, isNull, lt, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { authTokens, sessions, users } from "@/db/schema";

export const SESSION_COOKIE = "tab_session";
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const LOGIN_TOKEN_TTL_MS = 15 * 60 * 1000;
/** Renew the session row once less than this much lifetime remains. */
const SESSION_RENEW_THRESHOLD_MS = 7 * 24 * 60 * 60 * 1000;

export function generateToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function appBaseUrl(): string {
  return process.env.NEXT_APP_URL ?? "http://localhost:3000";
}

export async function createLoginToken(email: string, participantId?: number): Promise<string> {
  const token = generateToken();
  await db.insert(authTokens).values({
    email: normalizeEmail(email),
    tokenHash: hashToken(token),
    purpose: participantId != null ? "invite" : "signin",
    participantId: participantId ?? null,
    expiresAt: new Date(Date.now() + LOGIN_TOKEN_TTL_MS),
  });
  return token;
}

export interface ConsumedToken {
  email: string;
  participantId: number | null;
}

export interface PeekedToken {
  email: string;
  participantId: number | null;
  hasAccount: boolean;
}

/** Validate without consuming — lets the verify step decide where to go. */
export async function peekLoginToken(token: string): Promise<PeekedToken | null> {
  const [row] = await db
    .select({ email: authTokens.email, participantId: authTokens.participantId })
    .from(authTokens)
    .where(
      and(
        eq(authTokens.tokenHash, hashToken(token)),
        isNull(authTokens.usedAt),
        gt(authTokens.expiresAt, new Date()),
      ),
    );
  if (!row) return null;
  const user = await findUserByEmail(row.email);
  return { email: row.email, participantId: row.participantId, hasAccount: user != null };
}

/** Single-use consumption: expired or already-used tokens return null. */
export async function consumeLoginToken(token: string): Promise<ConsumedToken | null> {
  const [row] = await db
    .update(authTokens)
    .set({ usedAt: new Date() })
    .where(
      and(
        eq(authTokens.tokenHash, hashToken(token)),
        isNull(authTokens.usedAt),
        gt(authTokens.expiresAt, new Date()),
      ),
    )
    .returning();
  if (!row) return null;
  return { email: row.email, participantId: row.participantId };
}

export async function createSession(userId: number): Promise<void> {
  const token = generateToken();
  await db.insert(sessions).values({
    userId,
    tokenHash: hashToken(token),
    expiresAt: new Date(Date.now() + SESSION_TTL_MS),
  });
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_MS / 1000,
  });
}

export interface SessionUser {
  id: number;
  email: string;
  username: string;
  displayName: string;
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const [row] = await db
    .select({
      sessionId: sessions.id,
      expiresAt: sessions.expiresAt,
      id: users.id,
      email: users.email,
      username: users.username,
      displayName: users.displayName,
    })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(and(eq(sessions.tokenHash, hashToken(token)), gt(sessions.expiresAt, new Date())));
  if (!row) return null;

  const remaining = row.expiresAt.getTime() - Date.now();
  if (remaining < SESSION_TTL_MS - SESSION_RENEW_THRESHOLD_MS) {
    await db
      .update(sessions)
      .set({ expiresAt: new Date(Date.now() + SESSION_TTL_MS) })
      .where(eq(sessions.id, row.sessionId));
  }

  return {
    id: row.id,
    email: row.email,
    username: row.username,
    displayName: row.displayName,
  };
}

export async function requireSession(nextPath?: string): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) {
    redirect(nextPath ? `/signin?next=${encodeURIComponent(nextPath)}` : "/signin");
  }
  return user;
}

export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (token) {
    await db.delete(sessions).where(eq(sessions.tokenHash, hashToken(token)));
  }
  cookieStore.delete(SESSION_COOKIE);
}

export async function findUserByEmail(email: string) {
  const [row] = await db
    .select()
    .from(users)
    .where(eq(users.email, normalizeEmail(email)));
  return row ?? null;
}

export async function purgeStaleAuthTokens(): Promise<void> {
  await db
    .delete(authTokens)
    .where(or(lt(authTokens.expiresAt, new Date()), sql`${authTokens.usedAt} is not null`));
}
