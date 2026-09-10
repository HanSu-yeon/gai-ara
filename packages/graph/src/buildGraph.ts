import type { AdjacencyList, Edge, NodeId } from "./types";

/**
 * mutual-follow edge 목록으로부터 무방향 인접 리스트를 만든다.
 * MVP 규모(참여자 수천~수만 명, edge 수십만)에서는 매 요청마다
 * DB에서 edge를 읽어 메모리에 그래프를 재구성해도 충분히 빠르다.
 * 규모가 커지면 캐싱/증분 업데이트를 도입한다.
 */
export function buildGraph(edges: readonly Edge[]): AdjacencyList {
  const adjacency = new Map<NodeId, Set<NodeId>>();

  const ensure = (id: NodeId): Set<NodeId> => {
    let set = adjacency.get(id);
    if (!set) {
      set = new Set();
      adjacency.set(id, set);
    }
    return set;
  };

  for (const { a, b } of edges) {
    if (a === b) continue; // self-loop는 관계가 아니므로 무시
    ensure(a).add(b);
    ensure(b).add(a);
  }

  return adjacency;
}
