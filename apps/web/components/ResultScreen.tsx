"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { MeResult, ReferralLink } from "@gai-ara/shared";
import { BigNumberCard } from "@/components/BigNumberCard";
import { BrandHeader, Character, Icon } from "@/components/Brand";
import { trackEvent } from "@/lib/analytics";

/**
 * 1:1 "우리 몇 다리 링크"(pair invite) 생성 UI는 의도적으로 여기서 뺐다 —
 * API/DB(`/api/invites`, `pair_invites`)와 `/pair/[token]` 화면은 그대로
 * 살아있고, 코드도 그대로 있다. 지금 이 서비스의 기본 흐름은 "내 링크"
 * 하나(만들기 → 여러 명에게 보내기 → 각자 결과 확인)라서, 화면에는 그것만
 * 보여준다. "특정 친구와 서로 결과를 같이 보고 싶다"는 니즈가 실제로
 * 생기면 이 화면에 다시 노출하면 된다.
 */
export function ResultScreen({ preview = false }: { preview?: boolean }) {
  const [result, setResult] = useState<MeResult | null>(preview ? { distanceCounts: { direct: 12, within2: 84, within3: 216 }, recoveryToken: "preview" } : null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [referralLink, setReferralLink] = useState<ReferralLink | null>(preview ? { token: "preview", nickname: null, visits: [{ nickname: "미리보기", status: "connected", distance: 1 }] } : null);
  const [referralNickname, setReferralNickname] = useState("");
  const [referralCreating, setReferralCreating] = useState(false);
  const [referralError, setReferralError] = useState<string | null>(null);
  const [referralCopied, setReferralCopied] = useState(false);
  const [editingNickname, setEditingNickname] = useState(false);
  const [recoveryCopied, setRecoveryCopied] = useState(false);
  const [recoveryError, setRecoveryError] = useState<string | null>(null);

  useEffect(() => {
    if (preview) return;
    fetch("/api/referral-link")
      .then(async (response) => (response.ok ? (await response.json()) as ReferralLink : null))
      .then((link) => {
        setReferralLink(link);
        if (link?.nickname) setReferralNickname(link.nickname);
      })
      .catch(() => {});
  }, [preview]);

  /** 링크가 없으면 새로 만들고, 이미 있으면 닉네임만 갱신한다(둘 다 같은 upsert). */
  async function handleCreateReferralLink() {
    if (preview) { setEditingNickname(false); return; }
    setReferralCreating(true); setReferralError(null);
    try {
      const response = await fetch("/api/referral-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nickname: referralNickname.trim() || undefined }),
      });
      if (!response.ok) throw new Error("링크를 만들지 못했어요. 잠시 후 다시 시도해주세요.");
      const link = (await response.json()) as ReferralLink;
      setReferralLink(link);
      setReferralCopied(false);
      setEditingNickname(false);
      trackEvent(referralLink ? "referral_link_nickname_update" : "referral_link_create");
    } catch (err) { setReferralError(err instanceof Error ? err.message : "연결 상태를 확인해주세요."); }
    finally { setReferralCreating(false); }
  }

  async function handleCopyReferralLink() {
    if (!referralLink) return;
    if (preview) { setReferralCopied(true); return; }
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/r/${referralLink.token}`);
      setReferralCopied(true);
      trackEvent("referral_link_copy");
    } catch { setReferralError("자동 복사가 되지 않아요. 링크를 길게 눌러 직접 복사해주세요."); }
  }

  async function handleCopyRecoveryLink() {
    if (!result) return;
    if (preview) { setRecoveryCopied(true); return; }
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/result/${result.recoveryToken}`);
      setRecoveryCopied(true);
    } catch { setRecoveryError("자동 복사가 되지 않아요. 링크를 길게 눌러 직접 복사해주세요."); }
  }

  async function loadResult() {
    const response = await fetch("/api/me/result");
    if (!response.ok) throw new Error("아직 참여 기록이 없어요. 먼저 파일을 업로드해주세요.");
    return await response.json() as MeResult;
  }

  useEffect(() => {
    if (preview) return;
    loadResult().then(setResult).catch(() => setError("결과를 불러오지 못했어요. 참여 기록과 연결 상태를 확인해주세요."));
  }, [preview]);

  /**
   * participant-only 모델에서는 다른 사람이 참여할수록 내 연결 수가 늘어날 수
   * 있어서(내가 딱히 뭘 안 해도), "다시 확인" 버튼을 눌러 브라우저 새로고침
   * 없이 최신 값을 다시 불러온다.
   */
  async function handleRefresh() {
    if (preview || refreshing) return;
    setRefreshing(true);
    try {
      setResult(await loadResult());
    } catch {
      // 조용히 무시 — 기존 숫자를 계속 보여준다.
    } finally {
      setRefreshing(false);
    }
  }

  return <main className="brand-page result-page"><BrandHeader home />
    {error ? <><Character kind="search" className="result-character" /><h1 className="upload-heading">결과를 확인할 수 없어요</h1><p className="subtitle" role="alert">{error}</p><Link href="/upload" className="primary-button mt-8">파일 업로드하기 <Icon name="arrow" /></Link></>
    : !result ? <section className="analysis-state" role="status"><h1 className="upload-heading">연결을 찾고 있어요</h1><Character kind="search" /><p className="subtitle">결과를 계산하고 있어요…</p><div className="progress-track" /></section>
    : <><p className="handwritten">분석이 완료됐어요!</p><h1 className="upload-heading">이제, 내 링크를<br /><em>만들어볼까요?</em></h1><p className="subtitle">여러 명에게 보내면, 각자 나와<br />몇 다리 건너 아는 사이인지 확인할 수 있어요.</p>
      <Character kind="heart" className="result-character" />
      {referralLink ? <>
        <div className="invite-box"><input aria-label="내 링크" value={`${typeof window !== "undefined" ? window.location.origin : ""}/r/${referralLink.token}`} readOnly onFocus={(event) => event.target.select()} /><button onClick={handleCopyReferralLink}>{referralCopied ? "복사했어요!" : "내 링크 복사하기"}</button></div>
        {editingNickname ? <>
          <input className="username-input mb-3 mt-3" value={referralNickname} onChange={(event) => setReferralNickname(event.target.value)}
            placeholder="내 닉네임 (선택, 방문자에게 보여요)" maxLength={20} aria-label="내 링크 닉네임" autoFocus />
          <div className="flex gap-2">
            <button type="button" className="primary-button flex-1" onClick={handleCreateReferralLink} disabled={referralCreating}>{referralCreating ? "저장하는 중…" : "저장하기"}</button>
            <button type="button" className="text-link text-xs" onClick={() => { setEditingNickname(false); setReferralNickname(referralLink.nickname ?? ""); }}>취소</button>
          </div>
        </> : (
          <button type="button" className="text-link text-xs mt-3" onClick={() => setEditingNickname(true)}>
            {referralLink.nickname ? `닉네임 "${referralLink.nickname}" 수정` : "닉네임 설정하기"}
          </button>
        )}
        <Link href="/connections" className="text-link text-xs mt-3">
          {referralLink.visits.length > 0 ? `내 링크로 만난 사람 ${referralLink.visits.length}명 보기` : "내 연결 목록 보기"} →
        </Link>
      </> : <>
        <input className="username-input mb-3" value={referralNickname} onChange={(event) => setReferralNickname(event.target.value)}
          placeholder="내 닉네임 (선택, 방문자에게 보여요)" maxLength={20} aria-label="내 링크 닉네임" />
        <button className="primary-button" onClick={handleCreateReferralLink} disabled={referralCreating}><Icon name="link" />{referralCreating ? "만드는 중…" : "내 링크 만들기"}<Icon name="arrow" /></button>
      </>}
      {referralError && <p className="error-message" role="alert">{referralError}</p>}
      <p className="result-note" aria-live="polite">{referralCopied ? "링크를 복사했어요. 친구에게 보내보세요!" : <>방문자가 남기고 싶어 하면 닉네임과 거리만 보여요.<br />중간에 누구를 통해 연결됐는지는 알 수 없어요.</>}</p>
      <section className="mt-8 border-t border-ink/10 pt-6">
        <div className="flex items-center justify-between"><h2 className="font-bold text-deep-green">내 연결 결과</h2><button type="button" className="text-link text-xs" onClick={handleRefresh} disabled={refreshing}>{refreshing ? "확인 중…" : "다시 확인하기"}</button></div>
        <div className="result-counts"><BigNumberCard label="직접 연결" value={result.distanceCounts.direct} /><BigNumberCard label="2다리 안" value={result.distanceCounts.within2} /><BigNumberCard label="3다리 안" value={result.distanceCounts.within3} /></div>
        {result.distanceCounts.direct === 0 && <p className="result-note">아직 가이 알아?에서 확인된 연결이 없어요. 친구를 초대하면 첫 연결이 생겨요!</p>}
        <p className="result-note mt-4">이 링크를 저장해두면 다른 기기나 브라우저에서도 내 결과를 다시 볼 수 있어요.</p>
        <div className="invite-box"><input aria-label="내 결과 저장 링크" value={`${typeof window !== "undefined" ? window.location.origin : ""}/result/${result.recoveryToken}`} readOnly onFocus={(event) => event.target.select()} /><button onClick={handleCopyRecoveryLink}>{recoveryCopied ? "복사했어요!" : "복사하기"}</button></div>
        {recoveryError && <p className="error-message" role="alert">{recoveryError}</p>}
      </section>
</>}
  </main>;
}
