import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { getDb, sessions } from "@gai-ara/db";

const SESSION_COOKIE = "gaiara_session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 180; // 180일

/** 현재 요청의 세션 쿠키로부터 participantId를 찾는다. 없거나 만료면 null. */
export async function getSessionParticipantId(): Promise<string | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const db = getDb();
  const [row] = await db
    .select({ participantId: sessions.participantId, expiresAt: sessions.expiresAt })
    .from(sessions)
    .where(eq(sessions.token, token))
    .limit(1);

  if (!row) return null;
  if (row.expiresAt.getTime() < Date.now()) return null;

  return row.participantId;
}

/** participantId를 위한 새 세션을 만들고 httpOnly 쿠키로 내려준다. */
export async function createSession(participantId: string): Promise<void> {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

  const db = getDb();
  await db.insert(sessions).values({ token, participantId, expiresAt });

  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}
