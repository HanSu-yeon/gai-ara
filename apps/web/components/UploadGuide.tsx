"use client";

import { Icon } from "@/components/Brand";

const INSTAGRAM_EXPORT_URL = "https://accountscenter.instagram.com/info_and_permissions/dyi?source=external&account_type=1&format=JSON&date_range=ALL_TIME";

/**
 * `/upload/guide` — 인스타 데이터 받는 방법만 보여주는 짧은 화면.
 * "서로 팔로우하는 사람만 연결에 사용"하려면 팔로워·팔로잉 둘 다 있어야
 * 교집합을 계산할 수 있으므로, 체크리스트에 "팔로워 및 팔로잉만 선택"을
 * 명시한다.
 */
export function UploadGuide({ onBack, onFinish }: {
  onBack: () => void;
  onFinish: () => void;
}) {
  return <main className="brand-page upload-guide-page">
    <header className="guide-header">
      <button type="button" className="back-button" aria-label="이전으로" onClick={onBack}><Icon name="back" /></button>
      <img className="brand-logo" src="/assets/gai-ara_logo.png" alt="가이 알아?" />
    </header>
    <section className="guide-screen">
      <h1 className="upload-heading">인스타 데이터<br /><em>받는 방법</em></h1>
      <a className="primary-button" href={INSTAGRAM_EXPORT_URL} target="_blank" rel="noreferrer">
        인스타에서 바로 열기 <Icon name="arrow" />
      </a>
      <GuideChecklist />
      <p className="subtitle">파일이 준비될 때까지 시간이 걸릴 수 있어요.<br />받은 파일은 압축을 풀지 않고 그대로 선택해주세요.</p>
      <button type="button" className="guide-button" onClick={onFinish}>이미 받은 파일 선택하기 <Icon name="arrow" /></button>
    </section>
  </main>;
}

export function GuideChecklist() {
  const steps = [
    ["계정 센터에서", "내 정보 및 권한으로 들어가기"],
    ["내 정보 다운로드", "다운로드 또는 전송 선택하기"],
    ["일부 정보에서", "팔로워 및 팔로잉만 선택하기"],
    ["옵션 설정", "전체 기간 · JSON 형식으로 만들기"],
  ];

  return (
    <ol className="guide-checklist">
      {steps.map(([title, detail], index) => (
        <li key={title}>
          <span>{index + 1}</span>
          <div><strong>{title}</strong><p>{detail}</p></div>
        </li>
      ))}
    </ol>
  );
}
