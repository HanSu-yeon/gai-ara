"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { UploadGuide } from "@/components/UploadGuide";
import { importSource, markExportOpened, markFileStepOpened, readImportProgress, saveImportProgress } from "@/lib/import-progress";
import { trackEvent } from "@/lib/analytics";

export default function UploadGuidePage() {
  const router = useRouter();
  const recorded = useRef(false);
  const guideOpenedAt = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (recorded.current) return;
    recorded.current = true;
    guideOpenedAt.current = Date.now();
    const existing = readImportProgress();
    if (existing) saveImportProgress(existing.path, true);
    trackEvent("download_guide_open", { source: importSource(existing?.path ?? "/upload") });
  }, []);
  const returnToImport = () => router.push(readImportProgress()?.path ?? "/upload");
  const continueToFile = () => {
    const path = readImportProgress()?.path ?? "/upload";
    markFileStepOpened(path, guideOpenedAt.current);
    router.push(path);
  };
  const openInstagram = () => {
    const path = readImportProgress()?.path ?? "/upload";
    markExportOpened(path, guideOpenedAt.current);
    trackEvent("instagram_export_open", { source: importSource(path) });
  };
  return <UploadGuide onBack={returnToImport} onFinish={continueToFile} onOpenInstagram={openInstagram} />;
}
