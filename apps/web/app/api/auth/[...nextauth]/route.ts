import NextAuth from "next-auth";
import { NextResponse, type NextRequest } from "next/server";
import { authOptions } from "@/lib/auth";
import { isGoogleAuthConfigured, isKakaoAuthConfigured } from "@/lib/env";

/**
 * 카카오/Google 로그인 시작/콜백을 모두 여기서 처리한다(v2 명세 §3.1,
 * 2026-09-16 Google 추가) — 개별 `/api/auth/<provider>/start`·`/callback`
 * 엔드포인트를 따로 만들지 않는다. 각 제공자 앱 키가 아직 없는 환경에서는
 * (§Implementation Preconditions) Auth.js 내부 로직까지 들어가지 않고 여기서
 * 먼저 명확한 503을 준다. 두 제공자를 같은 라우트에서 처리하므로, 한쪽
 * 키만 없다고 다른 쪽까지 막지 않도록 요청 경로의 provider 세그먼트만
 * 보고 해당 제공자만 가드한다 — `/session`·`/csrf`·`/providers` 같은
 * provider-무관 경로는 그대로 통과시킨다.
 */
const handler = NextAuth(authOptions);

type RouteContext = { params: Promise<{ nextauth: string[] }> };

const PROVIDER_CONFIG_CHECK: Record<string, () => boolean> = {
  kakao: isKakaoAuthConfigured,
  google: isGoogleAuthConfigured,
};

const PROVIDER_NAME_KO: Record<string, string> = {
  kakao: "카카오",
  google: "Google",
};

/** `nextauth` 경로 세그먼트에서 provider 슬러그를 뽑는다(signin/callback/signout만 provider를 가진다). */
function unconfiguredProvider(segments: string[]): string | null {
  const [action, provider] = segments;
  if (!provider || !["signin", "callback", "signout"].includes(action ?? "")) return null;
  const isConfigured = PROVIDER_CONFIG_CHECK[provider];
  if (!isConfigured || isConfigured()) return null;
  return provider;
}

async function handleRequest(request: NextRequest, context: RouteContext) {
  const { nextauth } = await context.params;
  const blockedProvider = unconfiguredProvider(nextauth);
  if (blockedProvider) {
    const name = PROVIDER_NAME_KO[blockedProvider] ?? blockedProvider;
    return NextResponse.json(
      { error: `${name} 로그인이 아직 설정되지 않았어요. 잠시 후 다시 시도해주세요.` },
      { status: 503 },
    );
  }
  return handler(request, context);
}

export const GET = handleRequest;
export const POST = handleRequest;
