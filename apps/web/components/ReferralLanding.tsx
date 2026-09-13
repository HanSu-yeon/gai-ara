"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import type { ReferralResult, SessionInfo } from "@gai-ara/shared";
import { BrandHeader, Centered, Character, StatusMessage } from "@/components/Brand";
import { ConnectionPath } from "@/components/ConnectionPath";
import { formatConnectionHeadline, formatConnectionSubtitle, formatIntermediaryPhrase } from "@/lib/distance-copy";
import { trackEvent } from "@/lib/analytics";
import { loginPathFor } from "@/lib/return-to";

type LinkStatus = "loading" | "not-found" | "ready";

function pendingConfirmationKey(token: string) {
  return `gai-ara:referral-confirm:${token}`;
}

function readPendingConfirmation(key: string) {
  try {
    return window.sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function writePendingConfirmation(key: string) {
  try {
    window.sessionStorage.setItem(key, "1");
  } catch {
    // Storage can be unavailable in privacy-restricted browsers; login still proceeds.
  }
}

function clearPendingConfirmation(key: string) {
  try {
    window.sessionStorage.removeItem(key);
  } catch {
    // Nothing else needs to be cleaned up when storage is unavailable.
  }
}

/**
 * 공개 링크 랜딩(화면 08~10). 누구나 먼저 화면 08을 보고, 확인 CTA를 누른
 * 시점에만 현재 경로를 `returnTo`로 보존해 로그인한다. 이때의 확인 의도만
 * token별로 잠시 보존하고, 로그인과 이름 설정을 마쳐 복귀하면 한 번 소비해
 * owner와의 거리를 계산한 뒤 화면 09 또는 10을 보여준다.
 * 중간 연결자는 여기서도 절대 노출하지 않는다 — `ConnectionPath`가 이름
 * 없는 점 개수만 그린다. 09는 화면 전체를 특별한 배경(dark theme)으로
 * 바꾸지 않는다 — 다른 화면과 같은 cream 배경을 쓰고, 결과의 강조는
 * 헤드라인 타이포·경로 시각화·여백으로만 한다(2026-09-14 결정).
 */
export function ReferralLanding() {
  const router = useRouter();
  const params = useParams<{ token: string }>();
  const token = params.token;

  const [session, setSession] = useState<SessionInfo | null>(null);
  const [linkStatus, setLinkStatus] = useState<LinkStatus>("loading");
  const [ownerDisplayName, setOwnerDisplayName] = useState<string | null>(null);
  const [result, setResult] = useState<ReferralResult | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);
  const [shareMessage, setShareMessage] = useState("");

  useEffect(() => {
    fetch("/api/session")
      .then(async (response) => (response.ok ? ((await response.json()) as SessionInfo) : { active: false, hasDisplayName: false }))
      .then(setSession)
      .catch(() => setSession({ active: false, hasDisplayName: false }));
  }, [router, token]);

  useEffect(() => {
    fetch(`/api/r/${token}`)
      .then(async (response) => {
        if (!response.ok) {
          setLinkStatus("not-found");
          return;
        }
        const data = (await response.json()) as { ownerDisplayName: string | null };
        setOwnerDisplayName(data.ownerDisplayName);
        setLinkStatus("ready");
      })
      .catch(() => setLinkStatus("not-found"));
  }, [token]);

  const loadResult = useCallback(async () => {
    const response = await fetch(`/api/r/${token}/result`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    if (!response.ok) throw new Error("결과를 불러오지 못했어요. 다시 시도해주세요.");
    const data = (await response.json()) as ReferralResult;
    setResult(data);
    trackEvent("distance_result", { source: "referral", status: data.status, ...(data.distance !== null ? { distance: data.distance } : {}) });
  }, [token]);

  useEffect(() => {
    const key = pendingConfirmationKey(token);
    if (linkStatus === "not-found") {
      clearPendingConfirmation(key);
      return;
    }
    if (linkStatus !== "ready" || !session?.active || !session.hasDisplayName || result || confirming) return;

    const pending = readPendingConfirmation(key);
    if (pending !== "1") {
      if (pending !== null) clearPendingConfirmation(key);
      return;
    }

    clearPendingConfirmation(key);
    setConfirming(true);
    setConfirmError(null);
    loadResult()
      .catch((error: unknown) => {
        setConfirmError(error instanceof Error ? error.message : "확인하지 못했어요. 다시 시도해주세요.");
      })
      .finally(() => setConfirming(false));
  }, [confirming, linkStatus, loadResult, result, session, token]);

  async function handleConfirm() {
    if (!session?.active || !session.hasDisplayName) {
      writePendingConfirmation(pendingConfirmationKey(token));
      router.push(loginPathFor(`/r/${token}`));
      return;
    }
    setConfirming(true);
    setConfirmError(null);
    try {
      await loadResult();
    } catch (err) {
      setConfirmError(err instanceof Error ? err.message : "확인하지 못했어요. 다시 시도해주세요.");
    } finally {
      setConfirming(false);
    }
  }

  async function handleShare(text: string) {
    setSharing(true);
    setShareMessage("");
    try {
      if (navigator.share) {
        await navigator.share({ title: "가이 알아? 연결 결과", text });
      } else {
        await navigator.clipboard.writeText(text);
        setShareMessage("결과 문구를 복사했어요. 친구에게 보내보세요!");
      }
    } catch (error) {
      if (!(error instanceof Error && error.name === "AbortError")) {
        setShareMessage("공유하지 못했어요. 잠시 후 다시 시도해주세요.");
      }
    } finally {
      setSharing(false);
    }
  }

  if (session === null || linkStatus === "loading") {
    return (
      <Centered character="search">
        <StatusMessage>불러오는 중…</StatusMessage>
      </Centered>
    );
  }

  if (linkStatus === "not-found") {
    return (
      <Centered character="search">
        <StatusMessage>존재하지 않는 링크예요.</StatusMessage>
      </Centered>
    );
  }

  if (result) {
    if (result.status === "self") {
      return (
        <Centered character="search">
          <StatusMessage>이건 본인의 링크예요.</StatusMessage>
        </Centered>
      );
    }

    // 세션이 있어야만 여기까지 오므로, 이미 로그인된 방문자다 — 표시
    // 이름까지 마쳤으면 바로 지인 연결(화면 03)로, 아직이면 이름 입력부터
    // 마치도록 `/login`으로 보낸다(그 화면이 세션 상태를 다시 확인해
    // 알아서 다음 단계로 이어준다).
    const ctaHref = session.hasDisplayName ? "/connect" : "/login";

    if (result.status === "unreachable") {
      // 실제로 관계가 없다는 단정이 아니라, 현재 참여 데이터 안에서 아직
      // 경로를 못 찾았다는 뜻이다 — 헤드라인·설명 문구가 이 의미를 지켜야
      // 한다. 재계산은 이 화면에서 다시 시도하지 않고, 다음에 /r/{token}에
      // 다시 들어왔을 때 최신 데이터로 자동으로 이뤄지므로 재시도 버튼은
      // 두지 않는다.
      return (
        <main className="brand-page">
          <BrandHeader />
          <div className="duo-art" role="img" aria-label="아직 연결을 찾지 못한 귤 캐릭터 두 마리">
            <Character kind="curious" />
            <span className="duo-dots" aria-hidden="true">···</span>
            <Character kind="curious" className="duo-character-flip" />
          </div>
          <h1 className="upload-heading">아직 연결을<br />찾지 못했어요</h1>
          <p className="subtitle">
            현재 참여한 사람들 사이에서는
            <br />
            아직 이어지는 길을 찾지 못했어요.
          </p>
          <p className="subtitle mt-2">
            아는 사람들이 더 참여하면
            <br />
            결과가 달라질 수 있어요.
          </p>
          <Link href={ctaHref} className="primary-button mt-6">나도 시작하기</Link>
        </main>
      );
    }

    const distance = result.distance ?? 1;
    const headline = formatConnectionHeadline(distance);
    const shareText = `가이 알아? ${formatIntermediaryPhrase(distance)} ${typeof window !== "undefined" ? window.location.origin : ""} 에서 확인해보세요!`;

    return (
      <main className="brand-page">
        <BrandHeader />
        <h1 className="upload-heading">{headline.top}<br />{headline.bottom}</h1>
        <ConnectionPath intermediaries={Math.max(distance - 1, 0)} />
        <p className="subtitle mt-4">{formatConnectionSubtitle(distance)}</p>
        <button type="button" className="primary-button mt-6" onClick={() => handleShare(shareText)} disabled={sharing}>
          {sharing ? "공유하는 중…" : "결과 공유하기"}
        </button>
        <Link href={ctaHref} className="text-link text-xs mt-4">나도 시작하기</Link>
        {shareMessage && <p className="result-note" role="status">{shareMessage}</p>}
      </main>
    );
  }

  // 화면 08 — owner 표시 이름이 있으면 개인화된 문구로 바꾼다.
  const headline = ownerDisplayName ? (
    <>
      {ownerDisplayName}님과 나는
      <br />
      몇 다리 건너 아는 사이일까?
    </>
  ) : (
    <>
      우리, 몇 다리 건너
      <br />아는 사이일까?
    </>
  );

  return (
    <main className="brand-page">
      <BrandHeader />
      <div className="referral-teaser-art referral-entry-art">
        <Image src="/assets/curious.png" alt="서로를 궁금해하는 두 귤 캐릭터" width={1774} height={887} sizes="245px" />
      </div>
      <h1 className="upload-heading">{headline}</h1>
      <p className="subtitle">
        서로 모르는 사이여도
        <br />
        생각보다 가까울 수 있어요.
      </p>
      <button type="button" className="primary-button mt-6" onClick={handleConfirm} disabled={confirming}>
        {confirming ? "확인하는 중…" : "몇 다리인지 확인하기"}
      </button>
      {confirmError && <p className="error-message" role="alert">{confirmError}</p>}
    </main>
  );
}
