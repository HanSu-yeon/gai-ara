import { NextResponse } from "next/server";
import { getChallengeByToken, hasJoinedChallenge } from "@/lib/challenges";
import { computeChallengePublicResult, computeViewerChallengeDistance } from "@/lib/graph-service";
import { getSessionParticipantId } from "@/lib/session";
import { getConnectionSummary } from "@/lib/participants";
import { isBackendConfigured } from "@/lib/env";

/**
 * `/t/{token}`이 로그인 전에도 먼저 여는 공개 조회 — 인증 불필요(공유
 * 링크를 로그인 전에도 열 수 있어야 한다, 원래 지시 §12 "챌린지 공유
 * 유입" 플로우). 2026-09-15 협업형 챌린지 결정으로 대상 이름과 함께
 * 챌린지 전체의 진행 상황(status/distance)도 한 번에 내려준다. 같은 날
 * 추가 결정으로 "마지막 연결자" 요약(개수 + 공개 동의한 사람의 닉네임
 * 최대 3명)도 포함한다 — `computeChallengePublicResult`가 동의하지
 * 않은 participant의 displayName/participantId는 이미 걸러낸 뒤 돌려주므로
 * 여기서는 그대로 응답에 실어 보내면 된다. 대상의 Instagram 해시, 만든
 * 사람의 신원, start-set/중간 노드 participant 목록은 절대 포함하지
 * 않는다.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  if (!isBackendConfigured()) {
    return NextResponse.json({ error: "지금은 서비스를 준비 중이에요. 잠시 후 다시 시도해주세요." }, { status: 503 });
  }

  const { token } = await params;
  const challenge = await getChallengeByToken(token);
  if (!challenge) {
    return NextResponse.json({ error: "존재하지 않는 챌린지예요." }, { status: 404 });
  }

  const result = await computeChallengePublicResult(challenge);

  // 2026-09-15 추가 — 로그인한 뷰어에게는 "나는 몇 다리인지"도 함께 준다.
  // 로그인하지 않았으면 계산 자체를 하지 않는다(항상 null) — 이 라우트는
  // 비로그인으로도 열려야 하는 공개 조회라 세션이 없는 게 정상이다.
  const viewerParticipantId = await getSessionParticipantId();
  const viewerDistance = viewerParticipantId
    ? await computeViewerChallengeDistance(challenge, viewerParticipantId)
    : null;
  const viewerJoined = viewerParticipantId
    ? await hasJoinedChallenge(challenge.id, viewerParticipantId)
    : false;

  // 이미 관계를 보태둔 사람은 업로드를 다시 시키지 않고 바로 참여시킨다.
  const summary = viewerParticipantId ? await getConnectionSummary(viewerParticipantId) : null;
  const viewerHasConnections = Boolean(
    summary && (summary.hasLinkedInstagram || summary.connectedPeople > 0),
  );

  return NextResponse.json({
    displayName: challenge.displayName,
    viewerDistance,
    viewerJoined,
    viewerHasConnections,
    ...result,
  });
}
