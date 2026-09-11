"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { BrandHeader, Character, Icon } from "@/components/Brand";
import { UploadFlow } from "@/components/UploadFlow";

export default function UploadPage() {
  const router = useRouter();

  return (
    <main className="brand-page upload-page">
      <BrandHeader back />
      <section className="upload-intro">
        <p className="explainer-eyebrow">연결을 찾으려면</p>
        <h1 className="upload-heading">
          인스타 <em>팔로잉</em><br />데이터가 필요해요
        </h1>
        <p className="subtitle">
          비밀번호나 로그인은 필요 없어요.<br />인스타에서 받은 파일만 가져오면 돼요.
        </p>
        <div className="export-illustration" aria-label="귤 캐릭터가 인스타 데이터 파일을 ZIP 파일로 가져오는 모습">
          <Character kind="default" />
          <div className="instagram-paper" aria-hidden="true">
            <Icon name="instagram" />
            <i /><i /><i />
          </div>
          <span className="export-arrow"><Icon name="arrow" /></span>
          <div className="zip-illustration" aria-hidden="true">ZIP</div>
        </div>
      </section>
      <UploadFlow onUploaded={() => router.push("/result")} />
      <Link href="/upload/guide" className="guide-button">
        데이터 받는 법 보기 <Icon name="arrow" />
      </Link>
    </main>
  );
}
