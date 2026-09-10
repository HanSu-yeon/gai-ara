"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { MeResult } from "@gai-ara/shared";
import { BigNumberCard } from "@/components/BigNumberCard";
import { BrandHeader, Character, Icon } from "@/components/Brand";

export function ResultScreen({ preview = false }: { preview?: boolean }) {
  const [result, setResult] = useState<MeResult | null>(preview ? { distanceCounts: { direct: 12, within2: 84, within3: 216 }, totalParticipants: 300, percentileWithin3: 72 } : null);
  const [error, setError] = useState<string | null>(null);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (preview) return;
    fetch("/api/me/result").then(async (response) => {
      if (!response.ok) throw new Error("아직 참여 기록이 없어요. 먼저 파일을 업로드해주세요.");
      return await response.json() as MeResult;
    }).then(setResult).catch(() => setError("결과를 불러오지 못했어요. 참여 기록과 연결 상태를 확인해주세요."));
  }, [preview]);

  async function handleCreateInvite() {
    if (preview) {
      setInviteUrl(`${window.location.origin}/preview?screen=pair`);
      setCopied(false);
      return;
    }
    setCreating(true); setInviteError(null);
    try {
      const response = await fetch("/api/invites", { method: "POST" });
      if (!response.ok) throw new Error("링크를 만들지 못했어요. 잠시 후 다시 시도해주세요.");
      const { token } = await response.json() as { token: string };
      setInviteUrl(`${window.location.origin}/pair/${token}`); setCopied(false);
    } catch (err) { setInviteError(err instanceof Error ? err.message : "연결 상태를 확인해주세요."); }
    finally { setCreating(false); }
  }
  async function handleCopy() {
    if (!inviteUrl) return;
    try { await navigator.clipboard.writeText(inviteUrl); setCopied(true); setInviteError(null); }
    catch { setInviteError("자동 복사가 되지 않아요. 위 링크를 길게 눌러 직접 복사해주세요."); }
  }

  return <main className="brand-page result-page"><BrandHeader home />
    {error ? <><Character kind="search" className="result-character" /><h1 className="upload-heading">결과를 확인할 수 없어요</h1><p className="subtitle" role="alert">{error}</p><Link href="/upload" className="primary-button mt-8">파일 업로드하기 <Icon name="arrow" /></Link></>
    : !result ? <section className="analysis-state" role="status"><h1 className="upload-heading">연결을 찾고 있어요</h1><Character kind="search" /><p className="subtitle">결과를 계산하고 있어요…</p><div className="progress-track" /></section>
    : <><p className="handwritten">분석이 완료됐어요!</p><h1 className="upload-heading">이제, 아는 사람에게<br /><em>보내볼까요?</em></h1><p className="subtitle">링크를 보내고, 둘이 함께 참여하면<br />몇 다리 건너 아는 사이인지 찾아볼게요.</p>
      <Character kind="heart" className="result-character" />
      <button className="primary-button" onClick={handleCreateInvite} disabled={creating}><Icon name="link" />{creating ? "링크 만드는 중…" : inviteUrl ? "새 링크 만들기" : "링크 만들기"}<Icon name="arrow" /></button>
      {inviteUrl && <div className="invite-box"><input aria-label="친구 초대 링크" value={inviteUrl} readOnly onFocus={(event) => event.target.select()} /><button onClick={handleCopy}>{copied ? "복사했어요!" : "복사하기"}</button></div>}
      {inviteError && <p className="error-message" role="alert">{inviteError}</p>}
      <p className="result-note" aria-live="polite">{copied ? "링크를 복사했어요. 친구에게 보내보세요!" : "상대도 참여하면 둘 사이의 결과가 열려요."}</p>
      <section className="mt-8 border-t border-ink/10 pt-6"><h2 className="font-bold text-deep-green">내 제주 연결 결과</h2><div className="result-counts"><BigNumberCard label="직접 연결" value={result.distanceCounts.direct} /><BigNumberCard label="2다리 안" value={result.distanceCounts.within2} /><BigNumberCard label="3다리 안" value={result.distanceCounts.within3} /></div><p className="result-note">현재 참여자의 <strong className="text-deep-green">{result.percentileWithin3}%</strong>와 3다리 안에 연결되어 있어요.</p></section>
</>}
  </main>;
}
