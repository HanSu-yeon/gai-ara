"use client";

import { useState, type FormEvent } from "react";
import { Character, ConnectionSearchArt, Icon, PrivacyNote, Steps } from "@/components/Brand";
import { InstagramExportParseError, parseFollowingFromZip, suggestUsernameFromFilename } from "@gai-ara/ig-parser";

type Status = "idle" | "parsing" | "uploading" | "error";

interface UploadFlowProps {
  onUploaded: () => void | Promise<void>;
}

/**
 * ZIP 파싱은 전부 브라우저에서 일어난다 (@gai-ara/ig-parser).
 * 서버로는 정규화된 "내 아이디"와 내가 팔로우하는 사람 목록만 전송한다.
 * followers는 아예 받지 않는다 — 맞팔 여부는 서버가 두 참여자의 following을
 * 대조해서 판정한다.
 */
export function UploadFlow({ onUploaded }: UploadFlowProps) {
  const [selfUsername, setSelfUsername] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!selfUsername.trim()) {
      setError("내 Instagram 아이디를 입력해주세요.");
      return;
    }
    if (!file) {
      setError("Instagram에서 받은 ZIP 파일을 선택해주세요.");
      return;
    }

    try {
      setStatus("parsing");
      const followingUsernames = await parseFollowingFromZip(file, selfUsername);

      setStatus("uploading");
      const response = await fetch("/api/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ selfUsername, followingUsernames }),
      });

      if (!response.ok) {
        const failure = await response.json().catch(() => null);
        throw new Error(typeof failure?.error === "string" ? failure.error : "업로드에 실패했어요. 잠시 후 다시 시도해주세요.");
      }

      await onUploaded();
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

  const busy = status === "parsing" || status === "uploading";

  function selectFile(selected: File | null) {
    setError(null);
    if (!selected) return;
    if (!selected.name.toLowerCase().endsWith(".zip")) {
      setFile(null);
      setError("ZIP 파일만 업로드할 수 있어요.");
      return;
    }
    setFile(selected);
    setSelfUsername(suggestUsernameFromFilename(selected.name) ?? "");
  }

  if (busy) return <section className="analysis-state" role="status" aria-live="polite">
    <Steps active={1} />
    <h1 className="upload-heading">우리 사이의 연결을<br /><em>찾고 있어요</em></h1>
    <ConnectionSearchArt />
    <p className="subtitle">조금만 기다려주세요.<br />몇 다리 건너 연결되어 있을까요?</p>
    <div className="progress-track" />
    <p className="status-caption">{status === "parsing" ? "파일에서 팔로잉 목록을 확인하고 있어요…" : "연결을 분석하고 있어요…"}</p>
  </section>;

  return (
    <form onSubmit={handleSubmit} className="upload-form">
      <label className={`drop-zone ${dragging ? "dragging" : ""}`}
        onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => { event.preventDefault(); setDragging(false); selectFile(event.dataTransfer.files[0] ?? null); }}>
        <span className="feature-icon"><Icon name="upload" /></span>
        <strong>{file ? file.name : <>여기에 ZIP 파일을 드래그하거나<br />눌러서 선택하세요</>}</strong>
        <small>{file ? `${(file.size / 1024 / 1024).toFixed(1)} MB · 눌러서 파일 변경` : "ZIP 파일만 업로드할 수 있어요."}</small>
        <input id="zipFile" type="file" accept=".zip" aria-label="Instagram 데이터 ZIP 파일 선택"
          onChange={(event) => selectFile(event.target.files?.[0] ?? null)} />
      </label>
      {file && <div className="mt-6">
        <label htmlFor="selfUsername" className="field-label">내 계정이 맞나요?</label>
        <input id="selfUsername" value={selfUsername} onChange={(event) => setSelfUsername(event.target.value)}
          placeholder="내 Instagram 아이디" autoCapitalize="none" autoCorrect="off" spellCheck={false}
          required pattern="@?[A-Za-z0-9._]{1,30}" className="username-input" aria-describedby="username-note" />
        <p id="username-note" className="text-xs text-ink/50">{suggestUsernameFromFilename(file.name) ? "파일명에서 찾은 아이디예요. 다르면 수정해주세요." : "파일명에서 아이디를 찾지 못했어요. 직접 입력해주세요."}</p>
      </div>}
      {error && <div role="alert" className="error-message"><p>{error}</p></div>}
      <PrivacyNote />
      <button type="submit" className="primary-button" disabled={!file}>{file ? "내 계정이 맞아요 · 계속하기" : "파일을 먼저 선택해주세요"} <Icon name="arrow" /></button>
    </form>
  );
}
