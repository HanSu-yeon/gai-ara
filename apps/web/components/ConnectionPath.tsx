import type { ReferralPathNode } from "@gai-ara/shared";

const NODE_SPACING = 62;
const ROW_HEIGHT = 76;
const SLOTS_PER_ROW = 5;
const CHAR_SIZE = 52;
const NAMED_DOT_RADIUS = 11;
const ANON_DOT_RADIUS = 7;
const PADDING_X = 34;
const PADDING_Y = CHAR_SIZE / 2 + 4;
const LABEL_OFFSET = 22;

/**
 * 08의 "🍊 ? 🍊"가 실제로 발견된 경로("🍊 ─ 민지 ─ ○ ─ 채영")로 바뀐
 * 모습을 그린다. `path`는 조회자 본인부터 owner까지 실제 shortest path
 * 그대로다 — 양 끝(조회자·owner)과 조회자 본인이 direct confirmed인
 * 중간자는 실명으로, 그 외 중간자는 이름 없는 원으로 그린다(2026-09-14
 * 결정: "내가 직접 아는 사람은 나에게 보이고, 내가 직접 모르는 사람은
 * 익명이다"). 실명/익명 여부와 무관하게 "몇 다리"는 항상 실제 중간
 * 인원수(`path.length - 2`) 기준이다. 모바일 한 줄에 다 안 들어가면
 * 노드를 줄이는 대신 뱀 모양(snake)으로 다음 줄로 이어간다 — "..."로
 * 생략하지 않고 실제 노드를 전부 유지한다.
 */
export function ConnectionPath({ path }: { path: ReferralPathNode[] }) {
  const positions = path.map((_, i) => {
    const row = Math.floor(i / SLOTS_PER_ROW);
    const colInRow = i % SLOTS_PER_ROW;
    const visualCol = row % 2 === 0 ? colInRow : SLOTS_PER_ROW - 1 - colInRow;
    return { x: PADDING_X + visualCol * NODE_SPACING, y: PADDING_Y + row * ROW_HEIGHT };
  });

  const rows = Math.floor((path.length - 1) / SLOTS_PER_ROW) + 1;
  const colsInLastFullSense = Math.min(path.length, SLOTS_PER_ROW);
  const width = PADDING_X * 2 + (colsInLastFullSense - 1) * NODE_SPACING + CHAR_SIZE;
  const height = PADDING_Y * 2 + (rows - 1) * ROW_HEIGHT + LABEL_OFFSET;

  const ownerLabel = path.at(-1)?.displayName ?? "상대";

  return (
    <figure className="connection-path" style={{ maxWidth: Math.min(width, 340) }} aria-label={`나와 ${ownerLabel} 사이에 ${Math.max(path.length - 2, 0)}명이 이어진 경로`}>
      <svg viewBox={`0 0 ${width} ${height}`} role="img">
        <g className="connection-path-lines">
          {positions.slice(1).map((pos, i) => (
            <line key={`seg-${i}`} x1={positions[i]!.x} y1={positions[i]!.y} x2={pos.x} y2={pos.y} />
          ))}
        </g>
        {path.map((node, i) => {
          const pos = positions[i]!;
          const isEndpoint = i === 0 || i === path.length - 1;
          const label = i === 0 ? "나" : node.displayName;

          if (isEndpoint) {
            return (
              <g key={`node-${i}`}>
                <image
                  href="/assets/gamgyul-default.png"
                  x={pos.x - CHAR_SIZE / 2}
                  y={pos.y - CHAR_SIZE / 2}
                  width={CHAR_SIZE}
                  height={CHAR_SIZE}
                  preserveAspectRatio="xMidYMid meet"
                />
                <text className="connection-path-label" x={pos.x} y={pos.y + CHAR_SIZE / 2 + 16} textAnchor="middle">{label}</text>
              </g>
            );
          }

          if (node.displayName) {
            return (
              <g key={`node-${i}`}>
                <circle className="connection-path-named" cx={pos.x} cy={pos.y} r={NAMED_DOT_RADIUS} />
                <text className="connection-path-label" x={pos.x} y={pos.y + LABEL_OFFSET} textAnchor="middle">{node.displayName}</text>
              </g>
            );
          }

          return <circle key={`node-${i}`} className="connection-path-dot" cx={pos.x} cy={pos.y} r={ANON_DOT_RADIUS} />;
        })}
      </svg>
    </figure>
  );
}
