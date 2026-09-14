"use client";

import { useState } from "react";
import Link from "next/link";
import type { ReferralLink } from "@gai-ara/shared";
import { BrandHeader, Character, Icon } from "@/components/Brand";

/**
 * 화면 06(`/result`) — 2026-09-15 협업형 챌린지 결정으로 메인 플로우에서
 * 빠진 뒤, 화면 자체도 최소한으로 줄였다. 내 연결 그래프(`MiniConnectionGraph`)와
 * 연결 수 카운트는 더 이상 그리지 않는다 — "몇 명과 이어져 있는지"는 이제
 * `/t/{token}` 챌린지가 담당하는 서사이고, 이 화면은 순수하게 "아는 사람을
 * 가져오는" 보조 진입점으로만 남긴다. 항상 같은 카피를 보여준다(연결
 * 유무로 분기하지 않는다) — 분기할 데이터 자체를 더 이상 불러오지 않는다.
 */
export function ResultScreen() {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetStep, setSheetStep] = useState<"choose" | "share">("choose");
  const [shareLink, setShareLink] = useState<ReferralLink | null>(null);
  const [shareLoading, setShareLoading] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);
  const [shareCopied, setShareCopied] = useState(false);

  function handleOpenConnectSheet() {
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

  return (
    <main className="brand-page result-page">
      <BrandHeader />
      <Character kind="curious" className="result-character" />
      <h1 className="upload-heading cluster-heading">여기서부터 이어져요</h1>
      <p className="subtitle cluster-subtitle">
        아직 이어진 사람이 없다면
        <br />
        아는 사람을 초대해보세요.
      </p>
      <Link href="/upload?step=form" className="primary-button mt-4">
        인스타 연결 가져오기 <Icon name="arrow" />
      </Link>
      <p className="status-caption">서로 팔로우하는 사람만 연결에 사용해요.</p>
      <button type="button" className="text-link text-xs mt-4" onClick={handleOpenConnectSheet}>
        다른 방법으로 이어보기 →
      </button>

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
    </main>
  );
}
