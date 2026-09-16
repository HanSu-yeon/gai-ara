import type { NextAuthOptions } from "next-auth";
import KakaoProvider from "next-auth/providers/kakao";
import GoogleProvider from "next-auth/providers/google";
import { createSession } from "@/lib/session";
import { findOrCreateOAuthParticipant } from "@/lib/participants";

/**
 * TASK-003(v2), 2026-09-16 Google 추가 — Auth.js는 OAuth 핸드셰이크
 * (state/PKCE/토큰 교환)만 담당한다. Auth.js 자체 세션/JWT는 쓰지 않는다 —
 * `signIn` 콜백에서 `(provider, providerAccountId)`로 participant를 찾거나
 * 만든 뒤, 기존 `apps/web/lib/session.ts`의 httpOnly 쿠키 세션을 그대로
 * 발급한다(중복 세션 체계를 만들지 않기 위함, v2 명세 §3.1).
 *
 * OAuth 완료 후에는 `signIn()` 호출 때 전달한 내부 `callbackUrl`로 돌아간다.
 * 초대 링크에서 시작한 경우 원래 `/invite/{token}` 또는 `/r/{token}`을 보존하고,
 * 표시 이름이 없으면 해당 화면이 `/login?returnTo=...`으로 보내 이름 설정 뒤
 * 다시 원래 링크로 복귀시킨다.
 *
 * 각 제공자의 앱 키가 아직 없을 수 있으므로 빈 문자열을 기본값으로 둔다 —
 * 값이 없어도 타입체크/빌드는 통과해야 하고, 실제 로그인 요청은 라우트
 * 핸들러에서 `isKakaoAuthConfigured()`/`isGoogleAuthConfigured()`로 먼저
 * 막는다. 카카오와 Google로 각각 로그인한 동일 인물은 서로 다른
 * participant로 취급한다 — 계정 병합은 다루지 않는다(결정 로그 2026-09-16
 * "로그인 제공자에 Google 추가" 참고).
 */
export const authOptions: NextAuthOptions = {
  providers: [
    KakaoProvider({
      clientId: process.env.KAKAO_CLIENT_ID ?? "",
      clientSecret: process.env.KAKAO_CLIENT_SECRET ?? "",
    }),
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
    }),
  ],
  session: { strategy: "jwt" },
  callbacks: {
    async signIn({ account }) {
      if (
        !account ||
        (account.provider !== "kakao" && account.provider !== "google") ||
        !account.providerAccountId
      )
        return false;

      const participantId = await findOrCreateOAuthParticipant(account.provider, account.providerAccountId);
      await createSession(participantId);

      return true;
    },
  },
};
