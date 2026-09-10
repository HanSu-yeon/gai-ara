import type { AdjacencyList, NodeId } from "./types";

/**
 * BFS로 시작 노드로부터 도달 가능한 모든 노드까지의 최단 거리를 계산한다.
 * 반환값은 오직 "거리"뿐이며, 경로 자체(중간 노드 목록)는 절대 포함하지
 * 않는다 — 중간 연결자를 공개하지 않는다는 제품 원칙을 코드 레벨에서
 * 강제하기 위해 이 함수의 시그니처 자체가 경로를 반환할 수 없게 만든다.
 */
export function bfsDistances(
  graph: AdjacencyList,
  start: NodeId,
): ReadonlyMap<NodeId, number> {
  const distances = new Map<NodeId, number>();
  if (!graph.has(start)) return distances;

  distances.set(start, 0);
  const queue: NodeId[] = [start];

  let head = 0;
  while (head < queue.length) {
    const current = queue[head]!;
    head += 1;
    const currentDistance = distances.get(current)!;
    const neighbors = graph.get(current);
    if (!neighbors) continue;

    for (const neighbor of neighbors) {
      if (distances.has(neighbor)) continue;
      distances.set(neighbor, currentDistance + 1);
      queue.push(neighbor);
    }
  }

  return distances;
}

/** 두 참여자 사이의 최단 거리만 계산한다 (경로 없음). 도달 불가면 null. */
export function shortestDistance(
  graph: AdjacencyList,
  from: NodeId,
  to: NodeId,
): number | null {
  if (from === to) return 0;
  const distances = bfsDistances(graph, from);
  return distances.get(to) ?? null;
}
