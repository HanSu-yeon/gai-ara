"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import type { ChallengePublicInfo } from "@gai-ara/shared";
import { BrandHeader, Centered, Character, StatusMessage } from "@/components/Brand";
import { ChallengePathStrip } from "@/components/ChallengePathStrip";
import { formatConnectionHeadline, formatConnectionPhrase } from "@/lib/distance-copy";
import { trackEvent } from "@/lib/analytics";

type LoadStatus = "loading" | "not-found" | "error" | "ready";

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
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);

  // 404(정말 없는 토큰)와 그 밖의 실패(서버 오류·네트워크 끊김)를 구분한다 —
  // 예전에는 전부 "존재하지 않는 챌린지예요"로 뭉뚱그려서, 잠깐의 오류가
  // 링크가 죽은 것처럼 보였다.
  const loadInfo = () =>
    fetch(`/api/challenges/${token}`)
      .then(async (response) => {
        if (!response.ok) {
          setStatus(response.status === 404 ? "not-found" : "error");
          return;
        }
        const data = (await response.json()) as ChallengePublicInfo;
        setInfo(data);
        setStatus("ready");
      })
      .catch(() => setStatus("error"));

  useEffect(() => {
    loadInfo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  /**
   * 이미 관계를 보태둔 사람이 새 챌린지에 참여할 때 — 업로드를 다시
   * 시키지 않고 참여만 등록한다. 참여의 의미는 "새 데이터를 낸다"가
   * 아니라 "내가 이미 가진 trusted network를 이 챌린지의 시작점으로 써도
   * 된다"이므로, 데이터가 이미 있으면 다시 낼 이유가 없다. 등록 직후
   * 화면을 다시 불러와 진행 상황을 갱신한다 — 내 관계가 target까지
   * 닿는다면 그 순간 챌린지가 풀린다.
   */
  async function handleJoinWithExisting() {
    setJoining(true);
    setJoinError(null);
    try {
      const response = await fetch(`/api/challenges/${token}/join`, { method: "POST" });
      if (!response.ok) throw new Error();
      trackEvent("challenge_join", { source: "existing_data" });
      await loadInfo();
    } catch {
      setJoinError("참여하지 못했어요. 잠시 후 다시 시도해주세요.");
    } finally {
      setJoining(false);
    }
  }

  async function handleShareChallenge() {
    setSharing(true);
    const url = `${window.location.origin}/t/${token}`;
    try {
      if (navigator.share) {
        // `text`를 함께 넘기지 않는다 — 데스크톱 공유 시트의 "복사"가
        // text와 url을 합쳐서 클립보드에 넣어버리고, 그걸 주소창에 붙이면
        // 토큰 뒤에 문장이 따라붙어 "존재하지 않는 챌린지"가 된다.
        // 문구는 이 페이지의 OG 태그(`app/t/[token]/page.tsx`)가 이미
        // 갖고 있어서, 링크만 보내도 카톡·메신저에서 제목·설명·이미지가
        // 미리보기로 붙는다.
        await navigator.share({ title: `우리 진짜 ${info?.displayName ?? ""}까지 닿을 수 있을까?`.trim(), url });
      } else {
        await navigator.clipboard.writeText(url);
      }
      // 공유 시트를 닫아버린(취소) 경우는 위에서 throw되므로 여기 오지 않는다 —
      // "공유를 눌렀다"가 아니라 "실제로 공유/복사까지 갔다"만 센다.
      trackEvent("challenge_share", { status: info?.status ?? "unknown" });
      // 챌린지별 공유 횟수는 GA로 보내지 않고(비공개 챌린지 이름이
      // 구글로 새어 나가지 않게) 우리 DB에만 쌓는다 — 운영자 전용 지표라
      // 실패해도 화면에 영향을 주지 않는다(2026-09-15 결정).
      fetch(`/api/challenges/${token}/share`, { method: "POST" }).catch(() => {});
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

  if (status === "error") {
    return (
      <Centered character="search">
        <StatusMessage>잠시 문제가 생겼어요.<br />잠시 후 다시 열어주세요.</StatusMessage>
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
        <ViewerDistanceNote viewerDistance={info.viewerDistance} />
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
        <span className="duo-dots" aria-hidden="true"><span /><span /><span /></span>
        <Character kind="curious" className="duo-character-flip" />
      </div>
      <h1 className="upload-heading">
        {/*
          이름과 조사("까지")를 한 덩어리로 묶는다 — 이름이 길면
          "김호영(뮤지컬배우) / 까지"처럼 조사만 다음 줄로 떨어져서
          읽기 나빠진다. inline-block이면 통째로 다음 줄로 내려간다.
        */}
        우리 진짜 <span className="challenge-target-name">{info.displayName}까지</span>
        <br />
        닿을 수 있을까?
      </h1>
      <p className="subtitle">
        아직 가는 길을 찾고 있어요.
      </p>
      <ViewerDistanceNote viewerDistance={info.viewerDistance} />

      {info.viewerJoined ? (
        <>
          {/*
            이미 연결을 보탠 사람에게 "나도 연결 보태기"를 다시 내밀지
            않는다(2026-09-15 결정) — 그 사람에게 남은 다음 행동은 연결을
            또 보태는 게 아니라 챌린지를 퍼뜨려 다른 사람의 연결을 부르는
            것이다. 다시 가져오기 자체는 막지 않는다(맞팔은 시간이 지나면
            달라진다) — 메인 CTA에서만 내린다.
          */}
          <button type="button" className="primary-button mt-5" onClick={handleShareChallenge} disabled={sharing}>
            {sharing ? "공유하는 중…" : "챌린지 공유하기"}
          </button>
          <p className="status-caption">친구가 연결을 보태면 길이 열릴 수 있어요.</p>
          <Link
            href={`/upload?step=form&returnTo=${encodeURIComponent(`/t/${token}`)}`}
            className="text-link text-xs mt-4"
            onClick={() => trackEvent("challenge_contribute_click", { source: "rejoin" })}
          >
            아는 사람 더 가져오기 →
          </Link>
        </>
      ) : (
        <>
          {info.viewerHasConnections ? (
            <>
              <button
                type="button"
                className="primary-button mt-5"
                onClick={handleJoinWithExisting}
                disabled={joining}
              >
                {joining ? "참여하는 중…" : "나도 연결 보태기"}
              </button>
              <p className="status-caption">이미 가져온 아는 사람들을 그대로 사용해요.</p>
              {joinError && <p className="error-message" role="alert">{joinError}</p>}
              <Link
                href={`/upload?step=form&returnTo=${encodeURIComponent(`/t/${token}`)}`}
                className="text-link text-xs mt-4"
                onClick={() => trackEvent("challenge_contribute_click", { source: "challenge_more" })}
              >
                인스타에서 더 가져오기 →
              </Link>
            </>
          ) : (
            <>
              <Link
                href={`/upload?step=form&returnTo=${encodeURIComponent(`/t/${token}`)}`}
                className="primary-button mt-5"
                onClick={() => trackEvent("challenge_contribute_click", { source: "challenge" })}
              >
                나도 연결 보태기
              </Link>
              <p className="status-caption">서로 팔로우하는 사람만 연결에 사용해요.</p>
            </>
          )}
          <button type="button" className="public-challenges-more mt-4" onClick={handleShareChallenge} disabled={sharing}>
            {sharing ? "공유하는 중…" : "챌린지 공유하기"}
          </button>
        </>
      )}
    </main>
  );
}

/**
 * 2026-09-15 추가 결정 — 챌린지 전체의 진행 상황과 별개로 "나는 몇 다리인지"를
 * 한 줄로 보여준다. 두 숫자는 서로 다른 질문의 답이라 나란히 있어도 모순이
 * 아니다: 챌린지가 아직 `searching`인데 내게는 길이 있을 수 있고(그때 "나도
 * 연결 보태기"를 누르면 그 순간 챌린지가 풀린다), 챌린지는 이미 `found`인데
 * 나는 닿지 않을 수도 있다.
 *
 * 비로그인이거나 길이 없으면(`null`) 아무것도 그리지 않는다 — "당신은 아직
 * 이어지지 않았어요" 같은 문구는 쓰지 않는다. 아직 데이터를 보태지 않은
 * 사람에게 실패처럼 읽히고, 이 화면의 다음 행동(연결 보태기)은 어차피
 * 바로 아래 버튼이 안내하기 때문이다.
 */
function ViewerDistanceNote({ viewerDistance }: { viewerDistance: number | null }) {
  if (viewerDistance === null) return null;
  return <p className="viewer-distance-note">나는 {formatConnectionPhrase(viewerDistance)}</p>;
}
