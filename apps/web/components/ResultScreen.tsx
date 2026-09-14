"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { MeResult, ReferralLink } from "@gai-ara/shared";
import { BrandHeader, Character, Icon } from "@/components/Brand";
import { MiniConnectionGraph } from "@/components/MiniConnectionGraph";

/**
 * 화면 06 — "내가 지금 누구와 어떻게 이어져 있는지 보는" 메인 화면이다.
 * 관계를 만드는 것(`/connect`)과 관계를 만들지 않고 몇 다리인지만 확인하는
 * 것(`/r`, `getOrCreateReferralLink`로 owner당 토큰 재사용)은 서로 다른
 * 진입점을 따로 두지 않고, 그래프 아래 "더 이어보기 →" 하나로 합쳐서 누르면
 * 두 선택지를 보여주는 bottom sheet를 연다(2026-09-14 결정) — 화면
 * 여기저기 흩어진 "공유하기"류 버튼이 서로 다른 화면(`/connect`에도
 * "공유하기"가 있다)에서 같은 단어로 중복돼 헷갈리는 문제를 피하기 위함.
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
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetStep, setSheetStep] = useState<"choose" | "share">("choose");
  const [shareLink, setShareLink] = useState<ReferralLink | null>(null);
  const [shareLoading, setShareLoading] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);
  const [shareCopied, setShareCopied] = useState(false);

  function handleOpenConnectSheet() {
    if (preview) return;
    setSheetStep("choose");
    setSheetOpen(true);
  }

  function handleCloseSheet() {
    setSheetOpen(false);
  }

  async function handleChooseDistanceCheck() {
    setSheetStep("share");
    if (shareLink) return;
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

  return <main className="brand-page result-page"><BrandHeader />
    {error ? <><Character kind="search" className="result-character" /><h1 className="upload-heading">결과를 확인할 수 없어요</h1><p className="subtitle" role="alert">{error}</p><Link href="/login" className="primary-button mt-8">다시 로그인하기 <Icon name="arrow" /></Link></>
    : !result ? <section className="analysis-state" role="status"><h1 className="upload-heading">연결을 찾고 있어요</h1><Character kind="search" /><p className="subtitle">결과를 불러오고 있어요…</p><div className="progress-track" /></section>
    : <>
      <MiniConnectionGraph network={result.network} />
      {isEmpty ? <>
        <h1 className="upload-heading cluster-heading">여기서부터 이어져요</h1>
        <p className="subtitle cluster-subtitle">아직 이어진 사람이 없다면<br />아는 사람을 초대해보세요.</p>
      </> : <>
        <h1 className="upload-heading cluster-heading">내가 이어진 사람들</h1>
      </>}
      {!preview && <button type="button" className="text-link text-sm mt-4" onClick={handleOpenConnectSheet}>더 이어보기 →</button>}
      <section className="result-footer">
        <button type="button" className="text-link text-xs" onClick={handleLogout}>로그아웃</button>
      </section>
</>}
    {sheetOpen && (
      <div className="result-share-sheet-backdrop" onClick={handleCloseSheet}>
        <div className="result-share-sheet" onClick={(event) => event.stopPropagation()}>
          <button type="button" className="result-share-sheet-close" onClick={handleCloseSheet} aria-label="닫기">✕</button>
          {sheetStep === "choose" ? <>
            <p className="result-share-panel-title">어떻게 이어볼까요?</p>
            <div className="result-connect-options">
              <Link href="/connect" className="result-connect-option">
                <span className="result-connect-option-title">아는 사람과 연결하기</span>
                <span className="result-connect-option-desc">서로 아는 사이라고 확인하면 바로 이어져요.</span>
              </Link>
              <button type="button" className="result-connect-option" onClick={handleChooseDistanceCheck}>
                <span className="result-connect-option-title">몇 다리인지 확인하기</span>
                <span className="result-connect-option-desc">서로 모르는 사이여도 건너건너 이어져 있을 수 있어요.</span>
              </button>
            </div>
          </> : <>
            <p className="result-share-panel-title">우리도 이어져 있을까?</p>
            <p className="result-share-panel-desc">SNS나 단톡방에 링크를 공유해보세요.</p>
            <div className="result-share-panel-actions">
              {shareLoading && <p className="subtitle text-xs">만드는 중…</p>}
              {shareLink && <>
                <button type="button" className="primary-button mt-3" onClick={handleShareLink}>공유하기</button>
                <button type="button" className="text-link text-sm mt-3" onClick={handleCopyShareLink}>
                  {shareCopied ? "✓ 링크 복사됨" : "링크 복사"}
                </button>
              </>}
              {shareError && <p className="error-message" role="alert">{shareError}</p>}
            </div>
          </>}
        </div>
      </div>
    )}
  </main>;
}
