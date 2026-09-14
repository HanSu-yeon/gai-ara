import { redirect } from "next/navigation";
import { ResultScreen } from "@/components/ResultScreen";
import { isBackendConfigured } from "@/lib/env";
import { getConnectionSummary, getDisplayName } from "@/lib/participants";
import { getSessionParticipantId } from "@/lib/session";
import { loginPathFor } from "@/lib/return-to";

/**
 * 화면 06(로그인 사용자 메인). 세션이 없거나 표시 이름을 아직 설정하지
 * 않았으면 클라이언트에서 401 에러 화면을 보여주는 대신, 서버에서 먼저
 * 확인해 `/login?returnTo=/result`로 바로 보낸다 — 루트(`/`)와 같은 이유로
 * 서버 컴포넌트에서 처리해야 에러 화면이 잠깐이라도 보이지 않는다.
 */
export default async function ResultPage() {
  if (!isBackendConfigured()) return <ResultScreen summary={null} />;

  const participantId = await getSessionParticipantId();
  const displayName = participantId ? await getDisplayName(participantId) : null;
  if (!participantId || !displayName) redirect(loginPathFor("/result"));

  // 2026-09-15 — "이미 가져왔는지"와 "실제로 몇 명과 이어졌는지"를 화면이
  // 구분해서 말할 수 있도록 요약을 함께 넘긴다. 두 숫자가 다를 수 있다는
  // 게 이 화면이 전달해야 할 핵심 정보다(`getConnectionSummary` 주석 참고).
  const summary = await getConnectionSummary(participantId);
  return <ResultScreen summary={summary} />;
}
