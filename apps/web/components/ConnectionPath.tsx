const NODE_SPACING = 56;
const ROW_HEIGHT = 64;
const SLOTS_PER_ROW = 5;
const CHAR_SIZE = 52;
const DOT_RADIUS = 7;
const PADDING_X = 30;
const PADDING_Y = CHAR_SIZE / 2 + 4;

/**
 * 08의 "🍊 ? 🍊"가 실제로 발견된 경로("🍊 ─ ● ─ ... ─ 🍊")로 바뀐 모습을
 * 그린다. 양 끝만 실제 감귤 캐릭터고, 중간은 전부 이름 없는 원이다 — 몇
 * 명이 끼어 있든(최대 3다리라고 가정하지 않는다, 2026-09-14 결정) 실제
 * intermediaries 수만큼 원을 그린다. 모바일 한 줄에 다 안 들어가면 노드를
 * 줄이는 대신 뱀 모양(snake)으로 다음 줄로 이어간다 — "..."로 생략하지
 * 않고 실제 노드를 전부 유지한다.
 */
export function ConnectionPath({ intermediaries }: { intermediaries: number }) {
  const slotCount = intermediaries + 2; // 양 끝 캐릭터 포함
  const positions = Array.from({ length: slotCount }, (_, i) => {
    const row = Math.floor(i / SLOTS_PER_ROW);
    const colInRow = i % SLOTS_PER_ROW;
    const visualCol = row % 2 === 0 ? colInRow : SLOTS_PER_ROW - 1 - colInRow;
    return { x: PADDING_X + visualCol * NODE_SPACING, y: PADDING_Y + row * ROW_HEIGHT };
  });

  const rows = Math.floor((slotCount - 1) / SLOTS_PER_ROW) + 1;
  const colsInLastFullSense = Math.min(slotCount, SLOTS_PER_ROW);
  const width = PADDING_X * 2 + (colsInLastFullSense - 1) * NODE_SPACING + CHAR_SIZE;
  const height = PADDING_Y * 2 + (rows - 1) * ROW_HEIGHT;

  return (
    <figure className="connection-path" style={{ maxWidth: Math.min(width, 340) }} aria-label={`나와 상대 사이에 ${intermediaries}명이 이어진 경로`}>
      <svg viewBox={`0 0 ${width} ${height}`} role="img">
        <g className="connection-path-lines">
          {positions.slice(1).map((pos, i) => (
            <line key={`seg-${i}`} x1={positions[i]!.x} y1={positions[i]!.y} x2={pos.x} y2={pos.y} />
          ))}
        </g>
        {positions.map((pos, i) => {
          if (i === 0 || i === positions.length - 1) {
            return (
              <image
                key={`char-${i}`}
                href="/assets/gamgyul-default.png"
                x={pos.x - CHAR_SIZE / 2}
                y={pos.y - CHAR_SIZE / 2}
                width={CHAR_SIZE}
                height={CHAR_SIZE}
                preserveAspectRatio="xMidYMid meet"
              />
            );
          }
          return <circle key={`dot-${i}`} className="connection-path-dot" cx={pos.x} cy={pos.y} r={DOT_RADIUS} />;
        })}
      </svg>
      <div className="connection-path-labels">
        <span>나</span>
        <span>상대</span>
      </div>
    </figure>
  );
}
