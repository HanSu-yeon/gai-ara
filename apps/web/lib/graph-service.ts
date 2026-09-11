import { buildGraph, distanceCountsFrom, shortestDistance } from "@gai-ara/graph";
import type { MeResult, PairResult } from "@gai-ara/shared";
import { getAllEdges, getRecoveryToken } from "./participants";

/**
 * MVP 규모(참여자 수천~수만)에서는 매 요청마다 전체 edge를 읽어
 * 메모리 그래프를 다시 만들어도 충분히 빠르다. 요청 수/그래프 크기가
 * 커지면 캐싱(예: 짧은 TTL 인메모리 캐시)이나 배치 재계산을 도입한다.
 */
export async function computeMeResult(participantId: string): Promise<MeResult> {
  const edges = await getAllEdges();
  const graph = buildGraph(edges);
  const counts = distanceCountsFrom(graph, participantId);
  const recoveryToken = await getRecoveryToken(participantId);

  return { distanceCounts: counts, recoveryToken: recoveryToken ?? "" };
}

export async function computePairResult(
  inviterParticipantId: string,
  recipientParticipantId: string | null,
): Promise<PairResult> {
  if (!recipientParticipantId) {
    return { status: "pending", distance: null };
  }

  const edges = await getAllEdges();
  const graph = buildGraph(edges);
  const distance = shortestDistance(graph, inviterParticipantId, recipientParticipantId);

  return distance === null
    ? { status: "unreachable", distance: null }
    : { status: "connected", distance };
}
