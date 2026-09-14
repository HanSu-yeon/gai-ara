import Link from "next/link";
import Image from "next/image";
import { BrandHeader, Character } from "@/components/Brand";
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
 * 2026-09-15 추가 결정 — 랜딩 본문은 메인 후킹("혹시 나도 유명인이랑
 * 건너건너 아는 사이일까?")과 CTA 그대로 두고 아무것도 더하지 않는다.
 * 공개 챌린지(`/challenges`)로 가는 입구는 헤더 우측 끝의 "챌린지 구경"
 * 알약 하나뿐이다(`BrandHeader`의 `explore`) — 홈 본문에 섹션까지 두면
 * 한 화면에 같은 목적지 버튼이 두 개가 되고, 랜딩의 시선이 메인 CTA에서
 * 분산된다. 덕분에 이 페이지는 공개 챌린지 때문에 DB를 읽지 않는다.
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
            여럿이 아는 관계를 하나씩 보태면
            <br />
            궁금한 사람까지 이어지는 길을 찾을 수 있어요.
          </p>
        </section>
      </section>
      <Link href="/privacy" className="footer-link">
        개인정보처리방침
      </Link>
    </main>
  );
}
