"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useParams } from "next/navigation";
import type { PairResult } from "@gai-ara/shared";
import { UploadFlow } from "@/components/UploadFlow";
import { BrandHeader, Character } from "@/components/Brand";

type InviteStatus = "pending" | "accepted" | "expired" | "not-found";

function Centered({ children }: { children: ReactNode }) {
  return (
    <main className="brand-page">
      <BrandHeader home />
      <Character kind="heart" className="result-character" />
      <div className="space-y-4">{children}</div>
    </main>
  );
}

export default function LivePairPage() {
  const params = useParams<{ token: string }>();
  const token = params.token;

  const [inviteStatus, setInviteStatus] = useState<InviteStatus | null>(null);
  const [pairResult, setPairResult] = useState<PairResult | null>(null);

  useEffect(() => {
    fetch(`/api/invites/${token}`)
      .then(async (response) => {
        if (!response.ok) {
          setInviteStatus("not-found");
          return;
        }
        const data = (await response.json()) as { status: InviteStatus };
        setInviteStatus(data.status);
      })
      .catch(() => setInviteStatus("not-found"));
  }, [token]);

  async function handleUploaded() {
    const accepted = await fetch(`/api/invites/${token}/accept`, { method: "POST" });
    if (!accepted.ok) throw new Error("초대를 수락하지 못했어요. 링크를 다시 확인해주세요.");
    const response = await fetch(`/api/pairs/${token}/result`);
    if (!response.ok) throw new Error("결과를 불러오지 못했어요. 다시 시도해주세요.");
    setPairResult((await response.json()) as PairResult);
    setInviteStatus("accepted");
  }

  if (inviteStatus === "not-found") {
    return <Centered>존재하지 않는 링크예요.</Centered>;
  }

  if (inviteStatus === "expired") {
    return <Centered>이 링크는 만료되었어요.</Centered>;
  }

  if (pairResult) {
    return (
      <Centered>
        {pairResult.status === "connected" && (
          <>
            <p className="text-lg text-ink/70">우리는</p>
            <p className="text-6xl font-bold text-tangerine">{pairResult.distance}다리</p>
            <p className="text-lg text-ink/70">예요!</p>
          </>
        )}
        {pairResult.status === "unreachable" && (
          <p className="text-ink/70">
            아직 참여자 그래프 안에서 서로 연결된 경로를 찾지 못했어요.
          </p>
        )}
        {pairResult.status === "pending" && (
          <p className="text-ink/70">상대방의 참여를 기다리고 있어요.</p>
        )}
        <p className="max-w-xs text-xs text-ink/40">
          누가 누구를 아는지는 보여주지 않아요. 몇 다리인지만 계산해요.
        </p>
      </Centered>
    );
  }

  if (inviteStatus === null) {
    return <Centered>불러오는 중...</Centered>;
  }

  return (
    <main className="brand-page">
      <BrandHeader back />
      <Character kind="wave" className="result-character" />
      <h1 className="upload-heading">
        친구가 당신과 몇 다리인지 궁금해해요
      </h1>
      <p className="subtitle mb-6">
        누가 물어봤는지는 알려주지 않아요. 나도 참여하면 둘이 몇 다리인지 함께 볼 수 있어요.
      </p>
      <UploadFlow onUploaded={handleUploaded} />
    </main>
  );
}
