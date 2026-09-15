import type { AdjacencyList } from "@gai-ara/graph";
import { bfsDistances, buildGraph, buildLocalSubgraph, shortestPathNodes, distanceCountsFrom } from "@gai-ara/graph";
import type { ChallengePublicResult, ChallengeProgress, MeNetwork, MeNetworkNode, MeResult, ReferralPathNode } from "@gai-ara/shared";
import {
  getAllEdges,
  getConsentedDisplayNames,
  getDisplayName,
  getParticipantIdByInstagramHash,
  getParticipantIdsFollowingInstagramHash,
  getRecoveryToken,
} from "./participants";
import { getDiscoveredReferralOwners, getRevealedReferralVisitors } from "./referral-links";
import { getChallengeParticipantIds } from "./challenges";
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

interface ChallengeReachability {
  status: "searching" | "found";
  distance: number | null;
  /**
   * target 바로 직전(1홉)에 있으면서, start-set 중 최소거리를 달성하는
   * shortest path 중 적어도 하나에 실제로 쓰인 participant 전부(중복
   * 없음). 한 명을 임의로 고르지 않는다 — 동일한 minimum distance를
   * 만드는 서로 다른 마지막 연결자가 여럿이면 전부 담는다. **이 배열은
   * 순수 내부용이다** — participantId를 그대로 담고 있으므로 API 응답으로
   * 절대 내보내지 않는다(`computeChallengePublicResult`가 동의 필터링을
   * 거쳐 이름/개수만 뽑아낸다).
   */
  lastConnectorParticipantIds: string[];
}

const NO_REACHABILITY: ChallengeReachability = { status: "searching", distance: null, lastConnectorParticipantIds: [] };

/**
 * target 쪽에서 이미 계산해둔 `distances`(BFS from target)를 이용해
 * "target에 인접(distFromTarget===1)하면서, start-set 중 minDistance를
 * 달성하는 어떤 shortest path에든 실제로 포함되는" participant 전부를
 * 구한다. 무방향 그래프의 BFS-DAG 성질을 이용한다: minDistance 레벨에
 * 있는 frontier(그 거리를 달성한 start-set 멤버들)에서 시작해서, 레벨을
 * 하나씩 낮추며 "한 레벨 낮은 이웃"으로 역전파한다 — 그 레벨 낮은
 * 이웃이라면 반드시 frontier까지 이어지는 shortest path 위에 있다는
 * 뜻이기 때문이다. 이미 계산해둔 `distances`/`graph`만 재사용하고
 * `packages/graph`에 새 함수를 추가하지 않는다 — O(V+E) 역전파 한 번
 * 추가될 뿐, 기존 BFS와 같은 자릿수다.
 */
function findLastConnectors(
  graph: AdjacencyList,
  distances: ReadonlyMap<string, number>,
  minDistance: number,
  frontierIds: readonly string[],
): string[] {
  if (minDistance <= 0) return [];

  const onShortestPath = new Set<string>(frontierIds);
  if (minDistance >= 2) {
    const nodesByLevel = new Map<number, string[]>();
    for (const [nodeId, distance] of distances) {
      if (distance < 1 || distance > minDistance) continue;
      const bucket = nodesByLevel.get(distance);
      if (bucket) bucket.push(nodeId);
      else nodesByLevel.set(distance, [nodeId]);
    }

    for (let level = minDistance; level >= 2; level -= 1) {
      for (const nodeId of nodesByLevel.get(level) ?? []) {
        if (!onShortestPath.has(nodeId)) continue;
        for (const neighbor of graph.get(nodeId) ?? []) {
          if (distances.get(neighbor) === level - 1) onShortestPath.add(neighbor);
        }
      }
    }
  }

  return [...onShortestPath].filter((id) => distances.get(id) === 1);
}

/**
 * 2026-09-15 협업형 챌린지 결정 — "이 챌린지에 명시적으로 참여한
 * participant들(start-set)에서 출발해, 가이 알아?에 이미 존재하는 전역
 * trusted graph(`getAllEdges()` — confirmed acquaintance + Instagram
 * mutual만, 다른 edge 규칙 추가 없음) 전체를 거쳐 target까지 닿는 최단
 * 경로를 발견할 수 있는가"를 계산한다. 중간 노드가 이 챌린지에 참여했을
 * 필요는 없다 — 이미 검증된 관계를 인위적으로 막지 않는다.
 *
 * target 쪽에서 BFS를 한 번(또는 external leaf 후보 수만큼) 돌리고
 * start-set 참여자들의 거리를 조회해서 최솟값을 취한다 — 무방향 그래프라
 * start-set 각각에서 BFS를 도는 것과 결과가 같지만, target/leaf 후보 수가
 * 보통 start-set보다 훨씬 적으므로 이 방향이 항상 더 싸다. `packages/graph`에
 * multi-source BFS를 새로 추가하지 않고 기존 `bfsDistances`(single-source)를
 * 그대로 재사용한다.
 *
 * 결과를 어디에도 캐시하지 않는다 — 매 호출마다 `getAllEdges()`로 최신
 * 그래프를 다시 읽으므로, 새 participant가 참여하거나 새 trusted edge가
 * 생기면 바로 다음 호출부터 자동으로 반영된다(더 짧은 경로가 나오면 자동
 * 갱신, 별도 무효화 로직 불필요).
 *
 * 2026-09-15 "마지막 연결자" 결정 — 같은 BFS 결과에서 마지막 연결자
 * (`lastConnectorParticipantIds`)도 함께 뽑아낸다(`findLastConnectors`).
 * `computeChallengeProgress`/`computeChallengePublicResult` 둘 다 이
 * 내부 함수 하나를 공유해서, 그래프를 두 번 읽거나 BFS를 중복으로
 * 돌리지 않는다.
 */
async function computeChallengeReachability(
  challenge: { id: string; targetInstagramUsernameHash: string },
  prebuiltGraph?: AdjacencyList,
  startSetOverride?: readonly string[],
): Promise<ChallengeReachability> {
  const startSet = startSetOverride ?? (await getChallengeParticipantIds(challenge.id));
  if (startSet.length === 0) return NO_REACHABILITY;

  const graph = prebuiltGraph ?? buildGraph(await getAllEdges());

  // `excludeId`는 target 본인이 자기 챌린지의 start-set에도 들어 있을 때를
  // 위한 방어다(2026-09-15 추가) — target이 실제로 참여자가 됐고(자기
  // Instagram을 연동해서 그래프 노드가 됨), 궁금해서 "나도 연결 보태기"를
  // 눌러 자기 자신을 이 챌린지의 start-set에 포함시키는 경우다. `bfsDistances`는
  // 정의상 시작 노드 자신의 거리를 0으로 매기므로, target을 그대로 두면
  // "target → target 자신"의 0이 최단거리로 잡혀 아무도 실제 경로를 찾지
  // 않았는데도 "바로 아는 사이! 찾았다"가 뜬다. target 자신은 최단거리
  // 후보에서 빼고, 그 사람을 거쳐 가는 **다른** 참여자의 실제 경로만 인정한다.
  const minDistanceFrom = (distances: ReadonlyMap<string, number>, excludeId?: string): number | null => {
    let best: number | null = null;
    for (const startId of startSet) {
      if (startId === excludeId) continue;
      const distance = distances.get(startId);
      if (distance === undefined) continue;
      if (best === null || distance < best) best = distance;
    }
    return best;
  };

  const targetParticipantId = await getParticipantIdByInstagramHash(challenge.targetInstagramUsernameHash);
  if (targetParticipantId) {
    const distances = bfsDistances(graph, targetParticipantId);
    const minDistance = minDistanceFrom(distances, targetParticipantId);
    if (minDistance === null) return NO_REACHABILITY;

    const frontier = startSet.filter((id) => id !== targetParticipantId && distances.get(id) === minDistance);
    const lastConnectorParticipantIds = findLastConnectors(graph, distances, minDistance, frontier);
    return { status: "found", distance: minDistance, lastConnectorParticipantIds };
  }

  // target이 아직 participant가 아니다 — 그 target을 자기 Instagram 맞팔
  // 목록에 올려둔(실제로 서로 팔로우하는) 실제 participant 후보들을 거쳐
  // +1홉으로 계산한다. 이 leaf candidate 자체는 그래프 노드로 추가되지
  // 않는다 — `packages/graph`는 이 target의 존재를 전혀 모른다. 마지막
  // 연결자 = minimum distance를 달성하는 leaf candidate 전부(하나만
  // 고르지 않는다) — target이 그래프 노드가 아니므로 leaf candidate
  // 자신이 곧 "target 바로 직전 사람"이다.
  const leafCandidateIds = await getParticipantIdsFollowingInstagramHash(challenge.targetInstagramUsernameHash);
  if (leafCandidateIds.length === 0) return NO_REACHABILITY;

  const leafDistances: Array<{ leafId: string; distance: number }> = [];
  for (const leafId of leafCandidateIds) {
    const distances = bfsDistances(graph, leafId);
    const best = minDistanceFrom(distances);
    if (best !== null) leafDistances.push({ leafId, distance: best + 1 });
  }
  if (leafDistances.length === 0) return NO_REACHABILITY;

  const minDistance = Math.min(...leafDistances.map((entry) => entry.distance));
  const lastConnectorParticipantIds = leafDistances
    .filter((entry) => entry.distance === minDistance)
    .map((entry) => entry.leafId);
  return { status: "found", distance: minDistance, lastConnectorParticipantIds };
}

/** `POST /api/challenges/{token}/join` 등 진행 상태(status/distance)만 필요한 호출부용. */
export async function computeChallengeProgress(challenge: {
  id: string;
  targetInstagramUsernameHash: string;
}): Promise<ChallengeProgress> {
  const { status, distance } = await computeChallengeReachability(challenge);
  return { status, distance };
}

/**
 * 2026-09-15 "홈 공개 챌린지 목록" 결정 — 홈에 보여줄 공개 챌린지 3~5개의
 * 진행 상황을 한 번에 계산한다. 챌린지마다 `computeChallengeProgress`를
 * 부르면 전역 edge 조회 + `buildGraph`가 목록 길이만큼 반복되므로, 여기서
 * **그래프를 딱 한 번만 만들어** 재사용한다. 챌린지별로 남는 비용은 그
 * 챌린지의 start-set 조회 한 번과 target 기준 BFS 한 번뿐이다(원래 지시
 * §15 — participant 수만큼 BFS를 도는 구조를 만들지 않는다. 시작점이
 * 몇 명이든 BFS는 target 쪽에서 한 번만 돈다).
 *
 * MVP 규모(공개 챌린지 5개)에서는 요청 시점 계산으로 충분하다 — progress
 * 캐시나 백그라운드 잡을 추가하지 않는다. 캐시가 없으므로 누군가 연결을
 * 보태면 다음 홈 방문부터 바로 반영된다.
 */
export async function computeChallengeProgressBatch(
  challenges: ReadonlyArray<{ id: string; targetInstagramUsernameHash: string }>,
): Promise<ChallengeProgress[]> {
  if (challenges.length === 0) return [];

  const graph = buildGraph(await getAllEdges());
  const progresses: ChallengeProgress[] = [];
  for (const challenge of challenges) {
    const { status, distance } = await computeChallengeReachability(challenge, graph);
    progresses.push({ status, distance });
  }
  return progresses;
}

/**
 * 2026-09-15 추가 결정 — 챌린지 전체의 진행 상황과 **별개로**, 지금 이
 * 화면을 보고 있는 본인이 target까지 몇 다리인지 계산한다.
 *
 * 챌린지 진행 상황("우리가 길을 찾았는가", start-set 기준)과 뷰어 개인의
 * 거리("나는 몇 다리인가")는 서로 다른 질문이고 둘 다 의미가 있다 — 챌린지가
 * 아직 `searching`인데 뷰어에게는 길이 있을 수 있고(그 뷰어가 "나도 연결
 * 보태기"를 누르면 그 순간 챌린지가 풀린다), 반대로 챌린지는 이미 `found`인데
 * 뷰어 본인은 닿지 않을 수도 있다. 이 문서의 초판이 폐기했던 `POST
 * /api/challenges/{token}/check`(뷰어 기준 connected/not_connected)와 달리,
 * 이 값은 챌린지 전체 상태를 대체하지 않고 **함께** 보여주는 보조 정보다.
 *
 * 계산은 start-set만 "나 한 명"으로 바꾼 것 외에는 챌린지 진행 상황과
 * 완전히 동일하다 — 같은 전역 trusted graph, 같은 external leaf 처리,
 * 같은 거리 규칙. 반환값은 거리 숫자 하나뿐이고 중간 경로의 identity는
 * 어디에도 담기지 않는다(`AGENTS.md` §1 원칙 4).
 */
export async function computeViewerChallengeDistance(
  challenge: { id: string; targetInstagramUsernameHash: string },
  viewerParticipantId: string,
): Promise<number | null> {
  const { status, distance } = await computeChallengeReachability(challenge, undefined, [viewerParticipantId]);
  return status === "found" ? distance : null;
}

/** 공개 결과에 표시할 수 있는 마지막 연결자 닉네임 상한(390px 기준, 2026-09-15 결정). */
const MAX_VISIBLE_LAST_CONNECTORS = 3;

/**
 * `GET /api/challenges/{token}`(공개 조회) 전용 — `computeChallengeProgress`와
 * 같은 계산을 공유하되, "마지막 연결자" 정보까지 동의 필터링을 거쳐
 * 안전하게 노출 가능한 형태로 가공한다.
 *
 * `lastConnectorCount`는 그래프 계산상 실제 distinct 마지막 연결자
 * 수이고, 닉네임 공개 동의 여부와 무관하다(동의 안 한 사람도 숫자에는
 * 포함된다) — 결과 자체가 동의 여부에 따라 달라지면 안 된다는 원칙.
 * `visibleLastConnectorNames`는 그중 동의한 사람의 displayName만,
 * 최대 `MAX_VISIBLE_LAST_CONNECTORS`명까지만 담는다 — 2026-09-15
 * 추가 결정으로 `ChallengePathStrip`(`apps/web/components/ChallengePathStrip.tsx`)이
 * 이 이름들을 "마지막 연결자 fan-out" 노드에 직접 붙여서 그린다.
 * `consentedLastConnectorCount`는 (표시 여부와 무관하게) 동의한 사람
 * 전체 수다 — 지금은 UI가 쓰지 않지만 API 응답에는 남겨둔다.
 *
 * participantId, 동의하지 않은 displayName, 전체 shortest path 등은
 * 이 함수의 반환값에도, 그 어떤 중간 변수에도 남지 않는다 —
 * `lastConnectorParticipantIds`는 `computeChallengeReachability`
 * 내부에서만 살아 있고, 여기서 이름 조회에 한 번 쓰인 뒤 버려진다.
 */
export async function computeChallengePublicResult(challenge: {
  id: string;
  targetInstagramUsernameHash: string;
}): Promise<ChallengePublicResult> {
  const { status, distance, lastConnectorParticipantIds } = await computeChallengeReachability(challenge);

  if (status === "searching" || lastConnectorParticipantIds.length === 0) {
    return { status, distance, lastConnectorCount: 0, consentedLastConnectorCount: 0, visibleLastConnectorNames: [] };
  }

  const consentedNames = await getConsentedDisplayNames(lastConnectorParticipantIds);
  return {
    status,
    distance,
    lastConnectorCount: lastConnectorParticipantIds.length,
    consentedLastConnectorCount: consentedNames.length,
    visibleLastConnectorNames: consentedNames.slice(0, MAX_VISIBLE_LAST_CONNECTORS),
  };
}
