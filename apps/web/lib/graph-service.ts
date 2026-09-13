import { bfsDistances, buildEgoTree, buildGraph, distanceCountsFrom, shortestDistance } from "@gai-ara/graph";
import type { EgoNetworkNode, MeResult, PairResult } from "@gai-ara/shared";
import { getAllEdges, getDisplayName, getRecoveryToken } from "./participants";

const EGO_NETWORK_MAX_DEPTH = 3;

/**
 * 화면 06 미니 그래프용 — 나를 root로 한 2~3홉 트리를 만들고, leaf(더
 * 뻗어나가지 않는 끝) 노드에만 표시 이름을 붙인다. 중간 연결자는 이
 * 트리에서 자식을 가진 노드이므로 always `displayName: null`이다
 * (2026-09-14 결정 — "중간은 익명, 끝만 실명"). `buildEgoTree` 자체가
 * `bfsDistances`와 달리 부모-자식 구조를 반환하는 예외적인 함수라는 점은
 * 그 함수의 문서 주석 참고.
 */
async function computeEgoNetwork(graph: ReturnType<typeof buildGraph>, participantId: string): Promise<EgoNetworkNode[]> {
  const tree = buildEgoTree(graph, participantId, EGO_NETWORK_MAX_DEPTH);
  return Promise.all(
    tree.map(async (node) => ({
      id: node.id,
      parentId: node.parentId,
      depth: node.depth as 1 | 2 | 3,
      displayName: node.isLeaf ? await getDisplayName(node.id) : null,
    })),
  );
}

/**
 * MVP 규모(참여자 수천~수만)에서는 매 요청마다 전체 edge를 읽어
 * 메모리 그래프를 다시 만들어도 충분히 빠르다. 요청 수/그래프 크기가
 * 커지면 캐싱(예: 짧은 TTL 인메모리 캐시)이나 배치 재계산을 도입한다.
 */
export async function computeMeResult(participantId: string): Promise<MeResult> {
  const edges = await getAllEdges();
  const graph = buildGraph(edges);
  const counts = distanceCountsFrom(graph, participantId);
  const representativeDistances = [...bfsDistances(graph, participantId)]
    .filter(([nodeId, distance]) => nodeId !== participantId && distance >= 1 && distance <= 3)
    .sort(([, left], [, right]) => left - right)
    .slice(0, 6)
    .map(([, distance]) => distance);
  const network = await computeEgoNetwork(graph, participantId);
  const recoveryToken = await getRecoveryToken(participantId);

  return { distanceCounts: counts, representativeDistances, network, recoveryToken: recoveryToken ?? "" };
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
