import type { Metadata } from "next";
import LivePairPage from "@/components/LivePairPage";
import { getInviteByToken } from "@/lib/invites";
import { isBackendConfigured } from "@/lib/env";

const SHARE_IMAGE = { url: "/assets/gamgyul-wave.png", width: 1234, height: 1274, alt: "인사하는 감귤 캐릭터" };

export async function generateMetadata(
  { params }: { params: Promise<{ token: string }> },
): Promise<Metadata> {
  const { token } = await params;
  const invite = isBackendConfigured() ? await getInviteByToken(token) : null;

  const title = invite?.inviterNickname ? `${invite.inviterNickname}님이 궁금해해요 — 가이 알아?` : "친구가 궁금해해요 — 가이 알아?";
  const description = "나랑 몇 다리 건너 아는 사이인지 확인해봐요.";

  return {
    title,
    description,
    openGraph: { title, description, images: [SHARE_IMAGE], locale: "ko_KR", type: "website" },
    twitter: { card: "summary_large_image", title, description, images: [SHARE_IMAGE.url] },
  };
}

export default function PairPage() { return <LivePairPage />; }
