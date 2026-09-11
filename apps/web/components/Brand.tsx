import Link from "next/link";
import Image from "next/image";

export function Icon({ name, className = "" }: { name: "arrow" | "back" | "lock" | "instagram" | "share" | "upload" | "link"; className?: string }) {
  const paths = { arrow: "M5 12h14m-6-6 6 6-6 6", back: "m14 5-7 7 7 7", lock: "M7 10V7a5 5 0 0 1 10 0v3M5 10h14v11H5zM12 14v3", instagram: "M7 3h10a4 4 0 0 1 4 4v10a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V7a4 4 0 0 1 4-4Zm9 9a4 4 0 1 1-8 0 4 4 0 0 1 8 0M17 7h.01", share: "m8 11 8-5M8 13l8 5M8 12a2 2 0 1 1-4 0 2 2 0 0 1 4 0m12-7a2 2 0 1 1-4 0 2 2 0 0 1 4 0m0 14a2 2 0 1 1-4 0 2 2 0 0 1 4 0", upload: "M12 16V3m-5 5 5-5 5 5M5 11H3v10h18V11h-2", link: "m10 14 4-4m-6 2-2 2a4 4 0 0 0 6 6l3-3a4 4 0 0 0 0-6m1 1 2-2a4 4 0 0 0-6-6L9 7a4 4 0 0 0 0 6" };
  return <svg className={className} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name]} /></svg>;
}
export function BrandHeader({ back = false, home = false }: { back?: boolean; home?: boolean }) {
  return <header className={`brand-header ${back ? "center-logo" : ""}`}>{back && <Link className="back-button" href="/" aria-label="처음으로 돌아가기"><Icon name="back" /></Link>}<Link href="/" aria-label="가이 알아? 홈"><Image className="brand-logo" src="/assets/gai-ara_logo.png" width={150} height={50} priority alt="가이 알아?" /></Link>{!back && <Link className="small-link" href={home ? "/" : "/#about"}>{home ? "처음으로" : "소개보기"}<Icon name="arrow" /></Link>}</header>;
}
export function Character({ kind = "wave", className = "" }: { kind?: "wave" | "search" | "heart" | "default" | "curious"; className?: string }) {
  return <Image src={`/assets/gamgyul-${kind}.png`} alt="귤 캐릭터" width={300} height={320} className={`character ${className}`} />;
}
export function Steps({ active }: { active: number }) {
  return <ol className="steps">{["파일 업로드", "분석 중", "결과 확인"].map((label, i) => <li key={label} className={active === i ? "active" : ""} aria-current={active === i ? "step" : undefined}><span>{i + 1}</span>{label}</li>)}</ol>;
}
export function PrivacyNote() { return <div className="privacy-note"><Icon name="lock" /><div><strong>연결 계산에 필요한 정보만 사용해요.</strong></div></div>; }

export function ConnectionSearchArt() {
  return <div className="connection-search-art" role="img" aria-label="돋보기를 든 귤이 사람들 사이의 연결을 찾는 모습">
    <svg className="search-connections" viewBox="0 0 360 230" fill="none" aria-hidden="true">
      <path d="M85 35C15 45 5 135 80 155S125 195 170 180M265 30C210 75 320 80 315 130S290 190 235 170" stroke="#b8d2b3" strokeWidth="2" strokeDasharray="5 7" />
      {[[85,35],[30,100],[80,155],[265,30],[315,100],[280,175]].map(([x,y],i) => <g key={i} transform={`translate(${x} ${y})`}>
        <circle r="21" fill={i % 2 ? "#ffeddd" : "#e2eedb"} />
        <circle cy="-5" r="5" fill={i % 2 ? "#f8a36c" : "#5f9870"} />
        <path d="M-8 10v-4a8 8 0 0 1 16 0v4z" fill={i % 2 ? "#f8a36c" : "#5f9870"} />
      </g>)}
    </svg>
    <Character kind="curious" />
  </div>;
}
