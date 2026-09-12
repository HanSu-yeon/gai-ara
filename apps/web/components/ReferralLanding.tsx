"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import type { ReferralResult } from "@gai-ara/shared";
import { ImportOnboarding } from "@/components/ImportOnboarding";
import { BrandHeader, Character, Centered, StatusMessage } from "@/components/Brand";
import { UnreachableResult } from "@/components/UnreachableResult";
import { formatConnectionPhrase, formatConnectionDiagram } from "@/lib/distance-copy";
import { trackEvent } from "@/lib/analytics";
import { clearImportProgress } from "@/lib/import-progress";

type LinkStatus = "loading" | "not-found" | "ready";

/**
 * 재사용 가능한 "내 링크"의 공개 랜딩. `pair_invites`(1:1, 1회용)와 달리
 * 특정 상대를 지정하지 않는다 — 여러 명이 같은 링크로 들어와서 각자
 * 업로드를 마치면, owner와의 거리를 그 자리에서 계산해 보여준다. 그
 * 결과는 owner가 나중에 `/connections`에서 다시 볼 수 있게 남지만, 중간
 * 연결자는 그래프 계산 자체가 절대 돌려주지 않는다. LivePairPage와
 * 최대한 같은 구조를 쓴다.
 */
export function ReferralLanding() {
  const params = useParams<{ token: string }>();
  const token = params.token;

  const [linkStatus, setLinkStatus] = useState<LinkStatus>("loading");
  const [result, setResult] = useState<ReferralResult | null>(null);
  const [hasSession, setHasSession] = useState(false);
  const [wantsReupload, setWantsReupload] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [visitorNickname, setVisitorNickname] = useState("");

  useEffect(() => {
    fetch("/api/session")
      .then(async (response) => (response.ok ? ((await response.json()) as { active: boolean }).active : false))
      .then(setHasSession)
      .catch(() => setHasSession(false));
  }, []);

  useEffect(() => {
    fetch(`/api/r/${token}`)
      .then((response) => setLinkStatus(response.ok ? "ready" : "not-found"))
      .catch(() => setLinkStatus("not-found"));
  }, [token]);

  useEffect(() => {
    if (linkStatus === "not-found") clearImportProgress(`/r/${token}`);
  }, [linkStatus, token]);

  async function loadResult() {
    const response = await fetch(`/api/r/${token}/result`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nickname: visitorNickname.trim() || undefined }),
    });
    if (!response.ok) throw new Error("결과를 불러오지 못했어요. 다시 시도해주세요.");
    const data = (await response.json()) as ReferralResult;
    setResult(data);
    trackEvent("distance_result", { source: "referral", status: data.status, ...(data.distance !== null ? { distance: data.distance } : {}) });
  }

  // 세션이 있어도 자동으로 계산하지 않는다 — "바로 확인하기"를 눌러야
  // 결과가 뜬다. 버튼이 보이는데 누르기 전에 결과가 먼저 떠버리면 그
  // 버튼이 장식이 되어버리므로, 트리거는 항상 버튼 클릭(handleQuickConfirm)
  // 하나로만 둔다.
  async function handleUploaded() {
    await loadResult();
  }

  async function handleQuickConfirm() {
    setConfirming(true);
    setConfirmError(null);
    try {
      await loadResult();
      clearImportProgress(`/r/${token}`);
    } catch (err) {
      setConfirmError(err instanceof Error ? err.message : "확인하지 못했어요. 다시 시도해주세요.");
    } finally {
      setConfirming(false);
    }
  }

  if (linkStatus === "loading") {
    return <Centered character="search"><StatusMessage>불러오는 중…</StatusMessage></Centered>;
  }

  if (linkStatus === "not-found") {
    return <Centered character="search"><StatusMessage>존재하지 않는 링크예요.</StatusMessage></Centered>;
  }

  if (result) {
    if (result.status === "self") {
      return <Centered character="search"><StatusMessage>이건 본인의 링크예요.</StatusMessage></Centered>;
    }
    if (result.status === "unreachable") return <UnreachableResult />;

    const distance = result.distance ?? 1;
    if (distance <= 1) {
      return (
        <Centered character="wave">
          <p className="pair-result-title">이미 바로 아는 사이네요</p>
          <p className="pair-result-kicker">다른 사람을 거치지 않고<br />바로 연결되어 있어요.</p>
          <Link href="/result" className="primary-button mt-6">내 링크 만들어보기</Link>
          <p className="result-note mt-3">또 다른 연결도 찾아볼 수 있어요.</p>
        </Centered>
      );
    }
    return (
      <Centered character="wave">
        <p className="pair-result-title">{formatConnectionPhrase(distance)}</p>
        <p className="connection-diagram" aria-hidden="true">{formatConnectionDiagram(distance)}</p>
        <p className="pair-result-kicker">둘 사이에 {distance - 1}명의 지인이 이어져 있어요.</p>
        <p className="result-note mt-8">다른 사람과도 이어져 있을까?</p>
        <Link href="/result" className="text-link text-xs">내 링크 만들기</Link>
      </Centered>
    );
  }

  return (
    <main className="brand-page">
      <BrandHeader home />
      <Character kind="wave" className="result-character" />
      <h1 className="upload-heading">
        나와 이 링크를 만든 사람 사이,<br />몇 명의 지인을 거치면 닿을까요?
      </h1>
      <p className="connection-diagram" aria-hidden="true">나 ─ ● ─ ● ─ 상대</p>
      <p className="subtitle">우리 사이를 이어주는 사람이<br />몇 명인지 찾아봐요.</p>
      <input className="username-input mb-3 mt-6" value={visitorNickname} onChange={(event) => setVisitorNickname(event.target.value)}
        placeholder="내 닉네임 (선택, 상대방에게 보여요)" maxLength={20} aria-label="내 닉네임" />
      {hasSession && !wantsReupload ? (
        <>
          <p className="subtitle">이미 참여하셨네요. 이 정보로 바로 확인할까요?</p>
          <button type="button" className="primary-button mt-4" onClick={handleQuickConfirm} disabled={confirming}>
            {confirming ? "확인하는 중…" : "바로 확인하기"}
          </button>
          {confirmError && <p className="error-message" role="alert">{confirmError}</p>}
          <button type="button" className="text-link text-xs mt-4" onClick={() => setWantsReupload(true)}>
            다른 파일로 다시 올릴래요
          </button>
        </>
      ) : (
        <>
          <ImportOnboarding onUploaded={handleUploaded} />
        </>
      )}
    </main>
  );
}
