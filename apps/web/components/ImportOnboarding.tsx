"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { UploadFlow } from "@/components/UploadFlow";
import { GuideChecklist } from "@/components/UploadGuide";
import { Icon } from "@/components/Brand";
import { trackEvent } from "@/lib/analytics";
import { clearImportProgress, importSource, markExportOpened, markFileStepOpened, readImportProgress, saveImportProgress } from "@/lib/import-progress";

const INSTAGRAM_EXPORT_URL = "https://accountscenter.instagram.com/info_and_permissions/dyi?source=external&account_type=1&format=JSON&date_range=ALL_TIME";

export function ConnectionExample() {
  return <section className="connection-example" aria-label="연결 예시">
    <span className="explainer-eyebrow">예시 · 실제 결과가 아니에요</span>
    <p className="example-path"><span>나</span><b aria-hidden="true">→</b><span>친구</span><b aria-hidden="true">→</b><span>상대방</span></p>
    <strong>친구 한 명을 건너면, 2다리 사이</strong>
    <p>참여한 사람들의 맞팔 연결로 몇 다리인지 알아봐요.<br />실제 결과에는 중간 사람의 이름이 나오지 않아요.</p>
  </section>;
}

export function ImportOnboarding({ onUploaded }: { onUploaded: () => void | Promise<void> }) {
  const path = usePathname();
  const source = importSource(path);
  const [started, setStarted] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const [resumed, setResumed] = useState(false);
  const [readyToUpload, setReadyToUpload] = useState(false);
  const [device, setDevice] = useState<"ios" | "android" | "other">("other");

  useEffect(() => {
    const saved = readImportProgress();
    if (saved?.path === path) {
      setStarted(true);
      setResumed(true);
      setReadyToUpload(Boolean(saved.fileStepOpenedAt));
    }
    const agent = navigator.userAgent;
    setDevice(/iPad|iPhone|iPod/.test(agent) ? "ios" : /Android/i.test(agent) ? "android" : "other");
  }, [path]);

  function start() {
    saveImportProgress(path);
    setStarted(true);
    trackEvent("start_click", { source });
  }

  function continueToFile() {
    setReadyToUpload(true);
    markFileStepOpened(path);
  }

  return <section className="import-onboarding">
    {!started ? <>
      <ConnectionExample />
      <button type="button" className="primary-button" onClick={start}>내 연결 알아보기 <Icon name="arrow" /></button>
      <p className="status-caption">연결 확인에는 인스타에서 받은 데이터가 필요해요.</p>
    </> : !readyToUpload ? <>
      <h2 className="import-title">인스타 데이터 가져오기</h2>
      <p className="subtitle">Instagram에서 팔로워 및 팔로잉 데이터만<br />JSON 형식·전체 기간으로 요청해주세요.</p>
      <a className="primary-button mt-6" href={INSTAGRAM_EXPORT_URL} target="_blank" rel="noreferrer" onClick={() => {
        markExportOpened(path);
        setReadyToUpload(true);
        trackEvent("instagram_export_open", { source });
      }}>인스타 데이터 요청하기 <Icon name="arrow" /></a>
      <button type="button" className="guide-button" onClick={continueToFile}>이미 받은 파일이 있어요</button>
      <button type="button" className="guide-button" aria-expanded={guideOpen} aria-controls="import-guide" onClick={() => {
        if (!guideOpen) {
          saveImportProgress(path, true);
          trackEvent("download_guide_open", { source });
        }
        setGuideOpen(!guideOpen);
      }}>{guideOpen ? "가이드 접기" : "어디서 받나요?"}</button>
      {guideOpen && <section id="import-guide" className="inline-import-guide">
        <h3>인스타 데이터 받는 방법</h3>
        <GuideChecklist />
      </section>}
    </> : <>
      <h2 className="import-title">받은 파일 선택하기</h2>
      <p className="subtitle">Instagram에서 준비 완료 알림을 받으면<br />아래 버튼으로 다시 들어가 ZIP을 내려받아주세요.</p>
      <a className="primary-button mt-6" href={INSTAGRAM_EXPORT_URL} target="_blank" rel="noreferrer" onClick={() => {
        markExportOpened(path);
        trackEvent("instagram_export_reopen", { source });
      }}>인스타에서 준비된 파일 받기 <Icon name="arrow" /></a>
      <p className="status-caption">다운로드가 끝나면 이 화면으로 돌아와 아래에서 파일을 선택해주세요.</p>
      {device === "ios" && <p className="file-location-hint">iPhone: 파일 앱 → 다운로드에서 찾아보세요.</p>}
      {device === "android" && <p className="file-location-hint">Android: 내 파일 → Download에서 찾아보세요.</p>}
      {resumed && <p className="resume-note" role="status">기다려주셔서 고마워요. 여기서 이어서 확인할 수 있어요.</p>}
      <UploadFlow source={source} onUploaded={async () => {
        await onUploaded();
        clearImportProgress(path);
      }} />
    </>}
  </section>;
}

export function ResumeImport() {
  const [progress, setProgress] = useState<ReturnType<typeof readImportProgress>>(null);
  useEffect(() => { setProgress(readImportProgress()); }, []);
  if (!progress) return null;
  return <Link className="guide-button" href={progress.path} onClick={() => {
    trackEvent("import_resume_click", { source: importSource(progress.path), entry: "home" });
  }}>
    {progress.fileStepOpenedAt ? "인스타 파일 받으셨나요? 이어서 확인하기" : "인스타 데이터 가져오기 이어서 하기"} <Icon name="arrow" />
  </Link>;
}
