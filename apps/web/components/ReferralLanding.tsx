"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import type { ReferralResult } from "@gai-ara/shared";
import { UploadFlow } from "@/components/UploadFlow";
import { BrandHeader, Character, Centered, StatusMessage } from "@/components/Brand";
import { UnreachableResult } from "@/components/UnreachableResult";
import { formatConnectionPhrase } from "@/lib/distance-copy";

type LinkStatus = "loading" | "not-found" | "ready";

/**
 * 재사용 가능한 "내 링크"의 공개 랜딩. `pair_invites`(1:1, 1회용)와 달리
 * 특정 상대를 지정하지 않는다 — 여러 명이 같은 링크로 들어와서 각자
 * 업로드를 마치면, owner와의 거리를 그 자리에서 계산해 보여준다. 그
 * 결과는 owner에게 저장되지 않는다(방문자 목록 자체가 없음) — 지금
 * 요청한 사람에게만 보여주는 일회성 계산이다. LivePairPage와 최대한
 * 같은 구조를 쓴다.
 */
export function ReferralLanding() {
  const params = useParams<{ token: string }>();
  const token = params.token;

  const [linkStatus, setLinkStatus] = useState<LinkStatus>("loading");
  const [nickname, setNickname] = useState<string | null>(null);
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
      .then(async (response) => {
        if (!response.ok) {
          setLinkStatus("not-found");
          return;
        }
        const data = (await response.json()) as { nickname: string | null };
        setNickname(data.nickname);
        setLinkStatus("ready");
      })
      .catch(() => setLinkStatus("not-found"));
  }, [token]);

  async function loadResult() {
    const response = await fetch(`/api/r/${token}/result`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nickname: visitorNickname.trim() || undefined }),
    });
    if (!response.ok) throw new Error("결과를 불러오지 못했어요. 다시 시도해주세요.");
    setResult((await response.json()) as ReferralResult);
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
    return (
      <Centered character="wave">
        <p className="pair-result-kicker">{nickname ?? "친구"}님과</p>
        <p className="pair-result-title">{formatConnectionPhrase(result.distance ?? 1)}</p>
        <p className="pair-result-kicker">예요!</p>
      </Centered>
    );
  }

  return (
    <main className="brand-page">
      <BrandHeader home />
      <Character kind="wave" className="result-character" />
      <h1 className="upload-heading">
        {nickname ? <>{nickname}님이 초대했어요</> : "친구가 초대했어요"}<br />
        우리 몇 다리 건너<br />아는 사이일까요?
      </h1>
      <p className="subtitle mb-6">
        내 인스타 데이터로 제주에서 몇 다리 건너<br />아는 사이인지 확인해볼 수 있어요.
      </p>
      <input className="username-input mb-3" value={visitorNickname} onChange={(event) => setVisitorNickname(event.target.value)}
        placeholder="내 닉네임 (선택, 상대방에게 보여요)" maxLength={20} aria-label="내 닉네임" />
      {hasSession && !wantsReupload ? (
        <>
          <p className="subtitle">이미 참여하셨네요 — 이 정보로 바로 확인할까요?</p>
          <button type="button" className="primary-button mt-4" onClick={handleQuickConfirm} disabled={confirming}>
            {confirming ? "확인하는 중…" : "바로 확인하기"}
          </button>
          {confirmError && <p className="error-message" role="alert">{confirmError}</p>}
          <button type="button" className="text-link text-xs mt-4" onClick={() => setWantsReupload(true)}>
            다른 파일로 다시 올릴래요
          </button>
        </>
      ) : (
        <UploadFlow onUploaded={handleUploaded} />
      )}
    </main>
  );
}
