import Link from "next/link";
import { redirect } from "next/navigation";
import { BrandHeader, Character } from "@/components/Brand";
import { isBackendConfigured } from "@/lib/env";
import { getDisplayName } from "@/lib/participants";
import { getSessionParticipantId } from "@/lib/session";

/**
 * 화면 01(첫 화면). 이미 로그인+표시 이름까지 마친 세션이면 이 랜딩을
 * 보여주지 않고 서버 사이드에서 `/result`로 바로 보낸다 — `BrandHeader`가
 * 클라이언트에서 로고 링크만 바꾸는 것과 달리, 여기서는 페이지 자체를
 * 깜빡임 없이 리다이렉트해야 하므로 서버 컴포넌트에서 세션을 먼저 확인한다.
 */
export default async function LandingPage() {
  if (isBackendConfigured()) {
    const participantId = await getSessionParticipantId();
    if (participantId) {
      const displayName = await getDisplayName(participantId);
      if (displayName) redirect("/result");
    }
  }

  return (
    <main className="brand-page landing-page">
      <BrandHeader />
      <section className="landing-hero">
        <div className="duo-art" role="img" aria-label="마주보는 감귤 캐릭터 두 마리와 물음표">
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
        <Link className="primary-button" href="/login">
          확인해보기
        </Link>
        <section className="landing-basis" aria-labelledby="landing-basis-title">
          <h2 id="landing-basis-title">세상은 생각보다 좁대요</h2>
          <p>
            몇 사람만 거치면 세상 누구와도
            <br />
            이어질 수 있다는 이야기가 있어요.
          </p>
        </section>
      </section>
      <Link href="/privacy" className="footer-link">
        개인정보처리방침
      </Link>
    </main>
  );
}
