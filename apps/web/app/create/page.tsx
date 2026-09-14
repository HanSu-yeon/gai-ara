import { redirect } from "next/navigation";
import CreateChallengeScreen from "@/components/CreateChallengeScreen";
import { isBackendConfigured } from "@/lib/env";
import { getDisplayName } from "@/lib/participants";
import { getSessionParticipantId } from "@/lib/session";
import { loginPathFor } from "@/lib/return-to";

/**
 * 2026-09-15 협업형 챌린지 결정 — 로그인 + 표시 이름 설정을 먼저 마쳐야
 * 한다(`/result`, `/upload`와 같은 이유). 챌린지 생성자가 자기 기존
 * trusted network를 즉시 시작점으로 쓸 수 있어야 하므로(`createChallenge`가
 * 생성자를 자동으로 첫 참여자로 등록), 로그인 없이 만들 수 없다.
 */
export default async function CreatePage() {
  if (isBackendConfigured()) {
    const participantId = await getSessionParticipantId();
    const displayName = participantId ? await getDisplayName(participantId) : null;
    if (!participantId || !displayName) redirect(loginPathFor("/create"));
  }

  return <CreateChallengeScreen />;
}
