import { NextResponse } from "next/server";
import { getChallengeByToken, joinChallenge } from "@/lib/challenges";
import { computeChallengeProgress } from "@/lib/graph-service";
import { getSessionParticipantId } from "@/lib/session";
import { isBackendConfigured } from "@/lib/env";

/**
 * "나도 연결 보태기" 버튼이 호출한다(2026-09-15 협업형 챌린지 결정) —
 * `/t/{token}` 페이지 뷰만으로는 절대 호출되지 않는다. 이 참여자가 이미
 * 갖고 있는 confirmed acquaintance/Instagram mutual 관계 전체를 이
 * 챌린지의 시작점(start-set)으로 써도 된다는 멤버십만 남기고, 새 edge를
 * 만들지 않는다. 이미 참여한 사람이 다시 눌러도 멱등하게 성공 처리한다.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  if (!isBackendConfigured()) {
    return NextResponse.json({ error: "지금은 서비스를 준비 중이에요. 잠시 후 다시 시도해주세요." }, { status: 503 });
  }

  const participantId = await getSessionParticipantId();
  if (!participantId) {
    return NextResponse.json({ error: "먼저 로그인해주세요." }, { status: 401 });
  }

  const { token } = await params;
  const challenge = await getChallengeByToken(token);
  if (!challenge) {
    return NextResponse.json({ error: "존재하지 않는 챌린지예요." }, { status: 404 });
  }

  await joinChallenge(challenge.id, participantId);
  const progress = await computeChallengeProgress(challenge);

  return NextResponse.json(progress);
}
