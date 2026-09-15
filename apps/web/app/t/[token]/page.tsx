import type { Metadata } from "next";
import TargetChallengeScreen from "@/components/TargetChallengeScreen";
import { getChallengePublicInfo } from "@/lib/challenges";
import { isBackendConfigured } from "@/lib/env";

const SHARE_IMAGE = { url: "/assets/gamgyul-wave.png", width: 1234, height: 1274, alt: "인사하는 감귤 캐릭터" };

const GENERIC_TITLE = "우리 진짜 닿을 수 있을까? · 가이 알아?";
const DESCRIPTION = "여러 사람이 각자 아는 사람을 보태서, 궁금한 사람까지 이어지는 길을 함께 찾아가요.";

/**
 * 2026-09-15 — 공유 미리보기(`openGraph`/`twitter`)에만 대상 이름을 넣고,
 * 브라우저 탭 제목(`title`)은 항상 대상과 무관한 문구로 고정한다.
 *
 * 처음엔 `title`에도 이름을 넣었는데, GA4가 `document.title`을
 * `page_title`로 자동 수집한다는 걸 놓쳤다 — 경로는 `/t/{token}`처럼
 * 토큰만 잘라서 보내도록 이미 만들어뒀는데(`lib/safe-path.ts`), 제목이
 * 그 옆문으로 대상 이름을 그대로 흘려보내고 있었다. 일반인이 대상인
 * 챌린지가 생기면 그 사람 이름이 GA 리포트에 고스란히 쌓이는 셈이라
 * 토큰을 자른 의미가 없어진다.
 *
 * `title`과 `openGraph.title`을 분리하면 카카오톡 등 메신저의 언퍼를은
 * `openGraph.title`을 읽으므로 공유 미리보기의 효과는 그대로고, 탭
 * 제목과 GA만 이름 없는 문구를 본다.
 *
 * 대상의 Instagram 해시나 만든 사람의 신원은 여기에도 절대 넣지 않는다.
 * 없는 토큰이면 기본 문구로 떨어진다 — 404 여부를 미리보기로 흘리지
 * 않기 위해서다(존재하지 않는 챌린지도 평범한 미리보기가 뜬다).
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string }>;
}): Promise<Metadata> {
  let shareTitle = GENERIC_TITLE;
  if (isBackendConfigured()) {
    try {
      const { token } = await params;
      const info = await getChallengePublicInfo(token);
      if (info) shareTitle = `우리 진짜 ${info.displayName}까지 닿을 수 있을까? · 가이 알아?`;
    } catch {
      // 조회 실패 시 기본 문구 그대로 — 미리보기 때문에 페이지가 죽지 않게 한다.
    }
  }

  return {
    title: GENERIC_TITLE,
    description: DESCRIPTION,
    openGraph: { title: shareTitle, description: DESCRIPTION, images: [SHARE_IMAGE], locale: "ko_KR", type: "website" },
    twitter: { card: "summary_large_image", title: shareTitle, description: DESCRIPTION, images: [SHARE_IMAGE.url] },
  };
}

export default function TargetChallengePage() {
  return <TargetChallengeScreen />;
}
