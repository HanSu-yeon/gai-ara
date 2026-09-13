import NextAuth from "next-auth";
import { NextResponse, type NextRequest } from "next/server";
import { authOptions } from "@/lib/auth";
import { isKakaoAuthConfigured } from "@/lib/env";

/**
 * 카카오 로그인 시작/콜백을 모두 여기서 처리한다(v2 명세 §3.1) — 개별
 * `/api/auth/kakao/start`·`/callback` 엔드포인트를 따로 만들지 않는다.
 * 카카오 앱 키가 아직 없는 환경에서는(§Implementation Preconditions)
 * Auth.js 내부 로직까지 들어가지 않고 여기서 먼저 명확한 503을 준다.
 */
const handler = NextAuth(authOptions);

type RouteContext = { params: Promise<{ nextauth: string[] }> };

export async function GET(request: NextRequest, context: RouteContext) {
  if (!isKakaoAuthConfigured()) {
    return NextResponse.json({ error: "카카오 로그인이 아직 설정되지 않았어요. 잠시 후 다시 시도해주세요." }, { status: 503 });
  }
  return handler(request, context);
}

export async function POST(request: NextRequest, context: RouteContext) {
  if (!isKakaoAuthConfigured()) {
    return NextResponse.json({ error: "카카오 로그인이 아직 설정되지 않았어요. 잠시 후 다시 시도해주세요." }, { status: 503 });
  }
  return handler(request, context);
}
