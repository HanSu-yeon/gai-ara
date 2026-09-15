import type { Metadata } from "next";
import TargetChallengeScreen from "@/components/TargetChallengeScreen";
import { getChallengePublicInfo } from "@/lib/challenges";
import { isBackendConfigured } from "@/lib/env";

const SHARE_IMAGE = { url: "/assets/gamgyul-wave.png", width: 1234, height: 1274, alt: "인사하는 감귤 캐릭터" };

const FALLBACK_TITLE = "우리 진짜 닿을 수 있을까? · 가이 알아?";
const DESCRIPTION = "여러 사람이 각자 아는 사람을 보태서, 궁금한 사람까지 이어지는 길을 함께 찾아가요.";

/**
 * 2026-09-15 — 공유 미리보기에 대상 이름을 넣는다. 전에는 모든 챌린지가
 * 똑같이 "우리 진짜 닿을 수 있을까?"로 떠서, 카톡에 링크를 붙여도 누구
 * 얘기인지 알 수 없었다. 링크를 받은 사람이 열면 어차피 화면 첫 줄에서
 * 보게 되는 이름이라 새로 드러나는 정보는 아니다 — 다만 언퍼를(unfurl)
 * 과정에서 메신저 서버가 이 이름을 읽게 되므로, 그 점을 알고 넣는다.
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
  let title = FALLBACK_TITLE;
  if (isBackendConfigured()) {
    try {
      const { token } = await params;
      const info = await getChallengePublicInfo(token);
      if (info) title = `우리 진짜 ${info.displayName}까지 닿을 수 있을까? · 가이 알아?`;
    } catch {
      // 조회 실패 시 기본 문구 그대로 — 미리보기 때문에 페이지가 죽지 않게 한다.
    }
  }

  return {
    title,
    description: DESCRIPTION,
    openGraph: { title, description: DESCRIPTION, images: [SHARE_IMAGE], locale: "ko_KR", type: "website" },
    twitter: { card: "summary_large_image", title, description: DESCRIPTION, images: [SHARE_IMAGE.url] },
  };
}

export default function TargetChallengePage() {
  return <TargetChallengeScreen />;
}
