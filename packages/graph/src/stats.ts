import { bfsDistances } from "./shortestPath";
import type { AdjacencyList, NodeId } from "./types";

export interface DistanceCounts {
  direct: number;
  within2: number;
  within3: number;
}

/**
 * "나"를 기준으로 직접 연결(1다리) / 2다리 이내 / 3다리 이내 인원수를 센다.
 * 랜딩/결과 화면의 "직접 연결 17명, 2다리 안 236명, 3다리 안 1,891명" 수치.
 */
export function distanceCountsFrom(
  graph: AdjacencyList,
  start: NodeId,
): DistanceCounts {
  const distances = bfsDistances(graph, start);

  let direct = 0;
  let within2 = 0;
  let within3 = 0;

  for (const [node, distance] of distances) {
    if (node === start) continue;
    if (distance <= 1) direct += 1;
    if (distance <= 2) within2 += 1;
    if (distance <= 3) within3 += 1;
  }

  return { direct, within2, within3 };
}

/**
 * "현재 참여자의 N%와 3다리 안에 연결되어 있어요" 계산.
 * totalParticipants는 나 자신을 제외한 전체 참여자 수를 넘겨야 한다.
 */
export function percentileWithin3(
  within3Count: number,
  totalParticipantsExcludingSelf: number,
): number {
  if (totalParticipantsExcludingSelf <= 0) return 0;
  return Math.round((within3Count / totalParticipantsExcludingSelf) * 100);
}
