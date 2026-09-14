import UploadGuideNav from "@/components/UploadGuideNav";
import { normalizeReturnTo } from "@/lib/return-to";

/**
 * 서버 컴포넌트에서 `searchParams`로 `returnTo`를 읽는다 — 클라이언트
 * `useSearchParams()`를 쓰면 정적 생성 시 Suspense 경계가 필요해지므로
 * (`/upload`, `/connect`, `/login`과 동일하게) 여기서도 서버에서 먼저
 * 읽고 검증한 뒤 클라이언트 컴포넌트에 prop으로 내려준다.
 */
export default async function UploadGuidePage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string | string[] }>;
}) {
  const value = (await searchParams).returnTo;
  const returnTo = normalizeReturnTo(typeof value === "string" ? value : null);
  return <UploadGuideNav returnTo={returnTo} />;
}
