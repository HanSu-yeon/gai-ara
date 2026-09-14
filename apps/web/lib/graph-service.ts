import type { AdjacencyList } from "@gai-ara/graph";
import { bfsDistances, buildGraph, buildLocalSubgraph, shortestPathNodes, distanceCountsFrom } from "@gai-ara/graph";
import type { MeNetwork, MeNetworkNode, MeResult, ReferralPathNode } from "@gai-ara/shared";
import { getAllEdges, getDisplayName, getRecoveryToken } from "./participants";
import { getDiscoveredReferralOwners, getRevealedReferralVisitors } from "./referral-links";
import { hashParticipantId } from "./opaque-id";

/**
 * "몇 다리 건너 아는 사이일까?"를 실제로 체감하게 하는 화면 06의 탐색
 * 범위 — Six Degrees of Separation 개념 그대로 최대 6홉까지 본다(2026-09-14
 * 최종 결정). 화면에는 "6단계" 같은 숫자를 절대 보여주지 않는다 — 이건
 * 순전히 내부 탐색 한계일 뿐이다.
 */
const RESULT_MAX_DEPTH = 6;

/**
 * 2촌 이상(depth 2~6) 노드 렌더링 상한. 진짜 6단계 분리 이론대로면
 * 커뮤니티가 조금만 커져도 6홉 안에 거의 모든 참여자가 들어올 수 있어서,
 * 상한이 없으면 모바일에서 그릴 수 없는 수의 노드가 나온다. 상한을
 * 넘는 나머지는 가짜 노드로 채우지 않고 `hiddenBeyondCount` 집계 숫자로만
 * 알려준다 — direct(depth 1)는 이 상한과 무관하게 항상 전부 포함된다.
 *
 * 최종 제품 정책값이 아니라 실기기 성능 테스트 전까지의 초기값이다
 * (2026-09-14 결정) — 코드 배포 없이 조정할 수 있도록 환경 변수로
 * 덮어쓸 수 있게 해뒀다. 값이 없거나 잘못되면 기본값(40)을 쓴다.
 */
const DEFAULT_RESULT_MAX_BEYOND_NODES = 40;
function resultMaxBeyondNodes(): number {
  const raw = Number(process.env.RESULT_MAX_BEYOND_NODES);
  return Number.isInteger(raw) && raw > 0 ? raw : DEFAULT_RESULT_MAX_BEYOND_NODES;
}

/**
 * 2026-09-14 — `/result`가 "확인된 모든 6홉 그래프"에서 "내가 실제로
 * 발견한 연결"로 의미가 바뀌면서 `computeMeResult`는 더 이상 이 함수를
 * 호출하지 않는다. 삭제하지 않고 남겨둔다 — `/r`의 shortest-path 로직과는
 * 무관하고, 나중에 "내 주변 6홉 전체 보기" 같은 별도 화면/모드가 다시
 * 필요해지면 그대로 재사용할 수 있다.
 */
export async function computeMeNetwork(graph: ReturnType<typeof buildGraph>, participantId: string): Promise<MeNetwork> {
  const allDistances = bfsDistances(graph, participantId);
  // "6홉 이내에서 실제로 렌더링되지 않은 참여자 수" — 상한과 무관하게
  // 6홉 이내 전체 인원을 먼저 세고, 아래서 실제로 포함된 수를 빼서 구한다.
  const totalBeyond = [...allDistances.values()].filter((distance) => distance >= 2 && distance <= RESULT_MAX_DEPTH).length;

  const subgraph = buildLocalSubgraph(graph, participantId, RESULT_MAX_DEPTH, resultMaxBeyondNodes());
  const shownBeyond = subgraph.nodes.filter((node) => node.depth >= 2).length;

  // depth별로 최종 id를 결정한다 — direct(depth 1)는 실제 id 그대로,
  // 2촌 이상은 되돌릴 수 없는 불투명 id로 바꿔서 실제 participant UUID가
  // 클라이언트에 나가지 않게 한다(2026-09-14 결정). parentId도 그 부모의
  // depth 기준으로 같은 규칙을 적용해야 자식이 부모를 정확히 가리킨다 —
  // 부모는 항상 자식보다 1홉 가깝다.
  const finalId = (id: string, depth: number) => (depth <= 1 ? id : hashParticipantId(id));

  const nodes: MeNetworkNode[] = await Promise.all(
    subgraph.nodes.map(async (node) => ({
      id: finalId(node.id, node.depth),
      parentId: node.parentId === null ? null : finalId(node.parentId, node.depth - 1),
      depth: node.depth as 1 | 2 | 3 | 4 | 5 | 6,
      // depth 1(직접 아는 사람)만 표시 이름을 채운다 — 2촌 이상은 이 API
      // 응답 자체에 이름을 담지 않는다(클라이언트에서 숨기는 게 아니라
      // 서버 단계에서부터 제한, 2026-09-14 결정).
      displayName: node.depth === 1 ? await getDisplayName(node.id) : null,
    })),
  );

  // root 자신은 subgraph.nodes에 없으므로 depth 0으로 취급한다 —
  // finalId는 depth<=1이면 그대로 두므로 root의 id도 안전하게 raw로 남는다
  // (본인 세션이 이미 알고 있는 자기 자신의 id라 가릴 필요가 없다).
  const depthOf = new Map(subgraph.nodes.map((node) => [node.id, node.depth]));
  const edges: [string, string][] = subgraph.edges.map(([a, b]) => [
    finalId(a, depthOf.get(a) ?? 0),
    finalId(b, depthOf.get(b) ?? 0),
  ]);

  return {
    nodes,
    edges,
    hiddenBeyondCount: Math.max(0, totalBeyond - shownBeyond),
  };
}

/**
 * `/result` 2026-09-14 최종 결정 — "내 주변 6홉 전체"가 아니라 "내가
 * 실제로 발견한 연결 지도"만 보여준다. 포함되는 사람은 딱 두 whitelist뿐:
 *
 *   A. 나와 direct confirmed인 사람 (실제 관계)
 *   B-a. 내가 방문자로서 남의 `/r` 링크를 열어 발견한 owner
 *        (이미 화면 08에서 그 사람 이름을 봤으므로 새 신원 노출 아님 —
 *        동의 불필요)
 *   B-b. 남이 내 링크를 열어 나를 발견했고, 그 방문자가 명시적으로
 *        "내 이름 보여주기"를 선택한 경우만(opt-in, 기본 false)
 *
 * 단순 방문(path 없음, edge 0명, 그냥 열어만 봄)은 절대 포함하지 않는다.
 * 각 whitelist 대상까지의 경로는 저장해둔 옛 경로가 아니라 `/r`과 같은
 * `shortestPathNodes`로 매번 다시 계산한다 — 그래프가 바뀌면 자동으로
 * 최신 상태를 반영하고, 여러 경로가 겹치는 구간(같은 participant)은
 * 자연히 하나의 노드로 합쳐진다(먼저 방문한 경로가 그 노드의 위치를
 * 정하고, 이후 경로는 같은 id면 새로 만들지 않는다).
 */
async function computeDiscoveredNetwork(graph: AdjacencyList, participantId: string): Promise<MeNetwork> {
  const directIds = [...(graph.get(participantId) ?? [])];
  const [discoveredOwnerIds, revealedVisitorIds] = await Promise.all([
    getDiscoveredReferralOwners(participantId),
    getRevealedReferralVisitors(participantId),
  ]);
  const endpointIds = [...new Set([...discoveredOwnerIds, ...revealedVisitorIds])];

  const depthOf = new Map<string, number>([[participantId, 0]]);
  const parentOf = new Map<string, string | null>();

  for (const id of directIds) {
    if (depthOf.has(id)) continue;
    depthOf.set(id, 1);
    parentOf.set(id, null);
  }

  for (const endpointId of endpointIds) {
    const path = shortestPathNodes(graph, participantId, endpointId);
    if (!path || path.length < 2) continue; // 그래프가 그 사이 바뀌어 더 이상 도달 불가한 극단적 경우 방어
    for (let i = 1; i < path.length; i += 1) {
      const node = path[i]!;
      if (depthOf.has(node)) continue; // 이미 다른 경로/direct로 포함됨 — 같은 노드 중복 생성 안 함
      depthOf.set(node, i);
      parentOf.set(node, path[i - 1]!);
    }
  }

  const namedIds = new Set<string>([...directIds, ...endpointIds]);
  const includedIds = [...depthOf.keys()].filter((id) => id !== participantId);

  // depth<=1이거나(직접) 발견된 endpoint 본인이면 실명 그대로, 그 외
  // 중간자는 opaque id로 가린다 — `/result` 6홉 버전과 같은 규칙 재사용.
  // root(나) 자신도 당연히 raw로 둔다(본인이 이미 아는 자기 id).
  const finalId = (id: string) => (id === participantId || namedIds.has(id) ? id : hashParticipantId(id));

  const nodes: MeNetworkNode[] = await Promise.all(
    includedIds.map(async (id) => {
      const depth = Math.min(depthOf.get(id)!, 6);
      const parent = parentOf.get(id) ?? null;
      const isNamed = namedIds.has(id);
      return {
        id: finalId(id),
        parentId: parent === null ? null : finalId(parent),
        depth: depth as 1 | 2 | 3 | 4 | 5 | 6,
        displayName: isNamed ? await getDisplayName(id) : null,
      };
    }),
  );

  const includedSet = new Set([participantId, ...includedIds]);
  const edgesSeen = new Set<string>();
  const edges: [string, string][] = [];
  for (const id of includedSet) {
    const neighbors = graph.get(id);
    if (!neighbors) continue;
    for (const neighbor of neighbors) {
      if (neighbor === id || !includedSet.has(neighbor)) continue;
      const [a, b] = id < neighbor ? [id, neighbor] : [neighbor, id];
      const key = `${a}|${b}`;
      if (edgesSeen.has(key)) continue;
      edgesSeen.add(key);
      edges.push([finalId(a), finalId(b)]);
    }
  }

  // 탐색 상한 자체가 없어서(발견된 대상만 따라가므로) 렌더링에서 뺀
  // 사람이 없다 — 6홉 버전의 `hiddenBeyondCount`와 달리 항상 0이다.
  return { nodes, edges, hiddenBeyondCount: 0 };
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
  const network = await computeDiscoveredNetwork(graph, participantId);
  const recoveryToken = await getRecoveryToken(participantId);

  return { distanceCounts: counts, network, recoveryToken: recoveryToken ?? "" };
}

/**
 * `/r/{token}` 화면 09/10용 — owner와 viewer 사이의 실제 shortest path를
 * 계산하고, "viewer 본인과 direct confirmed인 사람"만 실명으로 채운다
 * (2026-09-14 결정: "내가 직접 아는 사람은 나에게 보이고, 내가 직접
 * 모르는 사람은 익명이다"). 양 끝(viewer 자신, owner)은 항상 실명이고,
 * 그 외 중간자는 viewer의 direct 목록에 없으면 이름도 id도 원본을 내려
 * 보내지 않는다(`/result`와 같은 `hashParticipantId`로 가린다). edge를
 * 새로 만들지 않는다 — 순수 조회다.
 */
export async function computeReferralResult(
  ownerParticipantId: string,
  viewerParticipantId: string,
): Promise<{ status: "connected" | "unreachable"; distance: number | null; path: ReferralPathNode[] | null }> {
  const edges = await getAllEdges();
  const graph = buildGraph(edges);
  const pathIds = shortestPathNodes(graph, viewerParticipantId, ownerParticipantId);

  if (!pathIds) {
    return { status: "unreachable", distance: null, path: null };
  }

  const viewerDirects = graph.get(viewerParticipantId) ?? new Set<string>();
  const path: ReferralPathNode[] = await Promise.all(
    pathIds.map(async (id, index) => {
      const isEndpoint = index === 0 || index === pathIds.length - 1;
      const revealIdentity = isEndpoint || viewerDirects.has(id);
      return {
        id: revealIdentity ? id : hashParticipantId(id),
        displayName: revealIdentity ? await getDisplayName(id) : null,
      };
    }),
  );

  return { status: "connected", distance: pathIds.length - 1, path };
}
