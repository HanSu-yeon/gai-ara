"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import type { SessionInfo } from "@gai-ara/shared";
import { BrandHeader, Character } from "@/components/Brand";
import { loginPathFor } from "@/lib/return-to";

type ScreenState = "loading" | "logged-out" | "needs-name";

/**
 * 화면 02(로그인·표시 이름). 카카오 로그인은 `signIn("kakao")`로 시작하고,
 * 로그인 성공 후 서버 콜백(`apps/web/lib/auth.ts`의 `signIn` 콜백)이 표시
 * 이름 여부에 따라 다시 이 페이지로(없으면) 또는 `/result`로(있으면)
 * 리다이렉트한다 — 이 컴포넌트는 그 두 상태(로그인 전/이름 입력 전)만
 * 그린다. 이미 이름까지 설정된 상태로 이 페이지를 열면 `/result`로
 * 보낸다.
 *
 * 2026-09-15 "마지막 연결자 공개" 결정 — 이름 입력 화면의 "길의 마지막
 * 연결자가 되면 이 이름이 챌린지에 표시될 수 있어요" 문구가 곧 동의
 * 고지다. 별도 동의 화면/체크박스는 없다 — 이 문구를 보여준 뒤
 * `handleSubmitName`이 호출하는 `PATCH /api/me/display-name`이 표시
 * 이름을 처음 저장하는 그 순간에 `publicConnectorNameConsentAt`도 함께
 * 기록된다(`apps/web/lib/participants.ts`의 `setDisplayName`). 이 화면은
 * `hasDisplayName`이 없을 때만 보이므로(이미 이름이 있으면 위에서 바로
 * `/result`로 리다이렉트), 이 문구는 정확히 "표시 이름을 최초로 정하는"
 * 시점에만 노출된다 — 이 기능 도입 전에 이미 이름을 정한 기존 사용자는
 * 이 문구를 본 적이 없고, 그래서 동의도 없다(기본값 익명 유지).
 */
export default function LoginScreen({
  returnTo = null,
}: {
  returnTo?: string | null;
}) {
  const router = useRouter();
  const [state, setState] = useState<ScreenState>("loading");
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/session")
      .then(async (response) =>
        response.ok
          ? ((await response.json()) as SessionInfo)
          : { active: false, hasDisplayName: false },
      )
      .then((session) => {
        if (session.active && session.hasDisplayName) {
          router.replace(returnTo ?? "/");
          return;
        }
        setState(session.active ? "needs-name" : "logged-out");
      })
      .catch(() => setState("logged-out"));
  }, [returnTo, router]);

  async function handleSubmitName() {
    const trimmed = name.trim();
    if (!trimmed) return;
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch("/api/me/display-name", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName: trimmed }),
      });
      if (!response.ok)
        throw new Error("이름을 저장하지 못했어요. 다시 시도해주세요.");
      router.replace(returnTo ?? "/");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "이름을 저장하지 못했어요. 다시 시도해주세요.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (state === "loading") {
    return (
      <main className="brand-page">
        <BrandHeader home />
        <p className="subtitle">불러오는 중…</p>
      </main>
    );
  }

  if (state === "logged-out") {
    return (
      <main className="brand-page login-page">
        <BrandHeader home />
        <section className="login-content" aria-labelledby="login-title">
          <Character kind="default" className="login-character" />
          <h1 id="login-title" className="login-title">
            먼저, 나를 알려주세요
          </h1>
          <p className="subtitle">
            내가 아는 사람들과 이어지려면
            <br />
            로그인이 필요해요.
          </p>
          <button
            type="button"
            className="kakao-button"
            onClick={() =>
              signIn("kakao", {
                callbackUrl: returnTo ? loginPathFor(returnTo) : "/login",
              })
            }
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 3C6.48 3 2 6.58 2 11c0 2.88 1.9 5.4 4.75 6.81L5.7 21l3.78-2.15c.81.15 1.65.23 2.52.23 5.52 0 10-3.58 10-8.08S17.52 3 12 3Z" />
            </svg>
            카카오로 계속하기
          </button>
          <p className="login-note">
            로그인은 나를 구분하기 위해서만 사용해요.
          </p>
        </section>
      </main>
    );
  }

  return (
    <main className="brand-page login-page">
      <BrandHeader home />
      <section
        className="login-content name-content"
        aria-labelledby="display-name-title"
      >
        <Character kind="default" className="name-character" />
        <h1 id="display-name-title" className="upload-heading">
          어떤 이름으로
          <br />
          불릴까요?
        </h1>
        <input
          className="username-input mt-4"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="이름 또는 닉네임"
          maxLength={30}
          aria-label="이름 또는 닉네임"
        />
        <button
          type="button"
          className="primary-button"
          onClick={handleSubmitName}
          disabled={submitting || !name.trim()}
        >
          {submitting ? "저장하는 중…" : "이 이름으로 시작하기"}
        </button>
        {error && (
          <p className="error-message" role="alert">
            {error}
          </p>
        )}
        <p className="result-note mt-4">
          실명이 아니어도 괜찮아요.
          <br />
          길의 마지막 연결자가 되면 이 이름이 챌린지에 표시될 수 있어요.
        </p>
      </section>
    </main>
  );
}
