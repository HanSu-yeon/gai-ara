import Link from "next/link";
import { TrackedLink } from "@/components/TrackedLink";
import { listPublicChallenges } from "@/lib/challenges";
import { computeChallengeProgressBatch } from "@/lib/graph-service";
import { formatChallengeListStatus } from "@/lib/distance-copy";

/**
 * "이 사람까지 진짜 이어질까?" 공개 챌린지 — 2026-09-15 결정.
 *
 * **공개 챌린지 목록을 볼 수 있는 곳은 `/challenges` 한 곳뿐이다.** 홈은
 * 목록을 직접 그리지 않고 그 화면으로 가는 버튼만 두고(`PublicChallengeEntry`),
 * `/create`에는 아예 노출하지 않는다. 목록이 여러 화면에 흩어지면 홈이
 * 대시보드처럼 보이고 "어디서 뭘 보는 화면인지"가 흐려지기 때문이다.
 * (자기가 만들었거나 참여한 챌린지를 모아 보는 `/me`는 별개다 — 거기서는
 * `is_public`과 무관하게 자기 것만 자기에게 보여준다.)
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

  if (challenges.length === 0) {
    return (
      <p className="status-caption">
        아직 공개된 챌린지가 없어요.
        <br />
        궁금한 사람이 있다면 직접 만들어보세요.
      </p>
    );
  }

  return <ChallengeRows challenges={challenges} progresses={progresses} />;
}

/**
 * 챌린지 한 줄짜리 행 목록. `/challenges`(공개 목록)와 `/me`(내 챌린지)가
 * 같은 모양을 쓰도록 공유한다 — 한 줄에 이름 + 상태 한 마디뿐이고, 상태는
 * "N명 참여 · 찾는 중"과 "N다리 발견" 두 가지만 쓴다(원래 지시 §11).
 * 항목 전체를 누르면 `/t/{token}`으로 간다.
 */
export function ChallengeRows({
  challenges,
  progresses,
}: {
  challenges: ReadonlyArray<{
    token: string;
    displayName: string;
    participantCount: number;
    /** `/me`에서만 쓴다 — 내가 만든 챌린지에 작은 표시를 붙인다. */
    isCreator?: boolean;
  }>;
  progresses: ReadonlyArray<{ status: "searching" | "found"; distance: number | null }>;
}) {
  return (
    <ul className="public-challenge-list">
      {challenges.map((challenge, index) => {
        const progress = progresses[index];
        if (!progress) return null;
        return (
          <li key={challenge.token}>
            <TrackedLink
              href={`/t/${challenge.token}`}
              className="public-challenge-item"
              event="challenge_open"
              params={{ source: "list" }}
            >
              <span className="public-challenge-name">
                {challenge.displayName}
                {challenge.isCreator && <span className="challenge-mine-chip">내가 만든</span>}
              </span>
              <span
                className={
                  progress.status === "found"
                    ? "public-challenge-status is-found"
                    : "public-challenge-status"
                }
              >
                {formatChallengeListStatus(progress.status, progress.distance, challenge.participantCount)}
              </span>
            </TrackedLink>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * 홈(화면 01) 본문에 두는 발견 입구 — 2026-09-15 결정. 목록을 미리 그리지
 * 않고 제목·보조 카피와 함께 `/challenges`로 가는 버튼만 둔다. 헤더 우측은
 * "내 챌린지"(`/me`)가 쓰므로, 발견 쪽 입구는 홈 본문이 맡는다.
 *
 * 공개 챌린지 수와 무관하게 항상 보여준다 — 화면을 이동하는 버튼이라 홈의
 * 구성이 DB 상태에 따라 나타났다 사라지지 않는 편이 낫고, 비어 있는 경우는
 * `/challenges`가 자기 화면에서 안내한다. 덕분에 홈 렌더링에 DB 조회가
 * 하나도 추가되지 않는다.
 */
export function PublicChallengeEntry() {
  return (
    <section className="public-challenges" aria-labelledby="public-challenges-title">
      <h2 id="public-challenges-title">이 사람까지 진짜 이어질까?</h2>
      <p className="public-challenges-lead">아는 사이가 모여 건너건너 이어져요.</p>
      <TrackedLink
        href="/challenges"
        className="public-challenges-more"
        event="challenge_list_open"
        params={{ source: "home" }}
      >
        진행 중인 챌린지 보기 →
      </TrackedLink>
    </section>
  );
}
