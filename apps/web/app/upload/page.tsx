"use client";

import { useRouter } from "next/navigation";
import { BrandHeader, Character } from "@/components/Brand";
import { ImportOnboarding } from "@/components/ImportOnboarding";

export default function UploadPage() {
  const router = useRouter();
  return <main className="brand-page upload-page">
    <BrandHeader back />
    <section className="upload-intro">
      <h1 className="upload-heading">생각보다 가까운<br /><em>우리 사이</em></h1>
      <p className="subtitle">친구의 친구를 따라가면<br />몇 다리 건너 아는 사이일까요?</p>
      <Character kind="wave" className="result-character" />
    </section>
    <ImportOnboarding onUploaded={() => router.push("/result")} />
  </main>;
}
