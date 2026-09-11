"use client";

import { useState } from "react";
import { Character, Icon } from "@/components/Brand";

const guideSteps = [
  {
    title: <>인스타 데이터를<br />가져와야 해요</>,
    description: <>인스타에서 팔로워·팔로잉 데이터를<br />다운로드해서 업로드해주세요.</>,
    body: <InstagramSettingsPreview />,
  },
  {
    title: <>이렇게 따라해보세요</>,
    description: <>아래 순서대로 진행하면<br />인스타 데이터를 다운로드할 수 있어요.</>,
    body: <GuideChecklist />,
  },
  {
    title: <>다운로드한 ZIP 파일을<br />업로드해주세요</>,
    description: <>JSON 형식으로 받은 ZIP 파일을<br />풀지 말고 그대로 업로드해주세요.</>,
    body: <ZipUploadPreview />,
  },
  {
    title: <>이제 준비가 끝났어요!</>,
    description: <>업로드한 데이터로<br />다른 사람과의 연결을 찾아볼 수 있어요.</>,
    body: <ReadyPreview />,
  },
];

export function UploadGuide({ onBack, onFinish }: { onBack: () => void; onFinish: () => void }) {
  const [guideStep, setGuideStep] = useState(0);
  const step = guideSteps[guideStep] ?? guideSteps[0]!;
  const isLast = guideStep === guideSteps.length - 1;

  return (
    <main className="brand-page upload-guide-page">
      <header className="guide-header">
        <button type="button" className="back-button" aria-label="이전으로" onClick={() => guideStep === 0 ? onBack() : setGuideStep(guideStep - 1)}>
          <Icon name="back" />
        </button>
        <img className="brand-logo" src="/assets/gai-ara_logo.png" alt="가이 알아?" />
        <span className="guide-count">{guideStep + 1} / {guideSteps.length}</span>
      </header>
      <section className="guide-screen">
        <h1 className="upload-heading">{step.title}</h1>
        <p className="subtitle">{step.description}</p>
        {step.body}
        <button type="button" className="primary-button" onClick={() => isLast ? onFinish() : setGuideStep(guideStep + 1)}>
          {isLast ? "시작하기" : "다음"} <Icon name="arrow" />
        </button>
      </section>
    </main>
  );
}

function InstagramSettingsPreview() {
  return (
    <div className="settings-preview" aria-hidden="true">
      <div className="phone-frame">
        <p>Instagram</p>
        {["설정 및 개인정보", "계정 센터", "내 정보 다운로드", "로그아웃"].map((label, index) => (
          <span key={label} className={index === 2 ? "active" : ""}>{label}</span>
        ))}
      </div>
      <Character kind="default" className="guide-character small" />
    </div>
  );
}

function GuideChecklist() {
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

function ZipUploadPreview() {
  return (
    <div className="zip-upload-preview">
      <div className="sample-file"><div className="zip-badge">ZIP</div><p>instagram-정보-<br />2026-09-12.zip<small>223MB</small></p></div>
      <div className="sample-drop"><Icon name="upload" /><p>여기에 파일을 드래그하거나<br />눌러서 업로드하세요</p><small>ZIP 파일만 가능해요.</small></div>
      <Character kind="wave" className="guide-character corner" />
    </div>
  );
}

function ReadyPreview() {
  return (
    <div className="ready-preview">
      <Character kind="wave" className="guide-character ready" />
      <span className="ready-check" aria-hidden="true">✓</span>
    </div>
  );
}
