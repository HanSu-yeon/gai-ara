"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { InstagramExportParseError, parseMutualsFromZip, suggestUsernameFromFilename } from "@gai-ara/ig-parser";
import { BrandHeader, Character, ConnectionSearchArt, Icon, Steps } from "@/components/Brand";
import { trackEvent } from "@/lib/analytics";

type Status = "intro" | "idle" | "parsing" | "uploading" | "success" | "error";

const CHALLENGE_RETURN_TO_PATTERN = /^\/t\/([A-Za-z0-9_-]+)$/;

/**
 * `/upload` — 2026-09-14 Instagram import 재도입. 카카오 로그인은 이미
 * 끝난 상태에서만 이 화면에 온다(`app/upload/page.tsx`의 서버 가드) —
 * 여기서는 로그인/참여자 생성을 하지 않는다. ZIP 파싱은 전부 브라우저에서
 * 일어나고(`@gai-ara/ig-parser`), 서버로는 "내 아이디"와 맞팔 목록만
 * 보낸다 — 원본 followers/following 전체 목록이나 ZIP 파일 자체는 절대
 * 보내지 않는다.
 *
 * 2026-09-15 협업형 챌린지 결정 — `returnTo`가 있으면(`/t/{token}`에서
 * "인스타에서 아는 사람 가져오기"로 들어온 경우) "나중에 할게요"와 업로드
 * 완료 후 CTA가 `/result` 대신 원래 챌린지로 돌아간다 — 사용자의 목적이
 * "업로드"가 아니라 "그 챌린지에 연결을 보태는 것"이기 때문이다.
 */
export function InstagramImportFlow({ startAtForm = false, returnTo = null }: { startAtForm?: boolean; returnTo?: string | null }) {
  const router = useRouter();
  const [status, setStatus] = useState<Status>(startAtForm ? "idle" : "intro");
  const [selfUsername, setSelfUsername] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mutualCount, setMutualCount] = useState<number | null>(null);

  function selectFile(selected: File | null) {
    setError(null);
    if (!selected) return;
    if (!selected.name.toLowerCase().endsWith(".zip")) {
      setFile(null);
      setError("ZIP 파일만 가져올 수 있어요.");
      return;
    }
    setFile(selected);
    setSelfUsername(suggestUsernameFromFilename(selected.name) ?? "");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!selfUsername.trim()) {
      setError("내 Instagram 아이디를 입력해주세요.");
      return;
    }
    if (!file) {
      setError("Instagram에서 받은 파일을 선택해주세요.");
      return;
    }

    try {
      setStatus("parsing");
      const mutualUsernames = await parseMutualsFromZip(file);

      setStatus("uploading");
      const response = await fetch("/api/instagram-import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ selfUsername, mutualUsernames }),
      });

      if (!response.ok) {
        const failure = await response.json().catch(() => null);
        throw new Error(typeof failure?.error === "string" ? failure.error : "가져오기에 실패했어요. 잠시 후 다시 시도해주세요.");
      }

      const result = (await response.json()) as { mutualCount: number };
      setMutualCount(result.mutualCount);

      // 2026-09-15 협업형 챌린지 결정 — `/t/{token}`에서 들어온 가져오기가
      // 실제로 완료된 시점에만 챌린지 참여로 등록한다(참여 = 이 순간
      // 이 참여자가 가진 전체 trusted network를 챌린지 시작점으로 써도
      // 된다는 뜻이므로, 방금 가져온 맞팔뿐 아니라 기존 confirmed
      // acquaintance 등도 함께 시작점이 된다). 실패해도 가져오기 자체의
      // 성공 화면은 그대로 보여준다 — 참여 등록은 부가 효과일 뿐이다.
      const challengeMatch = returnTo?.match(CHALLENGE_RETURN_TO_PATTERN);
      if (challengeMatch) {
        const challengeToken = challengeMatch[1];
        fetch(`/api/challenges/${challengeToken}/join`, { method: "POST" })
          .then(() => trackEvent("challenge_join", { source: "instagram_import" }))
          .catch(() => {});
      }

      setStatus("success");
    } catch (err) {
      setStatus("error");
      setError(
        err instanceof InstagramExportParseError
          ? err.message
          : err instanceof Error
            ? err.message
            : "알 수 없는 오류가 발생했어요.",
      );
    }
  }

  if (status === "intro") {
    return (
      <main className="brand-page upload-page">
        <BrandHeader back />
        <section className="upload-intro">
          <Character kind="curious" className="result-character" />
          <h1 className="upload-heading">더 많은 길을<br /><em>찾아볼까요?</em></h1>
          <p className="subtitle">
            인스타에서 아는 사람을 가져오면
            <br />
            건너건너 이어지는 길을
            <br />
            더 빠르게 찾을 수 있어요.
          </p>
        </section>
        <button type="button" className="primary-button" onClick={() => setStatus("idle")}>
          인스타에서 가져오기 <Icon name="arrow" />
        </button>
        <p className="status-caption">서로 팔로우하는 사람만 연결에 사용해요.</p>
        <Link href={returnTo ?? "/result"} className="text-link text-xs mt-4">나중에 할게요</Link>
      </main>
    );
  }

  if (status === "success") {
    return (
      <main className="brand-page upload-page">
        <BrandHeader />
        <Character kind="heart" className="result-character" />
        <h1 className="upload-heading">아는 사람 {mutualCount}명을<br />찾았어요</h1>
        <p className="subtitle">
          이제 이 사람들을 따라
          <br />
          어디까지 이어지는지 찾아볼 수 있어요.
        </p>
        <button type="button" className="primary-button mt-6" onClick={() => router.push(returnTo ?? "/result")}>
          {returnTo ? "챌린지로 돌아가기" : "이어진 사람 보기"} <Icon name="arrow" />
        </button>
      </main>
    );
  }

  if (status === "parsing" || status === "uploading") {
    return (
      <section className="analysis-state" role="status" aria-live="polite">
        <Steps active={1} />
        <h1 className="upload-heading">서로 아는 사람을<br /><em>찾고 있어요</em></h1>
        <ConnectionSearchArt />
        <p className="subtitle">조금만 기다려주세요.</p>
        <div className="progress-track" />
        <p className="status-caption">{status === "parsing" ? "파일에서 맞팔 관계를 확인하고 있어요…" : "가져오는 중이에요…"}</p>
      </section>
    );
  }

  return (
    <main className="brand-page upload-page">
      <BrandHeader back />
      <section className="upload-intro">
        <h1 className="upload-heading">인스타에서<br /><em>아는 사람 가져오기</em></h1>
        <p className="subtitle">
          받은 파일에서 서로 팔로우하는
          <br />
          사람만 찾아서 연결에 사용해요.
        </p>
      </section>
      <form onSubmit={handleSubmit} className="upload-form">
        <label
          className={`drop-zone ${dragging ? "dragging" : ""}`}
          onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => { event.preventDefault(); setDragging(false); selectFile(event.dataTransfer.files[0] ?? null); }}
        >
          <span className="feature-icon"><Icon name="upload" /></span>
          <strong>{file ? file.name : <>여기에 파일을 드래그하거나<br />눌러서 선택하세요</>}</strong>
          <small>{file ? `${(file.size / 1024 / 1024).toFixed(1)} MB · 눌러서 파일 변경` : "인스타에서 받은 파일만 가져올 수 있어요."}</small>
          <input
            id="zipFile"
            type="file"
            accept=".zip"
            aria-label="Instagram 데이터 파일 선택"
            onChange={(event) => selectFile(event.target.files?.[0] ?? null)}
          />
        </label>
        {file && (
          <div className="mt-6">
            <label htmlFor="selfUsername" className="field-label">내 계정이 맞나요?</label>
            <input
              id="selfUsername"
              value={selfUsername}
              onChange={(event) => setSelfUsername(event.target.value)}
              placeholder="내 Instagram 아이디"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              required
              pattern="@?[A-Za-z0-9._]{1,30}"
              className="username-input"
              aria-describedby="username-note"
            />
            <p id="username-note" className="text-xs text-ink/50">
              {suggestUsernameFromFilename(file.name) ? "파일명에서 찾은 아이디예요. 다르면 수정해주세요." : "파일명에서 아이디를 찾지 못했어요. 직접 입력해주세요."}
            </p>
          </div>
        )}
        {error && <div role="alert" className="error-message"><p>{error}</p></div>}
        <p className="status-caption mt-4">연결 계산에 필요한 정보만 사용해요.</p>
        <button type="submit" className="primary-button" disabled={!file}>
          {file ? "가져오기" : "파일을 먼저 선택해주세요"} <Icon name="arrow" />
        </button>
      </form>
      <Link href={returnTo ? `/upload/guide?returnTo=${encodeURIComponent(returnTo)}` : "/upload/guide"} className="text-link text-sm mt-4">어디서 받나요? →</Link>
    </main>
  );
}
