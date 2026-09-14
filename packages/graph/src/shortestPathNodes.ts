import type { AdjacencyList, NodeId } from "./types";

/**
 * `shortestDistance`와 달리 실제 경로(노드 순서)를 반환하는 예외적인
 * 함수다 — `bfsDistances`/`shortestDistance`의 문서 주석대로 "제3자 사이의
 * 중간 연결자를 노출하지 않는다"는 원칙은 그대로 지키되, 이 함수는 `/r`이
 * "두 endpoint 사이에 실제로 몇 명이 끼어 있는지, 그중 조회자 본인이 이미
 * 아는 사람은 누구인지"를 보여주는 데 필요해서 만든 별도 API다(2026-09-14
 * 결정). 이 함수 자체는 신원 정보를 전혀 다루지 않는다 — 어떤 노드를 실명
 * 공개할지 결정하고 이름을 채우는 건 호출부(apps/web)의 책임이다.
 *
 * 반환값은 `from`부터 `to`까지의 노드 id 배열(양 끝 포함)이고, 도달 불가면
 * null이다.
 */
export function shortestPathNodes(graph: AdjacencyList, from: NodeId, to: NodeId): NodeId[] | null {
  if (from === to) return [from];
  if (!graph.has(from)) return null;

  const parent = new Map<NodeId, NodeId>();
  const visited = new Set<NodeId>([from]);
  const queue: NodeId[] = [from];

  let head = 0;
  let found = false;
  while (head < queue.length && !found) {
    const current = queue[head]!;
    head += 1;
    const neighbors = graph.get(current);
    if (!neighbors) continue;

    for (const neighbor of neighbors) {
      if (visited.has(neighbor)) continue;
      visited.add(neighbor);
      parent.set(neighbor, current);
      if (neighbor === to) {
        found = true;
        break;
      }
      queue.push(neighbor);
    }
  }

  if (!visited.has(to)) return null;

  const path: NodeId[] = [to];
  let cursor = to;
  while (cursor !== from) {
    const prev = parent.get(cursor);
    if (!prev) return null;
    path.push(prev);
    cursor = prev;
  }

  return path.reverse();
}
