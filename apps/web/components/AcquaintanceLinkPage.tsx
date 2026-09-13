"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import Image from "next/image";
import { useParams, useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import type { AcquaintanceLinkStatusResponse, SessionInfo } from "@gai-ara/shared";
import { BrandHeader, Centered, Character, StatusMessage } from "@/components/Brand";
import { trackEvent } from "@/lib/analytics";
import { loginPathFor } from "@/lib/return-to";

/**
 * 화면 04(지인 확인) · 05(연결 완료)를 담당한다(v2 명세, 재사용 지인 링크
 * 기반). `pair_invites` 기반 1회용 링크(`/pair/[token]`, `LivePairPage.tsx`)와
 * 별개의 새 흐름이다 — 기존 화면은 그대로 두고 새 토큰 종류(`acquaintance_links`)를
 * 위한 새 라우트/컴포넌트를 추가했다.
 *
 * 로그인/표시 이름이 아직 없는 방문자는 로그인부터 안내한다. 현재 invite
 * 경로는 OAuth callbackUrl과 `/login?returnTo=...`에 보존해 인증·이름 설정 뒤
 * 자동으로 이 화면에 복귀시킨다.
 */
export default function AcquaintanceLinkPage() {
  const router = useRouter();
  const params = useParams<{ token: string }>();
  const token = params.token;
  const returnTo = `/invite/${token}`;

  const [linkInfo, setLinkInfo] = useState<AcquaintanceLinkStatusResponse | null>(null);
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/links/${token}`)
      .then(async (response) => {
        if (!response.ok) {
          setLinkInfo({ status: "not-found", ownerDisplayName: null });
          return;
        }
        setLinkInfo((await response.json()) as AcquaintanceLinkStatusResponse);
      })
      .catch(() => setLinkInfo({ status: "not-found", ownerDisplayName: null }));

    fetch("/api/session")
      .then(async (response) => (response.ok ? ((await response.json()) as SessionInfo) : { active: false, hasDisplayName: false }))
      .then((info) => {
        setSession(info);
        if (info.active && !info.hasDisplayName) router.replace(loginPathFor(returnTo));
      })
      .catch(() => setSession({ active: false, hasDisplayName: false }));
  }, [returnTo, router, token]);

  async function handleConfirm() {
    setConfirming(true);
    setConfirmError(null);
    try {
      const response = await fetch(`/api/links/${token}/confirm`, { method: "POST" });
      if (response.status === 410) throw new Error("이 링크는 더 이상 사용할 수 없어요.");
      if (response.status === 400) throw new Error("자기 자신의 링크는 확인할 수 없어요.");
      if (!response.ok) throw new Error("확인하지 못했어요. 다시 시도해주세요.");

      setConfirmed(true);
      trackEvent("acquaintance_link_confirm");
    } catch (err) {
      setConfirmError(err instanceof Error ? err.message : "확인하지 못했어요. 다시 시도해주세요.");
    } finally {
      setConfirming(false);
    }
  }

  if (!linkInfo || !session) {
    return <Centered character="search"><StatusMessage>불러오는 중…</StatusMessage></Centered>;
  }

  if (linkInfo.status === "not-found") {
    return <Centered character="search"><StatusMessage>존재하지 않는 링크예요.</StatusMessage></Centered>;
  }
  if (linkInfo.status === "revoked") {
    return <Centered character="search"><StatusMessage>더 이상 사용할 수 없는 링크예요.</StatusMessage></Centered>;
  }

  const ownerName = linkInfo.ownerDisplayName ?? "친구";

  if (confirmed) {
    // 화면 05: 연결 완료.
    return (
      <main className="brand-page acquaintance-complete-page">
        <BrandHeader />
        <Image
          className="connection-complete-art"
          src="/assets/connect.png"
          width={1774}
          height={887}
          sizes="(max-width: 480px) 82vw, 390px"
          priority
          alt="서로 직접 이어진 두 감귤 캐릭터"
        />
        <h1 className="acquaintance-question">{ownerName}님과<br />연결됐어요.</h1>
        <p className="pair-result-kicker">이제 서로 아는 사이로 이어졌어요.</p>
        <Link href="/connect" className="primary-button mt-6">나도 아는 사람에게 보내기</Link>
        <Link href="/result" className="text-link text-xs mt-4">이어진 사람 보기 →</Link>
      </main>
    );
  }

  if (session.active && !session.hasDisplayName) {
    return <Centered character="search"><StatusMessage>이름 설정 화면으로 이동 중…</StatusMessage></Centered>;
  }

  if (!session.active) {
    // 로그인 뒤 현재 invite URL로 돌아온다.
    return (
      <InvitePrompt ownerName={ownerName}>
        <button type="button" className="kakao-button mt-4" onClick={() => signIn("kakao", { callbackUrl: loginPathFor(returnTo) })}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3C6.48 3 2 6.58 2 11c0 2.88 1.9 5.4 4.75 6.81L5.7 21l3.78-2.15c.81.15 1.65.23 2.52.23 5.52 0 10-3.58 10-8.08S17.52 3 12 3Z" /></svg>
          카카오로 계속하기
        </button>
      </InvitePrompt>
    );
  }

  // 화면 04: 지인 확인.
  return (
    <InvitePrompt ownerName={ownerName}>
      <button type="button" className="primary-button mt-4" onClick={handleConfirm} disabled={confirming}>
        {confirming ? "확인하는 중…" : "네, 알고 있어요"}
      </button>
      {confirmError && <p className="error-message" role="alert">{confirmError}</p>}
      <Link href="/" className="text-link text-xs mt-4">잘 모르겠어요</Link>
    </InvitePrompt>
  );
}

function InvitePrompt({ ownerName, children }: { ownerName: string; children: ReactNode }) {
  return (
    <main className="brand-page acquaintance-confirm-page">
      <BrandHeader />
      <div className="duo-art invite-duo-art" role="img" aria-label="서로를 바라보는 감귤 캐릭터 두 마리와 물음표">
        <Character kind="curious" />
        <span className="duo-qmark">?</span>
        <Character kind="curious" className="duo-character-flip" />
      </div>
      <h1 className="acquaintance-question">{ownerName}님을<br />알고 있나요?</h1>
      <p className="pair-result-kicker">실제로 아는 사이라면 알려주세요.</p>
      <div className="acquaintance-actions">{children}</div>
    </main>
  );
}
