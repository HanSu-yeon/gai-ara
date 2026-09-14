import type { AdjacencyList, NodeId } from "./types";

export interface LocalSubgraphNode {
  id: NodeId;
  /** 레이아웃(각도 배치)용 BFS 트리 부모. null이면 root의 직접 연결(depth 1). */
  parentId: NodeId | null;
  depth: number;
}

export interface LocalSubgraph {
  nodes: LocalSubgraphNode[];
  /** (id, id) 쌍 — 둘 다 이 서브그래프에 포함되고 실제로 간선이 있다.
   * 트리 간선(부모-자식)뿐 아니라 트리에 없는 실제 간선(삼각형, 재합류)도
   * 전부 포함한다 — `bfsDistances`와 달리 이 함수는 root 자신의 로컬
   * 네트워크를 그 자신에게 보여주는 용도라 경로/구조를 반환해도 된다. */
  edges: [NodeId, NodeId][];
}

/**
 * root로부터 `maxDepth`까지 BFS로 도달 가능한 로컬 서브그래프를 만든다.
 * depth 1(직접 연결)은 `maxBeyondNodes`와 무관하게 전부 포함한다 — depth
 * 2 이상만 그 상한의 적용을 받는다(가짜 노드를 추가하는 대신, 상한을
 * 넘는 나머지는 이 함수를 호출하는 쪽이 집계 숫자로 따로 알려준다).
 */
export function buildLocalSubgraph(
  graph: AdjacencyList,
  root: NodeId,
  maxDepth: number,
  maxBeyondNodes: number = Infinity,
): LocalSubgraph {
  const depthOf = new Map<NodeId, number>([[root, 0]]);
  const nodes: LocalSubgraphNode[] = [];
  const queue: NodeId[] = [root];
  let beyondCount = 0;

  let head = 0;
  while (head < queue.length) {
    const current = queue[head]!;
    head += 1;
    const currentDepth = depthOf.get(current)!;
    if (currentDepth >= maxDepth) continue;

    const neighbors = graph.get(current);
    if (!neighbors) continue;

    const isExpandingFromRoot = currentDepth === 0;
    for (const neighbor of neighbors) {
      if (depthOf.has(neighbor)) continue;
      if (!isExpandingFromRoot && beyondCount >= maxBeyondNodes) continue;

      const depth = currentDepth + 1;
      depthOf.set(neighbor, depth);
      if (!isExpandingFromRoot) beyondCount += 1;
      nodes.push({ id: neighbor, parentId: isExpandingFromRoot ? null : current, depth });
      queue.push(neighbor);
    }
  }

  const included = depthOf; // root 포함, key로 멤버십 확인
  const edges: [NodeId, NodeId][] = [];
  const seenEdge = new Set<string>();
  for (const id of included.keys()) {
    const neighbors = graph.get(id);
    if (!neighbors) continue;
    for (const neighbor of neighbors) {
      if (neighbor === id || !included.has(neighbor)) continue;
      const [a, b] = id < neighbor ? [id, neighbor] : [neighbor, id];
      const key = `${a}|${b}`;
      if (seenEdge.has(key)) continue;
      seenEdge.add(key);
      edges.push([a, b]);
    }
  }

  return { nodes, edges };
}
