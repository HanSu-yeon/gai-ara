"use client";

import { useMemo, useState } from "react";
import type { MeNetwork, MeNetworkNode, ReferralPathNode } from "@gai-ara/shared";
import { ConnectionPath } from "@/components/ConnectionPath";
import { formatConnectionHeadline, formatConnectionSubtitle } from "@/lib/distance-copy";

/** 하단 시트용 한 줄 헤드라인 — 09 화면과 같은 규칙(중간 인원 수 기준)이지만 2줄로 안 쪼갠다. */
function sheetHeadline(distance: number): string {
  if (distance <= 1) return "이미 바로 아는 사이";
  const { top, bottom } = formatConnectionHeadline(distance);
  return `${top} ${bottom}`;
}

const CENTER = { x: 195, y: 150 };
// 깊이별 반지름 간격 — 이전 값은 depth 2 이후 간격이 너무 좁아서 하나의
// 가지(형제 없이 쭉 이어지는 discovered path)에서 노드/라벨이 서로
// 붙어버렸다(2026-09-14 지적). topology는 그대로 두고 간격만 넉넉하게
// 늘렸다.
const RADIUS_BY_DEPTH: Record<number, number> = { 1: 88, 2: 130, 3: 168, 4: 202, 5: 230, 6: 252 };

/**
 * depth 1(root에 바로 붙는 가지) 각도. 12시 방향(정중앙 위)부터 채우면
 * 안테나처럼 보인다(2026-09-14 피드백)는 이유로 1~2시 방향을 먼저 쓰고,
 * 6개 슬롯이 다 찰 때만 마지막으로 12시(-90°)를 쓴다. direct는 상한이
 * 없으므로(2026-09-14 결정) 7명이 넘으면 360°를 고르게 나눠 쓴다.
 */
const ROOT_ANGLES_DEG = [-30, 174, 18, 128, 55, -90];

type LaidOutNode = MeNetworkNode & { x: number; y: number };

/**
 * 실제 관계 그래프(트리 + 트리 밖 실제 간선)를 각도 기반으로 배치한다 —
 * force-directed physics는 쓰지 않는다(계속 흔들리는 레이아웃 금지,
 * 2026-09-14 결정). `parentId`는 오직 각도를 물려받기 위한 레이아웃
 * 힌트고, 실제로 그리는 선은 `network.edges` 전체다(삼각형·재합류 포함).
 * 같은 입력이면 항상 같은 좌표가 나오는 순수 계산이라 리렌더돼도 안정적이다.
 */
function layoutNetwork(nodes: MeNetworkNode[]): Map<string, LaidOutNode> {
  const childrenOf = new Map<string | null, MeNetworkNode[]>();
  for (const node of nodes) {
    const list = childrenOf.get(node.parentId) ?? [];
    list.push(node);
    childrenOf.set(node.parentId, list);
  }

  const laidOut = new Map<string, LaidOutNode>();

  function place(node: MeNetworkNode, angleDeg: number, sectorDeg: number) {
    const radius = RADIUS_BY_DEPTH[node.depth] ?? RADIUS_BY_DEPTH[6]!;
    const angleRad = (angleDeg * Math.PI) / 180;
    laidOut.set(node.id, { ...node, x: CENTER.x + radius * Math.cos(angleRad), y: CENTER.y + radius * Math.sin(angleRad) });

    const children = childrenOf.get(node.id) ?? [];
    if (children.length === 0) return;
    const childSector = Math.min(sectorDeg, 52);
    const step = childSector / children.length;
    children.forEach((child, index) => {
      const childAngle = angleDeg - childSector / 2 + step * (index + 0.5);
      place(child, childAngle, step);
    });
  }

  const rootChildren = childrenOf.get(null) ?? [];
  const rootSector = rootChildren.length > ROOT_ANGLES_DEG.length ? 360 / rootChildren.length : 52;
  rootChildren.forEach((node, index) => {
    const angle = rootChildren.length > ROOT_ANGLES_DEG.length
      ? ROOT_ANGLES_DEG[0]! + rootSector * index
      : ROOT_ANGLES_DEG[index] ?? ROOT_ANGLES_DEG[ROOT_ANGLES_DEG.length - 1]!;
    place(node, angle, rootSector);
  });

  return laidOut;
}

function edgeKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

/** 선택된 노드부터 root까지 parentId 체인을 따라가 root→...→선택 순서로 재구성한다. */
function pathToRoot(nodeId: string, nodesById: Map<string, MeNetworkNode>): ReferralPathNode[] {
  const chain: ReferralPathNode[] = [];
  let cursor: string | null = nodeId;
  while (cursor !== null) {
    const node = nodesById.get(cursor);
    if (!node) break;
    chain.push({ id: node.id, displayName: node.displayName });
    cursor = node.parentId;
  }
  chain.reverse();
  return [{ id: "root", displayName: null }, ...chain];
}

/**
 * 나를 root로 한 "내가 발견한 연결" 그래프를 보여준다(2026-09-14
 * 결정) — 직접 아는 사람과, `/r`로 실제 경로가 발견된 상대만 표시
 * 이름과 함께 나오고, 그 사이 중간자는 존재와 연결만 보여주되 신원은
 * 항상 익명이다. 이름이 있는 노드(직접·발견된 endpoint)를 누르면 그
 * 사람까지의 경로를 강조하고 하단 시트로 상세를 보여준다. 같은 사람은
 * 같은 id로 오므로 React key가 안정적이고, 새로 나타난 사람/간선만
 * 마운트 애니메이션이 재생된다 — 기존 노드는 리렌더돼도 움직이지 않는다.
 */
export function MiniConnectionGraph({ network }: { network: MeNetwork }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const positioned = layoutNetwork(network.nodes);
  const center = { x: CENTER.x, y: CENTER.y };
  const nodesById = useMemo(() => new Map(network.nodes.map((node) => [node.id, node])), [network.nodes]);

  const selectedPath = selectedId ? pathToRoot(selectedId, nodesById) : null;
  const highlightedEdgeKeys = useMemo(() => {
    if (!selectedPath) return null;
    const keys = new Set<string>();
    for (let i = 1; i < selectedPath.length; i += 1) {
      const from = i === 1 ? "root" : selectedPath[i - 1]!.id;
      keys.add(edgeKey(from === "root" ? "__center__" : from, selectedPath[i]!.id));
    }
    return keys;
  }, [selectedPath]);

  const lines = network.edges.map(([a, b]) => {
    const start = positioned.get(a) ?? center;
    const end = positioned.get(b) ?? center;
    const aKey = positioned.has(a) ? a : "__center__";
    const bKey = positioned.has(b) ? b : "__center__";
    const onSelectedPath = highlightedEdgeKeys?.has(edgeKey(aKey, bKey)) ?? false;
    return { key: `${a}-${b}`, x1: start.x, y1: start.y, x2: end.x, y2: end.y, onSelectedPath };
  });

  const selected = selectedId ? nodesById.get(selectedId) ?? null : null;
  const selectedDistance = selectedPath ? selectedPath.length - 1 : 0;
  const selectedIntermediaryLabel = selectedPath && selectedPath.length > 2 ? selectedPath[1]!.displayName : null;

  // 6홉까지 벌어질 수 있는 고정 390x300 박스를 항상 쓰면, 연결이 몇 명뿐일
  // 때 그래프 아래에 빈 여백만 잔뜩 남는다(2026-09-14 지적) — 실제로 배치된
  // 노드(+ mascot 주변 최소 여유)만큼만 감싸는 viewBox를 매번 계산해서,
  // 데이터가 적으면 그래프 자체가 작고 조밀하게, 많으면 자연스럽게 커지게
  // 한다.
  const nodePositions = [...positioned.values()];
  const xs = [CENTER.x - 60, CENTER.x + 60, ...nodePositions.map((n) => n.x)];
  const ys = [CENTER.y - 60, CENTER.y + 60, ...nodePositions.map((n) => n.y)];
  const PAD = 42;
  const minX = Math.min(...xs) - PAD;
  const maxX = Math.max(...xs) + PAD;
  const minY = Math.min(...ys) - PAD;
  const maxY = Math.max(...ys) + PAD;

  return (
    <figure className="mini-connection-graph" aria-label="나를 중심으로 이어지는, 내가 발견한 관계 그래프">
      <svg viewBox={`${minX} ${minY} ${maxX - minX} ${maxY - minY}`} role="img" className={selectedId ? "has-selection" : ""}>
        <g className="mini-graph-branches">
          {lines.map((line) => (
            <line
              key={`line-${line.key}`}
              className={line.onSelectedPath ? "is-highlighted" : selectedId ? "is-dimmed" : ""}
              x1={line.x1} y1={line.y1} x2={line.x2} y2={line.y2} pathLength="1"
            />
          ))}
        </g>
        {[...positioned.values()].map((node) => {
          const showName = node.displayName !== null;
          const isDirect = node.depth === 1 && showName;
          const isSelected = node.id === selectedId;
          const isDimmed = Boolean(selectedId) && !isSelected && !highlightedEdgeKeys?.has(edgeKey("__center__", node.id)) && !isNodeOnPath(node.id, selectedPath);
          const nodeClass = !showName
            ? "mini-graph-node mini-graph-mid"
            : isDirect
              ? "mini-graph-node mini-graph-direct"
              : "mini-graph-node mini-graph-endpoint";
          return (
            <g
              key={`node-${node.id}`}
              className={showName ? "mini-graph-clickable" : ""}
              onClick={showName ? () => setSelectedId((current) => (current === node.id ? null : node.id)) : undefined}
            >
              {showName && <circle className="mini-graph-hit-area" cx={node.x} cy={node.y} r={17} />}
              <circle
                className={`${nodeClass} ${isDimmed ? "is-dimmed" : ""} ${isSelected ? "is-selected" : ""}`}
                cx={node.x}
                cy={node.y}
                r={showName ? 9 : 6}
              />
              {showName && (
                <text className={`mini-graph-leaf-label ${isDimmed ? "is-dimmed" : ""}`} x={node.x} y={node.y + 24} textAnchor="middle">
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
      {network.hiddenBeyondCount > 0 && (
        <p className="mini-graph-more">그 너머로 {network.hiddenBeyondCount}명이 더 이어져 있어요.</p>
      )}

      {selected && selectedPath && (
        <div className="mini-graph-sheet-backdrop" onClick={() => setSelectedId(null)}>
          <div className="mini-graph-sheet" onClick={(event) => event.stopPropagation()}>
            <button type="button" className="mini-graph-sheet-close" onClick={() => setSelectedId(null)} aria-label="닫기">✕</button>
            <h3>{selected.displayName}</h3>
            <p className="mini-graph-sheet-headline">{sheetHeadline(selectedDistance)}</p>
            {selectedIntermediaryLabel && selectedDistance > 1 && (
              <p className="subtitle">{selectedIntermediaryLabel}를 통해 이어져 있어요.</p>
            )}
            {selectedDistance > 1 && <p className="subtitle">{formatConnectionSubtitle(selectedDistance)}</p>}
            <ConnectionPath path={selectedPath} />
          </div>
        </div>
      )}
    </figure>
  );
}

function isNodeOnPath(nodeId: string, path: ReferralPathNode[] | null): boolean {
  if (!path) return false;
  return path.some((node) => node.id === nodeId);
}
