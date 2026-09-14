/**
 * `02_API_SPECS.md` §8.6이 설계한 고정 윈도우 rate limit — 프로세스 메모리
 * `Map`에 (키, {windowStart, count})를 저장한다. 새 스키마/영속 저장소는
 * 추가하지 않는다(설계 문서의 "DB 변경 최소화" 제약 그대로). 키는
 * `participantId` 기준이다 — 로그인 필수 엔드포인트라 IP보다 확실하고,
 * "챌린지 생성 = username 하나에 대한 조회 오라클"이라는 남용 경로를
 * 계정 단위로 막는다(결정 로그 2026-09-14 항목 6).
 *
 * 알려진 한계(§8.6과 동일): 서버리스/멀티 인스턴스 배포에서는 인스턴스마다
 * 메모리가 분리돼 실질 상한이 느슨해지고 콜드스타트마다 리셋된다. 실제
 * 배포 환경이 멀티 인스턴스로 확정되거나 대량 스캔이 관찰되면 영속
 * 카운터로 전환한다.
 */

interface WindowConfig {
  limit: number;
  windowMs: number;
}

interface Bucket {
  windowStart: number;
  count: number;
}

export type RateLimitResult = { allowed: true } | { allowed: false; retryAfterSeconds: number };

const buckets = new Map<string, Bucket>();

function currentBucket(key: string, config: WindowConfig, now: number): Bucket {
  const existing = buckets.get(key);
  if (!existing || now - existing.windowStart >= config.windowMs) {
    return { windowStart: now, count: 0 };
  }
  return existing;
}

/**
 * 여러 윈도우(예: 분당 + 시간당)를 함께 검사한다. 어느 하나라도 이미
 * 한도에 도달했으면 아무 윈도우도 증가시키지 않고 거부한다(먼저 검사한
 * 윈도우만 소모하고 나중 윈도우에서 막히는 것을 피하기 위해, 커밋 전에
 * 전부 먼저 확인한다).
 */
function checkWindows(keyPrefix: string, participantId: string, configs: WindowConfig[], now: number): RateLimitResult {
  const buckets_ = configs.map((config, i) => currentBucket(`${keyPrefix}:${i}:${participantId}`, config, now));

  for (let i = 0; i < configs.length; i += 1) {
    const config = configs[i]!;
    const bucket = buckets_[i]!;
    if (bucket.count >= config.limit) {
      const retryAfterMs = config.windowMs - (now - bucket.windowStart);
      return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil(retryAfterMs / 1000)) };
    }
  }

  configs.forEach((config, i) => {
    const bucket = buckets_[i]!;
    buckets.set(`${keyPrefix}:${i}:${participantId}`, { windowStart: bucket.windowStart, count: bucket.count + 1 });
  });

  return { allowed: true };
}

const CHALLENGE_CREATE_WINDOWS: WindowConfig[] = [
  { limit: 5, windowMs: 60_000 }, // 분당 5회
  { limit: 30, windowMs: 60 * 60_000 }, // 시간당 30회
];

/** `POST /api/challenges` — §8.6 "생성" 한도(분당 5회, 시간당 30회). */
export function checkChallengeCreateRateLimit(participantId: string): RateLimitResult {
  return checkWindows("challenge-create", participantId, CHALLENGE_CREATE_WINDOWS, Date.now());
}
