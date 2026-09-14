import { NextResponse } from "next/server";
import { getChallengeByToken } from "@/lib/challenges";
import { computeChallengePublicResult } from "@/lib/graph-service";
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

  return NextResponse.json({ displayName: challenge.displayName, ...result });
}
