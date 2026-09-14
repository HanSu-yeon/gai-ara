import { Fragment } from "react";
import Image from "next/image";

const MAX_INDIVIDUAL_LEADING_DOTS = 3;
const MAX_FANOUT_NODES = 5;

type LeadingSlot = { type: "dot" } | { type: "chip"; count: number };
type FanoutNode = { type: "named"; name: string } | { type: "anonymous" } | { type: "overflow"; count: number };

/**
 * 2026-09-15 협업형 챌린지 결정 — `/t/{token}`의 "길 발견" 결과 시각화.
 * `/r`의 `ConnectionPath`(`apps/web/components/ConnectionPath.tsx`)와
 * 완전히 분리된 별도 컴포넌트다 — 건드리지 않는다.
 *
 * 챌린지 결과는 불특정 다수가 보는 공개 공유 surface라 `/r`보다 보수적으로
 * 마스킹한다: 중간자(target 직전을 제외한 나머지)는 identity를 절대
 * 공개하지 않는다 — 서버는 그 구간을 `distance` 정수만으로 표현한다.
 *
 * 2026-09-15 추가 결정 — "마지막 연결자 fan-out". target 바로 직전
 * 단계에 동일한 minimum distance를 만드는 서로 다른 참여자가 여럿이면,
 * 그 사실을 한 줄짜리 익명 원 하나로 뭉개지 않고 실제 인원수만큼(최대
 * `MAX_FANOUT_NODES`명) 갈래로 펼쳐서 보여준다. 그중 공개 동의한
 * 사람만(서버가 이미 최대 3명으로 골라 내려준
 * `visibleLastConnectorNames`) 닉네임을 노드에 붙이고, 나머지는 이름
 * 없는 원으로만 그린다 — "익명"이라는 글자는 UI 어디에도 쓰지 않는다
 * (이름이 없는 원 자체가 "닉네임을 공개하지 않았다"는 뜻이다).
 * `MAX_FANOUT_NODES`를 넘는 인원은 "+N" 칩 하나로 뭉갠다.
 *
 * fan-out보다 앞쪽(target에서 두 걸음 이상 먼) 구간은 여전히 완전히
 * 익명이고 개별 신원을 구분하지 않는다 — 그 구간의 원 개수만 정확히
 * 맞추고(3명 이하면 개별, 4명 이상이면 압축 칩), 누가 누구인지는 절대
 * 표시하지 않는다. fan-out 자체가 이미 "target 직전 구조"를 보여주므로,
 * 예전처럼 그 구간의 마지막 원을 강제로 개별 표시할 필요가 없어졌다.
 *
 * distance <= 1(이미 직접 연결)이면 fan-out을 그리지 않는다 — 그 경우
 * "마지막 연결자"가 곧 시작점 자신이라 별도로 펼칠 중간 단계가 없다.
 */
export function ChallengePathStrip({
  targetDisplayName,
  distance,
  lastConnectorCount,
  visibleLastConnectorNames,
}: {
  targetDisplayName: string;
  distance: number;
  lastConnectorCount: number;
  visibleLastConnectorNames: string[];
}) {
  if (distance <= 1) {
    return (
      <div className="mini-path challenge-path-strip" role="img" aria-label={`우리와 ${targetDisplayName}는 바로 이어져 있어요`}>
        <Endpoint label="우리" />
        <span className="mini-path-line" />
        <Endpoint label={targetDisplayName} />
      </div>
    );
  }

  const leadingCount = Math.max(distance - 2, 0);
  const leadingSlots: LeadingSlot[] = leadingCount <= MAX_INDIVIDUAL_LEADING_DOTS
    ? Array.from({ length: leadingCount }, () => ({ type: "dot" }))
    : [{ type: "chip", count: leadingCount }];

  const shownFanoutCount = Math.max(lastConnectorCount, 1); // 최소 1명(직전 연결자)은 항상 있다고 가정
  const drawnCount = Math.min(shownFanoutCount, MAX_FANOUT_NODES);
  const overflow = shownFanoutCount - MAX_FANOUT_NODES;
  const namedCount = Math.min(visibleLastConnectorNames.length, drawnCount);

  const fanoutNodes: FanoutNode[] = [
    ...visibleLastConnectorNames.slice(0, namedCount).map((name): FanoutNode => ({ type: "named", name })),
    ...Array.from({ length: drawnCount - namedCount }, (): FanoutNode => ({ type: "anonymous" })),
    ...(overflow > 0 ? [{ type: "overflow", count: overflow } as const] : []),
  ];

  return (
    <div>
      <div
        className="mini-path challenge-path-strip"
        role="img"
        aria-label={`우리에서 ${leadingCount + 1}단계를 거쳐 ${targetDisplayName}까지, target 바로 앞에는 서로 다른 연결자가 ${lastConnectorCount}명 있어요`}
      >
        <Endpoint label="우리" />
        {leadingSlots.map((slot, i) => (
          <Fragment key={`leading-${i}`}>
            <span className="mini-path-line" />
            <div className="mini-path-item">
              {slot.type === "dot" ? <span className="mini-path-dot" /> : <span className="challenge-path-chip">+{slot.count}</span>}
            </div>
          </Fragment>
        ))}
        <span className="mini-path-line" />
        <div className="challenge-fanout">
          <div className="challenge-fanout-branches">
            {fanoutNodes.map((node, i) => (
              <div className="challenge-fanout-branch" key={i}>
                <span className="challenge-fanout-branch-line" />
                {node.type === "named" ? (
                  <div className="challenge-fanout-node">
                    <span className="mini-path-dot" />
                    <span className="challenge-fanout-name">{node.name}</span>
                  </div>
                ) : node.type === "overflow" ? (
                  <span className="challenge-path-chip">+{node.count}</span>
                ) : (
                  <span className="mini-path-dot" />
                )}
              </div>
            ))}
          </div>
        </div>
        <span className="mini-path-line" />
        <Endpoint label={targetDisplayName} />
      </div>
      {lastConnectorCount > MAX_FANOUT_NODES && (
        <p className="status-caption">마지막 연결 {lastConnectorCount}명</p>
      )}
    </div>
  );
}

function Endpoint({ label }: { label: string }) {
  return (
    <div className="mini-path-item">
      <Image src="/assets/gamgyul-default.png" alt="" width={38} height={41} className="mini-path-character" />
      <span className="mini-path-caption">{label}</span>
    </div>
  );
}
