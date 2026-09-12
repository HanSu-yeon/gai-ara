"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { UploadFlow } from "@/components/UploadFlow";
import { GuideChecklist } from "@/components/UploadGuide";
import { BrandHeader, Character, Icon } from "@/components/Brand";
import { trackEvent } from "@/lib/analytics";
import { importSource, markExportOpened, markFileStepOpened, readImportProgress, saveImportProgress, clearImportProgress, type ImportProgress } from "@/lib/import-progress";

const INSTAGRAM_EXPORT_URL = "https://accountscenter.instagram.com/info_and_permissions/dyi?source=external&account_type=1&format=JSON&date_range=ALL_TIME";

export function ConnectionExample() {
  return <section className="connection-example" aria-label="연결 예시">
    <span className="explainer-eyebrow">예시 · 실제 결과가 아니에요</span>
    <p className="example-path"><span>나</span><b aria-hidden="true">→</b><span>친구</span><b aria-hidden="true">→</b><span>상대방</span></p>
    <strong>친구 한 명을 건너면, 한 다리 건너 아는 사이</strong>
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
      <div className="export-checklist">
        <p className="export-checklist-title">이것만 선택하면 돼요</p>
        <p>일부 정보 → <strong>팔로워 및 팔로잉</strong></p>
        <p>형식 → <strong>JSON</strong></p>
      </div>
      <a className="primary-button mt-6" href={INSTAGRAM_EXPORT_URL} target="_blank" rel="noreferrer" onClick={() => {
        markExportOpened(path);
        setReadyToUpload(true);
        trackEvent("instagram_export_open", { source });
      }}>인스타에서 받기 <Icon name="arrow" /></a>
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

/**
 * 홈에 다시 들어왔을 때 "인스타에서 파일 받으셨나요?" 화면으로 곧장 맞이한다.
 * 인스타 export 처리는 몇 분~며칠까지 걸릴 수 있어서, 그 사이 사용자가
 * 서비스 이름 자체를 잊어버려도 다시 도메인만 치면 이 화면이 붙잡아준다 —
 * 작은 배너(ResumeImport)로는 놓치기 쉬워서, 내보내기까지 이미 다녀온
 * 상태(fileStepOpenedAt)라면 랜딩 대신 이 화면으로 완전히 대체한다.
 */
export function ImportReturnGate({ children }: { children: ReactNode }) {
  // localStorage는 서버에서 읽을 수 없어서, 처음엔 항상 children(랜딩)으로
  // 그린다 — 대다수인 첫 방문자는 깜빡임 없이 바로 보이고, 복귀 중인
  // 소수만 마운트 직후 이 화면으로 잠깐 전환된다.
  const [progress, setProgress] = useState<ImportProgress | null>(null);

  useEffect(() => {
    const saved = readImportProgress();
    setProgress(saved);
    if (saved?.fileStepOpenedAt && saved.exportOpenedAt) {
      trackEvent("import_return_shown", {
        source: importSource(saved.path),
        seconds_since_export_open: Math.max(0, Math.floor((Date.now() - saved.exportOpenedAt) / 1000)),
      });
    }
  }, []);

  if (!progress?.fileStepOpenedAt) return <>{children}</>;
  const source = importSource(progress.path);

  return (
    <main className="brand-page">
      <BrandHeader />
      <Character kind="heart" className="result-character" />
      <h1 className="upload-heading">인스타 파일<br /><em>받으셨나요?</em></h1>
      <p className="subtitle">받았다면 압축을 풀지 말고<br />그대로 가져오면 돼요.</p>
      <Link href={progress.path} className="primary-button mt-6" onClick={() => trackEvent("import_return_continue", { source })}>
        파일 가져오기 <Icon name="arrow" />
      </Link>
      <a href={INSTAGRAM_EXPORT_URL} target="_blank" rel="noreferrer" className="text-link text-xs mt-4" onClick={() => trackEvent("import_return_recheck", { source })}>
        아직 안 왔어요 · 받는 곳 다시 보기
      </a>
      <button type="button" className="text-link text-xs mt-4" onClick={() => {
        trackEvent("import_return_reset", { source });
        clearImportProgress(progress.path);
        setProgress(null);
      }}>
        처음부터 다시 할게요
      </button>
    </main>
  );
}

/**
 * fileStepOpenedAt이 있는 경우는 ImportReturnGate가 먼저 화면 전체를
 * 가로채므로, 여기까지 내려오는 건 항상 그보다 이른 단계다.
 */
export function ResumeImport() {
  const [progress, setProgress] = useState<ReturnType<typeof readImportProgress>>(null);
  useEffect(() => { setProgress(readImportProgress()); }, []);
  if (!progress || progress.path === "/upload") return null;
  return <Link className="guide-button" href={progress.path} onClick={() => {
    trackEvent("import_resume_click", { source: importSource(progress.path), entry: "home" });
  }}>
    인스타 데이터 가져오기 이어서 하기 <Icon name="arrow" />
  </Link>;
}
