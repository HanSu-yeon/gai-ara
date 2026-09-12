"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import type { PairResult } from "@gai-ara/shared";
import { ImportOnboarding } from "@/components/ImportOnboarding";
import { BrandHeader, Character, Centered, StatusMessage } from "@/components/Brand";
import { UnreachableResult } from "@/components/UnreachableResult";
import { formatConnectionPhrase } from "@/lib/distance-copy";
import { trackEvent } from "@/lib/analytics";
import { clearImportProgress } from "@/lib/import-progress";

type InviteStatus = "pending" | "accepted" | "expired" | "not-found";

export default function LivePairPage() {
  const params = useParams<{ token: string }>();
  const token = params.token;

  const [inviteStatus, setInviteStatus] = useState<InviteStatus | null>(null);
  const [inviterNickname, setInviterNickname] = useState<string | null>(null);
  const [pairResult, setPairResult] = useState<PairResult | null>(null);
  const [hasSession, setHasSession] = useState(false);
  const [wantsReupload, setWantsReupload] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/session")
      .then(async (response) => (response.ok ? ((await response.json()) as { active: boolean }).active : false))
      .then(setHasSession)
      .catch(() => setHasSession(false));
  }, []);

  useEffect(() => {
    fetch(`/api/invites/${token}`)
      .then(async (response) => {
        if (!response.ok) {
          setInviteStatus("not-found");
          return;
        }
        const data = (await response.json()) as { status: InviteStatus; inviterNickname?: string | null };
        setInviteStatus(data.status);
        setInviterNickname(data.inviterNickname ?? null);

        // 이미 accepted된 링크를 다시 열었을 때(새로고침, 재방문 등)도
        // 결과를 보여줘야 한다 — accept 직후에만 조회하면 업로드 화면으로
        // 되돌아가버린다.
        if (data.status === "accepted") {
          const resultResponse = await fetch(`/api/pairs/${token}/result`);
          if (resultResponse.ok) {
            setPairResult((await resultResponse.json()) as PairResult);
          }
        }
      })
      .catch(() => setInviteStatus("not-found"));
  }, [token]);

  useEffect(() => {
    if (inviteStatus === "not-found" || inviteStatus === "expired") clearImportProgress(`/pair/${token}`);
  }, [inviteStatus, token]);

  async function handleUploaded() {
    const accepted = await fetch(`/api/invites/${token}/accept`, { method: "POST" });
    if (accepted.status === 410) {
      throw new Error("이 링크는 만료되었어요.");
    }
    if (accepted.status === 400) {
      throw new Error("자기 자신의 링크로는 확인할 수 없어요.");
    }
    if (accepted.status === 409) {
      throw new Error("이 링크는 이미 다른 사람이 사용했어요.");
    }
    if (!accepted.ok) throw new Error("초대를 수락하지 못했어요. 링크를 다시 확인해주세요.");
    const response = await fetch(`/api/pairs/${token}/result`);
    if (!response.ok) throw new Error("결과를 불러오지 못했어요. 다시 시도해주세요.");
    const data = (await response.json()) as PairResult;
    setPairResult(data);
    setInviteStatus("accepted");
    trackEvent("distance_result", { source: "pair", status: data.status, ...(data.distance !== null ? { distance: data.distance } : {}) });
  }

  /**
   * 이미 세션이 있는(=예전에 한 번 참여한) 사람이 새 초대 링크를 열었을 때
   * 재업로드 없이 바로 확인하는 지름길. handleUploaded와 로직은 같지만
   * UploadFlow 밖에서 직접 호출하므로 에러를 여기서 따로 잡아야 한다.
   */
  async function handleQuickConfirm() {
    setConfirming(true);
    setConfirmError(null);
    try {
      await handleUploaded();
      clearImportProgress(`/pair/${token}`);
    } catch (err) {
      setConfirmError(err instanceof Error ? err.message : "확인하지 못했어요. 다시 시도해주세요.");
    } finally {
      setConfirming(false);
    }
  }

  if (inviteStatus === "not-found") {
    return <Centered character="search"><StatusMessage>존재하지 않는 링크예요.</StatusMessage></Centered>;
  }

  if (inviteStatus === "expired") {
    return <Centered character="search"><StatusMessage>이 링크는 만료되었어요.</StatusMessage></Centered>;
  }

  if (pairResult) {
    if (pairResult.status === "unreachable") return <UnreachableResult />;
    return (
      <Centered character={pairResult.status === "connected" ? "wave" : "heart"}>
        {pairResult.status === "connected" && (
          <>
            <p className="pair-result-kicker">우리는</p>
            <p className="pair-result-title">{formatConnectionPhrase(pairResult.distance ?? 1)}</p>
            <p className="pair-result-kicker">예요!</p>
          </>
        )}
        {pairResult.status === "pending" && (
          <StatusMessage>상대방의 참여를 기다리고 있어요.</StatusMessage>
        )}
      </Centered>
    );
  }

  if (inviteStatus === null) {
    return <Centered character="search"><StatusMessage>불러오는 중…</StatusMessage></Centered>;
  }

  return (
    <main className="brand-page">
      <BrandHeader back />
      <Character kind="wave" className="result-character" />
      <h1 className="upload-heading">
        {inviterNickname ? <>{inviterNickname}님이 당신과<br />몇 다리인지 궁금해해요</> : "친구가 당신과 몇 다리인지 궁금해해요"}
      </h1>
      <p className="subtitle mb-6">
        나도 참여하면 둘이 몇 다리인지 함께 볼 수 있어요.
      </p>
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
