"use client";

import { useRouter } from "next/navigation";
import { BrandHeader } from "@/components/Brand";
import { UploadFlow } from "@/components/UploadFlow";

export default function UploadPage() {
  const router = useRouter();

  return (
    <main className="brand-page upload-page">
      <BrandHeader back />
      <h1 className="upload-heading">
        인스타 <em>ZIP 파일</em>을<br />가져와 주세요
      </h1>
      <p className="subtitle mb-6">
        인스타에서 받은 데이터로<br />친구와의 연결을 찾아볼게요.
      </p>
      <UploadFlow onUploaded={() => router.push("/result")} />
    </main>
  );
}
