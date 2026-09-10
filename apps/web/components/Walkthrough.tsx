"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BrandHeader, Character, ConnectionSearchArt, Icon, PrivacyNote, Steps } from "@/components/Brand";

// The current UI review runs without reading files or calling participant APIs.
export function WalkthroughUpload({ friend = false, onComplete }: { friend?: boolean; onComplete?: () => void }) {
  const router = useRouter();
  const [username, setUsername] = useState(friend ? "jeju_friend" : "jeju_orange");
  const [stage, setStage] = useState<"intro" | "select" | "ready" | "processing">("intro");
  useEffect(() => {
    if (stage !== "processing") return;
    const timer = window.setTimeout(() => {
      if (onComplete) onComplete();
      else router.push("/result");
    }, 1800);
    return () => window.clearTimeout(timer);
  }, [stage, onComplete, router]);
  if (stage === "intro") return <main className="brand-page upload-explainer">
    <BrandHeader back />
    <p className="explainer-eyebrow">우리 사이가 궁금하다면</p>
    <h1 className="upload-heading">인스타 팔로워·팔로잉<br />파일을 <em>준비해주세요</em></h1>
    <p className="subtitle">여기서 인스타에 로그인할 필요 없어요.<br />인스타에서 받은 파일만 가져오면 돼요.</p>
    <div className="export-illustration" role="img" aria-label="귤 캐릭터가 인스타 데이터를 ZIP 파일로 가져오는 모습">
      <Character kind="default" />
      <span className="instagram-paper" aria-hidden="true"><Icon name="instagram" /><i /><i /><i /></span>
      <span className="export-arrow" aria-hidden="true"><Icon name="arrow" /></span>
      <span className="zip-illustration" aria-hidden="true">ZIP</span>
    </div>
    <button className="primary-button" onClick={() => { setStage("select"); window.scrollTo(0, 0); }}><Icon name="upload" />파일 가져오기</button>
    <details className="guide explainer-guide"><summary>데이터 받는 법 보기</summary><ol><li>인스타그램 설정에서 계정 센터로 들어가세요.</li><li>내 정보 다운로드에서 팔로워·팔로잉을 선택하세요.</li><li>JSON 형식과 전체 기간을 선택해 다운로드하세요.</li><li>준비된 ZIP 파일을 가져오면 돼요.</li></ol></details>
  </main>;
  return <main className="brand-page upload-page"><BrandHeader back />
    {stage === "select" && <button className="upload-guide-back" onClick={() => { setStage("intro"); window.scrollTo(0, 0); }}>‹ 파일 준비 안내로 돌아가기</button>}
    <Steps active={stage === "processing" ? 1 : 0} />
    {stage === "processing" ? <section className="analysis-state" role="status" aria-live="polite">
      <h1 className="upload-heading">{friend ? <>우리 사이의 연결을<br /><em>찾고 있어요</em></> : <>내 연결 데이터를<br /><em>준비하고 있어요</em></>}</h1>
      <ConnectionSearchArt /><p className="subtitle">{friend ? "몇 다리 건너 아는 사이일까요?" : "친구와 연결을 확인할 준비를 하고 있어요."}</p>
      <div className="progress-track" /><p className="status-caption">잠시만 기다려주세요.</p>
    </section> : <>
      <h1 className="upload-heading">{stage === "ready" ? <>파일 준비가<br /><em>끝났어요!</em></> : <>인스타 <em>ZIP 파일</em>을<br />가져와 주세요</>}</h1>
      <p className="subtitle">{friend ? <>나도 참여하면, 링크를 보낸 사람과<br />몇 다리인지 확인할 수 있어요.</> : <>인스타에서 받은 데이터로<br />친구와의 연결을 찾아볼게요.</>}</p>
      <div className="upload-art"><Character kind="default" /><span className="zip-illustration" aria-hidden="true">ZIP</span></div>
      {stage === "select" ? <button className="drop-zone walkthrough-file" onClick={() => setStage("ready")}><span className="feature-icon"><Icon name="upload" /></span><strong>눌러서 파일 가져오기</strong><small>지금은 파일 없이 다음 단계로 진행돼요.</small></button> : <div className="selected-file"><span className="zip-badge">ZIP</span><div><strong>instagram-data.zip</strong><p>팔로워 · 팔로잉 데이터 준비 완료</p></div><span aria-label="준비 완료">✓</span></div>}
      {stage === "ready" && <div className="mt-6 text-left">
        <label htmlFor="confirm-username" className="field-label">내 계정이 맞나요?</label>
        <input id="confirm-username" className="username-input" value={username} onChange={(event) => setUsername(event.target.value)} autoCapitalize="none" autoCorrect="off" spellCheck={false} aria-describedby="confirm-username-note" />
        <p id="confirm-username-note" className="text-xs text-ink/50">자동 입력된 예시 아이디예요. 다르면 수정할 수 있어요.</p>
      </div>}
      <PrivacyNote />
      {stage === "ready" && <button className="primary-button mt-6" disabled={!/^@?[A-Za-z0-9._]{1,30}$/.test(username.trim())} onClick={() => setStage("processing")}>{friend ? "우리 몇 다리인지 확인하기" : "내 계정이 맞아요 · 계속하기"}<Icon name="arrow" /></button>}
      <details className="guide"><summary>인스타 데이터 받는 법 보기</summary><ol><li>인스타그램 설정에서 계정 센터로 들어가세요.</li><li>내 정보 다운로드에서 팔로워·팔로잉을 선택하세요.</li><li>JSON 형식과 전체 기간을 선택해 다운로드하세요.</li></ol></details>
    </>}
  </main>;
}

export function WalkthroughShare() {
  const [url, setUrl] = useState("");
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);
  async function copy() {
    try { await navigator.clipboard.writeText(url); setCopied(true); setCopyError(false); }
    catch { setCopyError(true); }
  }
  return <main className="brand-page result-page"><BrandHeader home />
    <p className="handwritten">이제 준비됐어요!</p>
    <h1 className="upload-heading">아는 사람에게<br /><em>링크를 보내볼까요?</em></h1>
    <p className="subtitle">친구도 함께하면<br />우리 둘이 얼마나 가까운지 알려드릴게요.</p>
    <Character kind="heart" className="result-character" />
    {!url ? <button className="primary-button" onClick={() => setUrl(`${window.location.origin}/pair/our-connection`)}><Icon name="link" />링크 만들기 <Icon name="arrow" /></button> : <>
      <div className="invite-box"><input aria-label="초대 링크" value={url} readOnly onFocus={(event) => event.target.select()} /><button onClick={copy}>{copied ? "복사 완료!" : "복사하기"}</button></div>
      {copyError && <p className="error-message" role="alert">링크를 길게 눌러 직접 복사해주세요.</p>}
      <div className="waiting-card" role="status"><strong>친구의 참여를 기다리고 있어요</strong><p>친구도 참여하면 둘의 결과가 열려요.</p></div>
      <Link className="primary-button" href="/pair/our-connection">받은 링크 열어보기 <Icon name="arrow" /></Link>
    </>}
    <p className="result-note">링크를 받은 사람도 자신의 데이터를 가져와야 해요.<br />누가 누구를 아는지는 공개하지 않아요.</p>
  </main>;
}

export function WalkthroughPair() {
  const [stage, setStage] = useState<"invite" | "upload" | "result">("invite");
  if (stage === "upload") return <WalkthroughUpload friend onComplete={() => { setStage("result"); window.scrollTo(0, 0); }} />;
  return <main className="brand-page"><BrandHeader home />
    {stage === "invite" ? <>
      <p className="handwritten">연결 초대가 도착했어요!</p>
      <h1 className="upload-heading">우리, 생각보다<br /><em>가까운 사이</em>일지도?</h1>
      <Character kind="wave" className="result-character" />
      <p className="subtitle">친구가 초대했어요.<br />숨어 있는 우리 사이의 연결을 찾아봐요.</p>
      <button className="primary-button mt-8" onClick={() => { setStage("upload"); window.scrollTo(0, 0); }}>나도 참여하기 <Icon name="arrow" /></button>
    </> : <>
      <p className="handwritten">우리 사이의 연결을 찾았어요!</p>
      <h1 className="upload-heading">우리는<br /><em>3다리</em> 건너 아는 사이!</h1>
      <Character kind="heart" className="result-character" />
      <div className="distance-chain" aria-label="나와 상대 사이 세 번의 연결"><span>나</span><i /><span>?</span><i /><span>?</span><i /><span>상대</span></div>
      <p className="subtitle">생각보다 가까운 우리,<br />어쩌면 이미 스쳐 지나갔을지도 몰라요.</p>
      <p className="result-note">화면 확인용 예시 결과예요.</p>
      <Link href="/result" className="primary-button mt-8">다른 친구에게도 보내기 <Icon name="arrow" /></Link>
    </>}
  </main>;
}
