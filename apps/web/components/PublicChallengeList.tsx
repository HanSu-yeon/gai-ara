import Link from "next/link";
import { listPublicChallenges } from "@/lib/challenges";
import { computeChallengeProgressBatch } from "@/lib/graph-service";
import { formatChallengeListStatus } from "@/lib/distance-copy";

/**
 * "이 사람까지 진짜 이어질까?" 공개 챌린지 — 2026-09-15 결정.
 *
 * **진행 중인 챌린지 목록을 볼 수 있는 곳은 `/challenges` 한 곳뿐이다.**
 * 다른 화면들은 헤더 우측 끝의 "챌린지 구경" 알약(`BrandHeader`의
 * `explore`)으로 이 화면에 들어올 뿐, 목록을 직접 그리지 않는다. 목록이 여러 화면에 흩어지면 홈이 대시보드처럼 보이고,
 * "어디서 뭘 보는 화면인지"가 흐려지기 때문이다.
 *
 * **모든 user-created 챌린지를 자동으로 공개하지 않는다** — `is_public`을
 * 운영자가 직접 켠 챌린지만 `listPublicChallenges`가 돌려준다. 일반인
 * 대상으로 만든 챌린지는 기본값(false)이라 어느 화면에도 나타날 수 없다.
 *
 * 노출하는 값은 이미 공개 공유 링크(`/t/{token}`)가 보여주는 것과 정확히
 * 같은 범위다: 챌린지 토큰, 운영자가 공개로 지정한 대상 이름, 참여자 수,
 * 그리고 status/distance. participantId·중간 경로 신원·동의 없는
 * displayName·raw Instagram username·해시·내부 그래프 노드 id는 이
 * 파일을 거치지 않는다(`PublicChallengeSummary`의 `id`/
 * `targetInstagramUsernameHash`는 서버에서 진행 상황을 계산할 때만 쓰고
 * 렌더링하지 않는다).
 */

/**
 * `/challenges` 본문. 공개된 챌린지를 전부, 참여자 수 내림차순 → 최신순으로
 * 보여준다. 한 줄에 이름 + 상태 한 마디뿐이다 — 상태는 "N명 참여 · 찾는 중"과
 * "N다리 발견" 두 가지만 쓴다(원래 지시 §11). 항목 전체를 누르면 기존
 * `/t/{token}`으로 가고, 거기서 기존 "나도 연결 보태기" 플로우를 그대로 쓴다.
 */
export async function PublicChallengeList() {
  let challenges: Awaited<ReturnType<typeof listPublicChallenges>>;
  let progresses: Awaited<ReturnType<typeof computeChallengeProgressBatch>>;
  try {
    challenges = await listPublicChallenges();
    progresses = await computeChallengeProgressBatch(challenges);
  } catch {
    return <p className="status-caption">목록을 불러오지 못했어요. 잠시 후 다시 열어주세요.</p>;
  }

  // 홈의 버튼은 항상 떠 있으므로 빈 상태로 들어올 수 있다 — 빈 화면 대신
  // 여기서 안내하고, 자기 챌린지를 만드는 쪽으로 이어준다.
  if (challenges.length === 0) {
    return (
      <p className="status-caption">
        아직 공개된 챌린지가 없어요.
        <br />
        궁금한 사람이 있다면 직접 만들어보세요.
      </p>
    );
  }

  return (
    <ul className="public-challenge-list">
      {challenges.map((challenge, index) => {
        const progress = progresses[index];
        if (!progress) return null;
        return (
          <li key={challenge.token}>
            <Link href={`/t/${challenge.token}`} className="public-challenge-item">
              <span className="public-challenge-name">{challenge.displayName}</span>
              <span
                className={
                  progress.status === "found"
                    ? "public-challenge-status is-found"
                    : "public-challenge-status"
                }
              >
                {formatChallengeListStatus(progress.status, progress.distance, challenge.participantCount)}
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
