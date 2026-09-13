import type { EgoNetworkNode } from "@gai-ara/shared";

const CENTER = { x: 195, y: 150 };
const RADIUS_BY_DEPTH: Record<number, number> = { 1: 90, 2: 118, 3: 140 };

/**
 * depth 1(root에 바로 붙는 가지) 각도. 12시 방향(정중앙 위)부터 채우면
 * 안테나처럼 보인다(2026-09-14 피드백)는 이유로 1~2시 방향을 먼저 쓰고,
 * 6개 슬롯이 다 찰 때만 마지막으로 12시(-90°)를 쓴다.
 */
const ROOT_ANGLES_DEG = [-30, 174, 18, 128, 55, -90];
const SECTOR_SPAN_DEG = 52;

type LaidOutNode = EgoNetworkNode & { x: number; y: number; parentX: number; parentY: number };

/**
 * 실제 관계 그래프(트리)를 각도 기반으로 배치한다 — force-directed
 * physics는 쓰지 않는다(계속 흔들리는 레이아웃 금지, 2026-09-14 결정).
 * 같은 입력이면 항상 같은 좌표가 나오는 순수 계산이라 리렌더돼도
 * 안정적이다. 자식은 부모의 각도 섹터 안에서만 부채꼴로 퍼지므로 서로
 * 다른 가지끼리 겹치지 않는다.
 */
function layoutNetwork(network: EgoNetworkNode[]): LaidOutNode[] {
  const childrenOf = new Map<string | null, EgoNetworkNode[]>();
  for (const node of network) {
    const key = node.parentId;
    const list = childrenOf.get(key) ?? [];
    list.push(node);
    childrenOf.set(key, list);
  }

  const result: LaidOutNode[] = [];

  function place(node: EgoNetworkNode, angleDeg: number, sectorDeg: number, originX: number, originY: number) {
    const radius = RADIUS_BY_DEPTH[node.depth] ?? RADIUS_BY_DEPTH[3]!;
    const angleRad = (angleDeg * Math.PI) / 180;
    const x = CENTER.x + radius * Math.cos(angleRad);
    const y = CENTER.y + radius * Math.sin(angleRad);
    result.push({ ...node, x, y, parentX: originX, parentY: originY });

    const children = childrenOf.get(node.id) ?? [];
    if (children.length === 0) return;
    const step = sectorDeg / children.length;
    children.forEach((child, index) => {
      const childAngle = angleDeg - sectorDeg / 2 + step * (index + 0.5);
      place(child, childAngle, step, x, y);
    });
  }

  const rootChildren = childrenOf.get(null) ?? [];
  rootChildren.forEach((node, index) => {
    const angle = ROOT_ANGLES_DEG[index] ?? ROOT_ANGLES_DEG[ROOT_ANGLES_DEG.length - 1]!;
    place(node, angle, SECTOR_SPAN_DEG, CENTER.x, CENTER.y);
  });

  return result;
}

/**
 * 나를 root로 한 실제 관계 트리를 보여준다. 중간 연결자는 이름 없는 작은
 * 점으로, 각 가지의 끝(leaf)에 있는 실제 참여자는 표시 이름과 함께
 * 보여준다("중간은 익명, 끝만 실명" 2026-09-14 결정). 같은 사람은 같은
 * `id`로 오므로 React key가 안정적이고, 새로 나타난 사람만 마운트
 * 애니메이션이 재생된다 — 기존 노드는 리렌더돼도 움직이지 않는다.
 */
export function MiniConnectionGraph({ network }: { network: EgoNetworkNode[] }) {
  const nodes = layoutNetwork(network);

  return (
    <figure className="mini-connection-graph" aria-label="나를 중심으로 이어지는 실제 관계 그래프">
      <svg viewBox="0 0 390 300" role="img">
        <g className="mini-graph-branches">
          {nodes.map((node) => (
            <line key={`line-${node.id}`} x1={node.parentX} y1={node.parentY} x2={node.x} y2={node.y} pathLength="1" />
          ))}
        </g>
        {nodes.map((node) => {
          const showName = node.displayName !== null;
          return (
            <g key={`node-${node.id}`}>
              <circle
                className={showName ? "mini-graph-node mini-graph-leaf" : "mini-graph-node mini-graph-mid"}
                cx={node.x}
                cy={node.y}
                r={showName ? 11 : 7}
              />
              {showName && (
                <text className="mini-graph-leaf-label" x={node.x} y={node.y + 24} textAnchor="middle">
                  {node.displayName}
                </text>
              )}
            </g>
          );
        })}
        <g className="mini-graph-me">
          <image className="mini-graph-me-character" href="/assets/gamgyul-default.png" x="151" y="105" width="88" height="90" preserveAspectRatio="xMidYMid meet" />
          <text x={CENTER.x} y="218" textAnchor="middle">나</text>
        </g>
      </svg>
    </figure>
  );
}
