import { redirect } from "next/navigation";
import { InstagramImportFlow } from "@/components/InstagramImportFlow";
import { isBackendConfigured } from "@/lib/env";
import { getDisplayName } from "@/lib/participants";
import { getSessionParticipantId } from "@/lib/session";
import { loginPathFor, normalizeReturnTo } from "@/lib/return-to";

/**
 * 2026-09-14 Instagram import 재도입. 카카오 로그인 + 표시 이름 설정을
 * 먼저 마쳐야 한다 — `/result`와 같은 이유로 서버 컴포넌트에서 먼저
 * 확인해 로그인으로 보낸다(§`AGENTS.md` §0 각주 — 카카오 로그인이 신원
 * 판별의 유일한 기준).
 *
 * 2026-09-15 협업형 챌린지 결정 — `/t/{token}`의 "인스타에서 아는 사람
 * 가져오기"에서 들어온 경우 `returnTo`를 받는다. 미로그인이면 `/upload`를
 * 다시 거치지 않고 `returnTo`로 곧장 보낸다(`ConnectScreen`의 401 처리와
 * 같은 패턴) — 로그인 뒤 챌린지 화면에서 다시 "인스타에서 아는 사람
 * 가져오기"를 누르면 이번에는 이미 인증된 상태라 그대로 진행된다. 이미
 * 인증된 상태로 들어왔다면(가장 흔한 경로) `returnTo`를
 * `InstagramImportFlow`에 그대로 넘겨 업로드 완료 후 원래 챌린지로
 * 복귀시킨다.
 */
export default async function UploadPage({
  searchParams,
}: {
  searchParams: Promise<{ step?: string | string[]; returnTo?: string | string[] }>;
}) {
  const params = await searchParams;
  const returnToValue = typeof params.returnTo === "string" ? params.returnTo : null;
  const returnTo = normalizeReturnTo(returnToValue);

  if (isBackendConfigured()) {
    const participantId = await getSessionParticipantId();
    const displayName = participantId ? await getDisplayName(participantId) : null;
    if (!participantId || !displayName) redirect(loginPathFor(returnTo ?? "/upload"));
  }

  const step = params.step;
  return <InstagramImportFlow startAtForm={step === "form"} returnTo={returnTo} />;
}
