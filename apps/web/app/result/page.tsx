import { redirect } from "next/navigation";
import { ResultScreen } from "@/components/ResultScreen";
import { isBackendConfigured } from "@/lib/env";
import { getDisplayName } from "@/lib/participants";
import { getSessionParticipantId } from "@/lib/session";
import { loginPathFor } from "@/lib/return-to";

/**
 * 화면 06(로그인 사용자 메인). 세션이 없거나 표시 이름을 아직 설정하지
 * 않았으면 클라이언트에서 401 에러 화면을 보여주는 대신, 서버에서 먼저
 * 확인해 `/login?returnTo=/result`로 바로 보낸다 — 루트(`/`)와 같은 이유로
 * 서버 컴포넌트에서 처리해야 에러 화면이 잠깐이라도 보이지 않는다.
 */
export default async function ResultPage() {
  if (isBackendConfigured()) {
    const participantId = await getSessionParticipantId();
    const displayName = participantId ? await getDisplayName(participantId) : null;
    if (!participantId || !displayName) redirect(loginPathFor("/result"));
  }
  return <ResultScreen />;
}
