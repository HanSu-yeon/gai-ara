"use client";

import { useRouter } from "next/navigation";
import { UploadGuide } from "@/components/UploadGuide";

/**
 * 2026-09-15 협업형 챌린지 결정 — `/upload`에서 받은 `returnTo`(이미
 * `app/upload/guide/page.tsx`가 서버에서 검증했다)를 다시 `/upload`로
 * 돌아갈 때 그대로 들고 간다.
 */
export default function UploadGuideNav({ returnTo }: { returnTo: string | null }) {
  const router = useRouter();
  const suffix = returnTo ? `?returnTo=${encodeURIComponent(returnTo)}` : "";

  return (
    <UploadGuide
      onBack={() => router.push(`/upload${suffix}`)}
      onFinish={() => router.push(`/upload?step=form${returnTo ? `&returnTo=${encodeURIComponent(returnTo)}` : ""}`)}
    />
  );
}
