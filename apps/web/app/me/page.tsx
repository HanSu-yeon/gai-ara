import Link from "next/link";
import { redirect } from "next/navigation";
import { BrandHeader, Character } from "@/components/Brand";
import { ChallengeRows } from "@/components/PublicChallengeList";
import { TrackedLink } from "@/components/TrackedLink";
import { listMyChallenges } from "@/lib/challenges";
import { computeChallengeProgressBatch } from "@/lib/graph-service";
import { isBackendConfigured } from "@/lib/env";
import { getDisplayName } from "@/lib/participants";
import { getSessionParticipantId } from "@/lib/session";
import { loginPathFor } from "@/lib/return-to";

export const metadata = {
  title: "마이페이지 | 가이 알아?",
};

/**
 * `/me`(마이페이지) — 2026-09-15 결정. "내 것"으로 돌아오는 유일한 화면이다.
 * 이름을 "내 챌린지"가 아니라 "마이페이지"로 둔 이유는, 여기가 내가 만든
 * 챌린지뿐 아니라 참여한 챌린지와 내 연결까지 모아 보는 곳이기 때문이다.
 *
 * 이 화면이 없을 때는 (1) 챌린지를 만든 뒤 `/t/{token}`을 벗어나면 토큰을
 * 다시 찾을 방법이 없었고, (2) 참여한 챌린지의 진행 상황을 다시 볼 수
 * 없었으며, (3) `/result`(내 연결)는 `/connect`·`/invite` 확인 화면에서만
 * 링크돼 사실상 고아 상태였다. 세 가지 모두 여기서 해결한다. `/result`는
 * 카드가 아니라 화면 아래 텍스트 링크로만 잇는다 — 이 화면의 주인공은
 * 챌린지 목록이고, 카드를 하나 더 얹으면 대시보드처럼 보인다.
 *
 * 보여주는 건 **자기 것뿐이다** — 내가 만들었거나(`creator_participant_id`)
 * 내가 참여한(`challenge_participants`) 챌린지만 `listMyChallenges`가
 * 세션 주인의 id로 조회한다. `is_public`과 무관하지만, 남의 챌린지를
 * 찾아보는 통로가 아니므로 `AGENTS.md` §1 원칙 3의 "challenge 전체 목록/
 * 탐색" 금지와 충돌하지 않는다. 진행 상황(status/distance)도 공개 목록과
 * 똑같이 `computeChallengeProgressBatch`로 계산한다 — 내 화면이라고 해서
 * 중간 경로 identity를 더 보여주지 않는다.
 *
 * `/create`·`/upload`·`/result`와 같은 이유로 로그인 + 표시 이름을 먼저
 * 요구한다.
 */
export default async function MyPage() {
  if (!isBackendConfigured()) redirect("/");

  const participantId = await getSessionParticipantId();
  const displayName = participantId ? await getDisplayName(participantId) : null;
  if (!participantId || !displayName) redirect(loginPathFor("/me"));

  const challenges = await listMyChallenges(participantId);
  const progresses = await computeChallengeProgressBatch(challenges);

  return (
    <main className="brand-page">
      <BrandHeader back mine={false} />
      <h1 className="upload-heading">마이페이지</h1>
      <p className="subtitle">내가 만들었거나 참여한 챌린지예요.</p>

      {challenges.length === 0 ? (
        <>
          <Character kind="curious" className="result-character" />
          <p className="subtitle">
            아직 만들거나 참여한 챌린지가 없어요.
            <br />
            궁금한 사람부터 찾아볼까요?
          </p>
          <Link href="/create" className="primary-button mt-6">
            챌린지 만들어보기
          </Link>
        </>
      ) : (
        <>
          <div className="my-challenge-list">
            <ChallengeRows challenges={challenges} progresses={progresses} />
          </div>
          <Link href="/create" className="public-challenges-more mt-4">
            새 챌린지 만들기 →
          </Link>
        </>
      )}

      <div className="my-page-links">
        <Link href="/result" className="text-link text-xs">
          이어진 사람 보기 →
        </Link>
        <TrackedLink
          href="/challenges"
          className="text-link text-xs"
          event="challenge_list_open"
          params={{ source: "my_page" }}
        >
          다른 사람들의 챌린지 구경하기 →
        </TrackedLink>
      </div>
    </main>
  );
}
