import Link from "next/link";
import { ImportReturnGate, ResumeImport } from "@/components/ImportOnboarding";
import { BrandHeader, Character, Icon } from "@/components/Brand";

export default function LandingPage() {
  return <ImportReturnGate><main className="brand-page landing-page">
    <BrandHeader />
    <ResumeImport />
    <section className="landing-hero">
      <h1>제주,<br /><em>몇 다리</em> 건너면<br />다 아는 사이일까?</h1>
      <p className="subtitle">생각보다, 우리는 가까이 연결되어 있어요.</p>
      <div className="network-art" aria-label="귤 캐릭터를 중심으로 이어진 사람들의 연결">
        <svg viewBox="0 0 400 210" className="network-lines" aria-hidden="true"><path d="M35 90Q120 80 180 145T360 150" stroke="#ffad78" /><path d="M20 180 60 145 35 90 95 25Q150 30 180 145M270 165Q325 155 320 85L385 55" stroke="#b9d6be" strokeDasharray="4 5" /></svg>
        {[ [5,80], [12,38], [25,5], [24,68], [69,70], [86,63], [92,23] ].map(([x,y], i) => <span key={i} className={`person person-${i}`} style={{left:`${x}%`,top:`${y}%`}}><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="7" r="4"/><path d="M4 21v-4a8 8 0 0 1 16 0v4z"/></svg></span>)}
        <Character /><span className="speech">우리<br />생각보다<br />가깝네?</span>
      </div>
      <Link className="primary-button" href="/upload">내 연결 확인하기 <Icon name="arrow" /></Link>
    </section>
    <section className="features" aria-label="서비스 특징">
      <div><span className="feature-icon"><Icon name="instagram" /></span><p>내 인스타 데이터로<strong>간단하게</strong></p></div>
      <div><span className="feature-icon peach"><Icon name="share" /></span><p>참여할수록 커지는<strong>네트워크</strong></p></div>
      <div><span className="feature-icon"><Icon name="link" /></span><p>링크 하나로<strong>우리 사이 확인</strong></p></div>
    </section>
    <section id="about" className="about-card"><Character kind="search" /><div><span className="handwritten">가이 알아?</span><p>친구의 친구를 따라가다 보면<br />생각보다 가까운 사이일지도 몰라요.</p></div></section>
    <Link href="/upload/guide" className="guide-button">데이터 받는 법 보기 <Icon name="arrow" /></Link>
    <Link href="/privacy" className="footer-link">개인정보처리방침</Link>
  </main></ImportReturnGate>;
}
