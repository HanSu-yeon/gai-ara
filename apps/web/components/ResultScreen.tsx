"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { MeResult, ReferralLink } from "@gai-ara/shared";
import { BrandHeader, Character, Icon } from "@/components/Brand";
import { MiniConnectionGraph } from "@/components/MiniConnectionGraph";

/**
 * 화면 06 — "내가 지금 누구와 어떻게 이어져 있는지 보는" 메인 화면이다.
 * 실제로 아는 사람에게 보내는 초대(관계 생성용)는 `/connect`의 역할이고,
 * 여기서는 다시 만들지 않는다 — 그래서 그래프 아래 secondary CTA 하나로
 * `/connect`로 보낼 뿐이다.
 *
 * `/r/{token}`(공개 링크, 몇 다리인지 자동 계산만 하고 관계는 만들지 않음)은
 * 커뮤니티/SNS 공유가 목적이라 `/connect`의 지인 초대와 맥락이 다르다
 * (2026-09-14 결정) — 헤더 우측의 작은 "공유하기"가 그 진입점이다.
 * 남의 `/r/{token}` 결과 화면에 있는 "나도 내 링크 만들기"와 같은
 * `getOrCreateReferralLink`를 쓰므로 토큰은 항상 재사용된다.
 */
export function ResultScreen({ preview = false }: { preview?: boolean }) {
  const router = useRouter();
  const [result, setResult] = useState<MeResult | null>(preview ? {
    distanceCounts: { direct: 2, within2: 4, within3: 6 },
    network: {
      nodes: [
        { id: "p1", parentId: null, depth: 1, displayName: "수연" },
        { id: "p2", parentId: "p1", depth: 2, displayName: null },
        { id: "p3", parentId: "p2", depth: 3, displayName: null },
      ],
      edges: [["p1", "p2"], ["p2", "p3"]],
      hiddenBeyondCount: 0,
    },
    recoveryToken: "preview",
  } : null);
  const [error, setError] = useState<string | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [shareLink, setShareLink] = useState<ReferralLink | null>(null);
  const [shareLoading, setShareLoading] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);
  const [shareCopied, setShareCopied] = useState(false);

  async function handleToggleShareLink() {
    if (preview) return;
    const willOpen = !shareOpen;
    setShareOpen(willOpen);
    if (!willOpen || shareLink) return;
    setShareLoading(true);
    setShareError(null);
    try {
      const response = await fetch("/api/referral-link");
      if (response.ok) {
        setShareLink((await response.json()) as ReferralLink);
        return;
      }
      if (response.status === 404) {
        const created = await fetch("/api/referral-link", { method: "POST" });
        if (!created.ok) throw new Error();
        setShareLink((await created.json()) as ReferralLink);
        return;
      }
      throw new Error();
    } catch {
      setShareError("링크를 만들지 못했어요. 잠시 후 다시 시도해주세요.");
    } finally {
      setShareLoading(false);
    }
  }

  async function handleCopyShareLink() {
    if (!shareLink) return;
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/r/${shareLink.token}`);
      setShareCopied(true);
      window.setTimeout(() => setShareCopied(false), 1800);
    } catch {
      setShareError("자동 복사가 되지 않아요. 링크를 길게 눌러 직접 복사해주세요.");
    }
  }

  async function handleShareLink() {
    if (!shareLink) return;
    const url = `${window.location.origin}/r/${shareLink.token}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: "가이 알아?", text: "우리 몇 다리 건너 아는 사이인지 확인해봐요.", url });
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
      }
    }
    await handleCopyShareLink();
  }

  async function handleLogout() {
    if (preview) return;
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    router.replace("/");
  }

  const loadResult = useCallback(async () => {
    const response = await fetch("/api/me/result");
    if (!response.ok) throw new Error("결과를 불러오지 못했어요. 로그인 상태를 확인해주세요.");
    return await response.json() as MeResult;
  }, []);

  useEffect(() => {
    if (preview) return;
    loadResult().then(setResult).catch(() => setError("결과를 불러오지 못했어요. 로그인 상태를 확인해주세요."));
  }, [loadResult, preview]);

  useEffect(() => {
    if (preview) return;
    const refresh = () => {
      if (document.visibilityState !== "visible") return;
      loadResult().then(setResult).catch(() => {});
    };
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [loadResult, preview]);

  const isEmpty = result !== null && result.network.nodes.length === 0;

  const shareToggle = !preview ? (
    <button type="button" className="small-link result-share-toggle" onClick={handleToggleShareLink} aria-expanded={shareOpen} aria-controls="result-share-panel">
      공유하기<Icon name="link" />
    </button>
  ) : undefined;

  return <main className="brand-page result-page"><BrandHeader action={shareToggle} />
    {!error && result && (
      <div className={`referral-share-expand result-share-expand ${shareOpen ? "is-expanded" : ""}`}>
        <section id="result-share-panel" className="referral-share-panel result-share-panel" aria-hidden={!shareOpen}>
          <p className="result-share-panel-title">나와 몇 다리 건너일까요?</p>
          <p className="result-share-panel-desc">링크를 공유하면 나와 몇 다리 건너인지 확인할 수 있어요.</p>
          <div className="result-share-panel-actions">
            {shareLoading && <p className="subtitle text-xs">만드는 중…</p>}
            {shareLink && <>
              <button type="button" className="text-link text-sm" onClick={handleShareLink} tabIndex={shareOpen ? 0 : -1}>공유하기</button>
              <button type="button" className="text-link text-sm" onClick={handleCopyShareLink} tabIndex={shareOpen ? 0 : -1}>
                {shareCopied ? "✓ 링크 복사됨" : "링크 복사"}
              </button>
            </>}
            {shareError && <p className="error-message" role="alert">{shareError}</p>}
          </div>
        </section>
      </div>
    )}
    {error ? <><Character kind="search" className="result-character" /><h1 className="upload-heading">결과를 확인할 수 없어요</h1><p className="subtitle" role="alert">{error}</p><Link href="/login" className="primary-button mt-8">다시 로그인하기 <Icon name="arrow" /></Link></>
    : !result ? <section className="analysis-state" role="status"><h1 className="upload-heading">연결을 찾고 있어요</h1><Character kind="search" /><p className="subtitle">결과를 불러오고 있어요…</p><div className="progress-track" /></section>
    : <>
      <MiniConnectionGraph network={result.network} />
      {isEmpty ? <>
        <h1 className="upload-heading cluster-heading">여기서부터 이어져요</h1>
        <p className="subtitle cluster-subtitle">아직 이어진 사람이 없다면<br />아는 사람을 초대해보세요.</p>
        <Link href="/connect" className="text-link text-sm mt-4">아는 사람 초대하기 →</Link>
      </> : <>
        <h1 className="upload-heading cluster-heading">내가 이어진 사람들</h1>
        <Link href="/connect" className="text-link text-sm mt-4">아는 사람 더 초대하기 →</Link>
      </>}
      <section className="result-footer">
        <button type="button" className="text-link text-xs" onClick={handleLogout}>로그아웃</button>
      </section>
</>}
  </main>;
}
