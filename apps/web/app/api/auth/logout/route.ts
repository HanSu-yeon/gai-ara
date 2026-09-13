import { NextResponse } from "next/server";
import { destroySession } from "@/lib/session";

/** 로그아웃: 세션 쿠키와 DB 행을 지운다. Auth.js 자체 세션은 애초에 인증 판단에 쓰지 않으므로 별도로 지울 필요가 없다. */
export async function POST() {
  await destroySession();
  return NextResponse.json({ ok: true });
}
