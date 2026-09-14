"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import type { ChallengePublicInfo } from "@gai-ara/shared";
import { BrandHeader, Centered, Character, StatusMessage } from "@/components/Brand";
import { ChallengePathStrip } from "@/components/ChallengePathStrip";
import { formatConnectionHeadline } from "@/lib/distance-copy";

type LoadStatus = "loading" | "not-found" | "ready";

/**
 * `/t/{token}` — 2026-09-15 협업형 챌린지 결정의 핵심 화면. 개인 결과
 * 페이지가 아니다: "나는 {target}까지 N다리"가 아니라 "우리가 모은
 * 연결에서 {target}까지 가는 길을 찾았는가"를 보여준다. 전체 그래프는
 * 절대 시각화하지 않는다 — `ChallengePathStrip`이 `distance` 숫자 하나로
 * 익명 원만 그린다(`00_PRODUCT_DECISION_LOG.md` 2026-09-15 항목).
 *
 * 2026-09-15 추가 결정 — challenge main UX에서는 관계를 보태는 방법을
 * Instagram import 하나로만 노출한다. "아는 사람과 연결하기"(`/connect`)를
 * 고르는 바텀시트는 만들지 않는다 — 두 행동(관계 확인용 `/invite`, 챌린지
 * 공유)의 의미가 섞일 수 있고, "확인 링크를 계속 보내라"는 압박처럼 읽힐 수
 * 있기 때문이다. `/connect`/`/invite`는 삭제하지 않는다 — 이 화면의 메인
 * CTA에서만 뺀다. 참여(page view != participation)는 이 버튼을 누른 것만으로
 * 기록되지 않고, `/upload`에서 실제로 가져오기를 완료했을 때
 * `InstagramImportFlow`가 `challenge_participants`에 등록한다(그 시점에
 * 이 참여자가 이미 갖고 있던 confirmed acquaintance 등 다른 trusted edge도
 * 함께 시작점으로 쓸 수 있게 된다). 버튼 라벨은 "나도 연결 보태기"(챌린지
 * 참여형 표현)로 쓰고, 실제로 무엇을 가져오는지는 버튼 아래 보조 문구
 * ("서로 팔로우하는 사람만 연결에 사용해요")와 `/upload` 화면 자체가
 * 설명한다(2026-09-15 카피 정리 결정 — searching 화면의 중복 설명 문장은
 * 제거하고, 첫 문장 + CTA만으로 상황과 행동이 바로 보이게 한다).
 */
export default function TargetChallengeScreen() {
  const params = useParams<{ token: string }>();
  const token = params.token;

  const [status, setStatus] = useState<LoadStatus>("loading");
  const [info, setInfo] = useState<ChallengePublicInfo | null>(null);
  const [sharing, setSharing] = useState(false);

  const loadInfo = () =>
    fetch(`/api/challenges/${token}`)
      .then(async (response) => {
        if (!response.ok) {
          setStatus("not-found");
          return;
        }
        const data = (await response.json()) as ChallengePublicInfo;
        setInfo(data);
        setStatus("ready");
      })
      .catch(() => setStatus("not-found"));

  useEffect(() => {
    loadInfo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function handleShareChallenge() {
    setSharing(true);
    const url = `${window.location.origin}/t/${token}`;
    const text = info ? `우리 진짜 ${info.displayName}까지 닿을 수 있을까?` : "가이 알아? 챌린지에 함께해요.";
    try {
      if (navigator.share) {
        await navigator.share({ title: "가이 알아?", text, url });
      } else {
        await navigator.clipboard.writeText(url);
      }
    } catch {
      // 공유 취소 등 — 조용히 무시한다.
    } finally {
      setSharing(false);
    }
  }

  if (status === "loading") {
    return (
      <Centered character="search">
        <StatusMessage>불러오는 중…</StatusMessage>
      </Centered>
    );
  }

  if (status === "not-found" || !info) {
    return (
      <Centered character="search">
        <StatusMessage>존재하지 않는 챌린지예요.</StatusMessage>
      </Centered>
    );
  }

  if (info.status === "found" && info.distance !== null) {
    const headline = formatConnectionHeadline(info.distance);
    return (
      <main className="brand-page">
        <BrandHeader />
        <h1 className="upload-heading">찾았다!</h1>
        <p className="subtitle mt-2">
          {info.displayName}까지
          <br />
          {headline.top} {headline.bottom === "아는 사이" ? "이어지는 길을 발견했어요" : headline.bottom}
        </p>
        <ChallengePathStrip
          targetDisplayName={info.displayName}
          distance={info.distance}
          lastConnectorCount={info.lastConnectorCount}
          visibleLastConnectorNames={info.visibleLastConnectorNames}
        />
        <button type="button" className="primary-button mt-6" onClick={handleShareChallenge} disabled={sharing}>
          {sharing ? "공유하는 중…" : "챌린지 공유하기"}
        </button>
        <Link href="/create" className="text-link text-xs mt-4">다른 사람으로 만들어보기 →</Link>
      </main>
    );
  }

  return (
    <main className="brand-page">
      <BrandHeader />
      <div className="duo-art" role="img" aria-label="아직 연결을 찾지 못한 귤 캐릭터 두 마리">
        <Character kind="curious" />
        <span className="duo-dots" aria-hidden="true">···</span>
        <Character kind="curious" className="duo-character-flip" />
      </div>
      <h1 className="upload-heading">
        우리 진짜 {info.displayName}까지
        <br />
        닿을 수 있을까?
      </h1>
      <p className="subtitle">
        아직 {info.displayName}까지 가는 길을
        <br />
        찾고 있어요.
      </p>
      <Link href={`/upload?step=form&returnTo=${encodeURIComponent(`/t/${token}`)}`} className="primary-button mt-5">
        나도 연결 보태기
      </Link>
      <p className="status-caption">서로 팔로우하는 사람만 연결에 사용해요.</p>
      <button type="button" className="text-link text-xs mt-4" onClick={handleShareChallenge} disabled={sharing}>
        {sharing ? "공유하는 중…" : "이 챌린지 친구에게 보내기 →"}
      </button>
    </main>
  );
}
