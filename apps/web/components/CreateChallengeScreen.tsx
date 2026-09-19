"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { CreateChallengeResult } from "@gai-ara/shared";
import { BrandHeader, Character } from "@/components/Brand";
import { trackEvent } from "@/lib/analytics";

/**
 * `/create` — 2026-09-15 협업형 챌린지 결정. 운영자가 유명인 DB를 미리
 * 만드는 구조가 아니다 — 사용자가 직접 "궁금한 사람"을 지정해 챌린지를
 * 만든다(연예인으로 한정하지 않는다). `displayName`은 챌린지 화면에 보여줄
 * 표시 이름일 뿐, Instagram API·profile scraping으로 검증하지 않는다 —
 * 오타·별명이어도 그대로 저장하고 그대로 보여준다는 걸 화면 카피에서도
 * 분명히 한다.
 *
 * 이 화면은 로그인 + 표시 이름 설정을 먼저 마쳐야 한다(`app/create/page.tsx`
 * 서버 가드) — 만든 사람이 자기 기존 trusted network를 챌린지의 시작점으로
 * 곧바로 쓸 수 있어야 하기 때문이다(`POST /api/challenges`가 생성자를
 * 자동으로 첫 참여자로 등록한다).
 *
 * 2026-09-15 추가 결정 — 같은 target(정규화된 username의 해시 기준)으로
 * 이미 챌린지가 있으면 `POST /api/challenges`가 `status: "duplicate"`를
 * 돌려준다. 이때 조용히 자동 합류시키지 않고, "이미 있어요" 화면을 먼저
 * 보여준 뒤 사용자가 "챌린지에 합류하기"를 명시적으로 눌렀을 때만
 * `POST /api/challenges/{token}/join`을 호출한다. 이번 MVP에서는 "새
 * 챌린지 만들기" 같은 대안을 제공하지 않는다 — 같은 target에 대한 참여가
 * 여러 챌린지로 쪼개지는 것을 막기 위해서다.
 */
export default function CreateChallengeScreen() {
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");
  const [instagramUsername, setInstagramUsername] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [duplicate, setDuplicate] = useState<{
    token: string;
    displayName: string;
  } | null>(null);
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedName = displayName.trim();
    const trimmedUsername = instagramUsername.trim();
    if (!trimmedName || !trimmedUsername) return;

    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch("/api/challenges", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName: trimmedName,
          instagramUsername: trimmedUsername,
        }),
      });
      if (!response.ok)
        throw new Error("챌린지를 만들지 못했어요. 잠시 후 다시 시도해주세요.");
      const result = (await response.json()) as CreateChallengeResult;

      if (result.status === "duplicate") {
        setDuplicate({ token: result.token, displayName: result.displayName });
        setSubmitting(false);
        return;
      }

      trackEvent("challenge_create");
      router.push(`/t/${result.token}`);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "챌린지를 만들지 못했어요. 잠시 후 다시 시도해주세요.",
      );
      setSubmitting(false);
    }
  }

  async function handleJoinExisting() {
    if (!duplicate) return;
    setJoining(true);
    setJoinError(null);
    try {
      const response = await fetch(`/api/challenges/${duplicate.token}/join`, {
        method: "POST",
      });
      if (!response.ok) throw new Error();
      trackEvent("challenge_join", { source: "duplicate_create" });
      router.push(`/t/${duplicate.token}`);
    } catch {
      setJoinError("합류하지 못했어요. 잠시 후 다시 시도해주세요.");
      setJoining(false);
    }
  }

  if (duplicate) {
    return (
      <main className="brand-page">
        <BrandHeader back />
        <Character kind="curious" className="result-character" />
        <h1 className="upload-heading">
          이미 이 사람을 찾고 있는
          <br />
          챌린지가 있어요.
        </h1>
        <p className="subtitle">함께 연결을 모아볼까요?</p>
        <button
          type="button"
          className="primary-button mt-6"
          onClick={handleJoinExisting}
          disabled={joining}
        >
          {joining ? "합류하는 중…" : "챌린지에 합류하기"}
        </button>
        {joinError && (
          <p className="error-message" role="alert">
            {joinError}
          </p>
        )}
      </main>
    );
  }

  return (
    <main className="brand-page">
      <BrandHeader back />
      <Character kind="curious" className="result-character" />
      <h1 className="upload-heading">
        누구까지
        <br />
        이어질 수 있을까요?
      </h1>
      <p className="subtitle">
        궁금한 사람의 이름과 인스타 아이디를 적으면
        <br />
        함께 길을 찾아볼 수 있는 챌린지가 만들어져요.
      </p>
      {/* 2026-09-19 결정 — 공개 여부는 운영자만 켜므로, 만들기 전에 기본값을 알려준다. */}
      <p className="status-caption">
        만든 챌린지는 기본적으로 공개 목록에 뜨지 않아요. 링크를 아는 사람만 열어볼 수 있어요.
      </p>
      <form onSubmit={handleSubmit} className="upload-form">
        <div className="mt-6">
          <label htmlFor="challengeDisplayName" className="field-label">
            이름
          </label>
          <input
            id="challengeDisplayName"
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            placeholder="예: 감귤"
            maxLength={30}
            required
            className="username-input"
          />
        </div>
        <div className="mt-4">
          <label htmlFor="challengeInstagramUsername" className="field-label">
            Instagram 아이디
          </label>
          <input
            id="challengeInstagramUsername"
            value={instagramUsername}
            onChange={(event) => setInstagramUsername(event.target.value)}
            placeholder="예: @gai_ara"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            required
            pattern="@?[A-Za-z0-9._]{1,30}"
            className="username-input"
          />
          <p className="text-xs text-ink/50 mt-1">
            정확한 인스타 아이디를 입력해주세요.
          </p>
        </div>
        {error && (
          <div role="alert" className="error-message">
            <p>{error}</p>
          </div>
        )}
        <button
          type="submit"
          className="primary-button mt-6"
          disabled={
            submitting || !displayName.trim() || !instagramUsername.trim()
          }
        >
          {submitting ? "만드는 중…" : "챌린지 만들기"}
        </button>
      </form>
    </main>
  );
}
