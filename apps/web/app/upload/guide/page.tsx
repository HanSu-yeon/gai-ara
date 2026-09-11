"use client";

import { useRouter } from "next/navigation";
import { UploadGuide } from "@/components/UploadGuide";

export default function UploadGuidePage() {
  const router = useRouter();

  return <UploadGuide onBack={() => router.back()} onFinish={() => router.push("/upload")} />;
}
