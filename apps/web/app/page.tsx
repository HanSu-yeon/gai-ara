import Link from "next/link";
import Image from "next/image";
import { BrandHeader, Character } from "@/components/Brand";
import { PublicChallengeEntry } from "@/components/PublicChallengeList";
import { isBackendConfigured } from "@/lib/env";
import { getDisplayName } from "@/lib/participants";
import { getSessionParticipantId } from "@/lib/session";

/**
 * 화면 01(첫 화면). 홈은 그래프를 보여주는 곳이 아니라 훅(hook)만
 * 담당한다(2026-09-15 협업형 챌린지 결정 §18) — CTA는 더 이상 `/result`로
 * 보내지 않고 챌린지 생성(`/create`)으로 이어진다.
 *
 * **2026-09-15 수정 — 로그인+표시 이름을 마친 세션을 `/create`로
 * 리다이렉트하던 동작을 없앴다.** 로고를 눌러도 `/`에 머물 수 없어서
 * 답답하고(헤더 로고는 항상 `/`를 가리킨다), 랜딩에만 있는 것들(공개
 * 챌린지 입구, 개인정보처리방침)에 기존 사용자가 도달할 방법이 사라지는
 * 문제가 있었다. 대신 세션 상태에 따라 메인 CTA의 목적지만 바꾼다 — 이미
 * 로그인+표시 이름이 끝났으면 `/login`을 한 번 거치게 하지 않고 곧장
 * `/create`로 보낸다.
 *
 * 2026-09-15 추가 결정 — 메인 후킹("혹시 나도 유명인이랑 건너건너 아는
 * 사이일까?")과 CTA는 그대로 두고, 그 아래에 "이 사람까지 진짜 이어질까?"
 * 공개 챌린지 입구(`PublicChallengeEntry`)를 둔다. 아직 만들 대상이
 * 떠오르지 않은 첫 방문자가 남이 만든 챌린지를 눌러 바로 참여해볼 수 있는
 * 입구다 — 목록은 그리지 않고 `/challenges`로 가는 버튼만 둔다. 헤더 우측
 * 알약은 "내 챌린지"(`/me`)가 쓰므로 한 화면에 같은 목적지 버튼이 두 개
 * 생기지 않는다. 이 섹션은 DB를 읽지 않는다.
 */
export default async function LandingPage() {
  let ready = false;
  if (isBackendConfigured()) {
    const participantId = await getSessionParticipantId();
    if (participantId) ready = Boolean(await getDisplayName(participantId));
  }
  const createHref = ready ? "/create" : "/login?returnTo=/create";

  return (
    <main className="brand-page landing-page">
      <BrandHeader />
      <section className="landing-hero">
        <div
          className="duo-art"
          role="img"
          aria-label="마주보는 감귤 캐릭터 두 마리와 물음표"
        >
          <Character kind="curious" />
          <span className="duo-qmark">?</span>
          <Character kind="curious" className="duo-character-flip" />
        </div>
        <h1>
          혹시 나도 유명인이랑
          <br />
          건너건너 아는 사이일까?
        </h1>
        <p className="subtitle">
          아는 사람을 따라가다 보면
          <br />
          생각지도 못한 사람과 이어질지도 몰라요.
        </p>
        <Link className="primary-button" href={createHref}>
          챌린지 만들어보기
        </Link>
        <PublicChallengeEntry />
        <section
          className="landing-basis"
          aria-labelledby="landing-basis-title"
        >
          <h2 id="landing-basis-title">생각보다 가까울지도 몰라요</h2>
          <div
            className="mini-path"
            role="img"
            aria-label="나로부터 몇 사람을 거쳐 누군가에게 이어지는 경로"
          >
            <div className="mini-path-item">
              <Image
                src="/assets/gamgyul-default.png"
                alt=""
                width={80}
                height={86}
                className="mini-path-character"
              />
              <span className="mini-path-caption">나</span>
            </div>
            <span className="mini-path-line" />
            <div className="mini-path-item">
              <span className="mini-path-dot" />
            </div>
            <span className="mini-path-line" />
            <div className="mini-path-item">
              <span className="mini-path-dot" />
            </div>
            <span className="mini-path-line" />
            <div className="mini-path-item">
              <span className="mini-path-dot" />
            </div>
            <span className="mini-path-line" />
            <div className="mini-path-item">
              <span className="mini-path-qmark">?</span>
              <span className="mini-path-caption">궁금한 사람</span>
            </div>
          </div>
          <p>
            아는 사이가 모이면
            <br />
            궁금한 사람까지 건너건너 이어질 수 있어요.
          </p>
          {/*
            2026-09-16 추가 — 본문보다 확실히 작고 연하게 둔다. 이 카드의
            주장(생각보다 가까울지도 몰라요)을 방해하지 않으면서, 참여를
            망설이게 하는 사생활 걱정을 그 자리에서 바로 풀어준다 —
            `InstagramImportFlow.tsx`/`TargetChallengeScreen.tsx`의 같은
            안심 문구와 짝을 이룬다.
          */}
          <p className="landing-basis-privacy-note">
            건너건너 이어지는 중간 사람의 이름이나
            <br />
            인스타 계정은 공개되지 않아요.
          </p>
        </section>
      </section>
      <Link href="/privacy" className="footer-link">
        개인정보처리방침
      </Link>
    </main>
  );
}
