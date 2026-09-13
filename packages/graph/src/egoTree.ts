import type { AdjacencyList, NodeId } from "./types";

export interface EgoTreeNode {
  id: NodeId;
  parentId: NodeId | null;
  depth: number;
  isLeaf: boolean;
}

/**
 * `bfsDistances`/`shortestDistance`는 의도적으로 경로를 반환할 수 없다
 * (제3자 사이의 중간 연결자를 절대 노출하지 않기 위해). 이 함수는 그
 * 원칙의 예외다 — 두 명의 "제3자" 사이가 아니라, 본인 자신의 로컬
 * 네트워크를 "자기 자신에게" 보여주는 용도로만 쓴다(`/result` 화면).
 * 그래서 부모-자식 구조(트리)를 그대로 반환한다.
 *
 * root로부터 BFS로 트리를 만들고(각 노드는 처음 발견된 간선을 부모로
 * 삼는다), `maxDepth`에서 확장을 멈춘다. `isLeaf`는 "이 트리에서 더 이상
 * 자식으로 뻗어나가지 않는 노드"를 뜻한다 — depth 제한 때문에 멈췄든,
 * 실제로 더 이웃이 없든 이 함수 안에서는 구분하지 않는다(호출부가 leaf만
 * 실명을 보여주는 데 씀). root 자신은 결과에 포함하지 않는다.
 */
export function buildEgoTree(
  graph: AdjacencyList,
  root: NodeId,
  maxDepth: number,
): EgoTreeNode[] {
  const visited = new Set<NodeId>([root]);
  const nodes = new Map<NodeId, EgoTreeNode>();
  const queue: NodeId[] = [root];
  const depthOf = new Map<NodeId, number>([[root, 0]]);

  let head = 0;
  while (head < queue.length) {
    const current = queue[head]!;
    head += 1;
    const currentDepth = depthOf.get(current)!;
    if (currentDepth >= maxDepth) continue;

    const neighbors = graph.get(current);
    if (!neighbors) continue;

    for (const neighbor of neighbors) {
      if (visited.has(neighbor)) continue;
      visited.add(neighbor);
      depthOf.set(neighbor, currentDepth + 1);
      nodes.set(neighbor, {
        id: neighbor,
        parentId: current === root ? null : current,
        depth: currentDepth + 1,
        isLeaf: true,
      });
      queue.push(neighbor);
    }
  }

  for (const node of nodes.values()) {
    if (node.parentId !== null) {
      const parent = nodes.get(node.parentId);
      if (parent) parent.isLeaf = false;
    }
  }

  return [...nodes.values()];
}
