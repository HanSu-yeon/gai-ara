import Link from "next/link";
import { BrandHeader } from "@/components/Brand";
import { PublicChallengeList } from "@/components/PublicChallengeList";
import { isBackendConfigured } from "@/lib/env";

export const metadata = {
  title: "이 사람까지 진짜 이어질까? | 가이 알아?",
};

/**
 * 이 화면은 cookies()/headers() 같은 요청 API를 쓰지 않아서 기본값
 * (`dynamic = "auto"`)으로 두면 빌드 시점에 정적으로 프리렌더된다 — 그러면
 * 공개 챌린지 목록과 진행 상황이 빌드 시점 값으로 굳어버리고, 누가 연결을
 * 보태도 재배포 전까지 갱신되지 않는다. 홈(`/`)은 세션 확인 때문에 이미
 * 요청마다 렌더링되지만 이 화면은 그렇지 않으므로 명시적으로 강제한다.
 */
export const dynamic = "force-dynamic";

/**
 * `/challenges` — 2026-09-15 "홈 공개 챌린지 목록" 결정의 확장.
 * **진행 중인 공개 챌린지를 볼 수 있는 유일한 화면이다.** 홈에는 이 화면으로
 * 들어오는 버튼만 있고, `/create`에는 아예 노출하지 않는다.
 *
 * **챌린지 디렉터리가 아니다.** 운영자가 `target_challenges.is_public`을
 * 직접 켠 챌린지만 나오고(사용자용 공개 설정 UI 없음), 검색·필터·카테고리·
 * 랭킹·무한스크롤·target 자동완성은 만들지 않는다(`AGENTS.md` §1 원칙 3).
 * 항목을 누르면 기존 `/t/{token}`으로 가고, 거기서 기존 "나도 연결 보태기"
 * 플로우를 그대로 쓴다 — 별도 참여 화면을 만들지 않는다.
 *
 * 로그인은 필요 없다 — `/t/{token}` 자체가 로그인 전에도 열리는 공개
 * 공유 화면이고, 이 목록이 내보내는 값도 그 화면과 같은 범위다.
 */
export default function PublicChallengesPage() {
  return (
    <main className="brand-page challenges-page">
      <BrandHeader back />
      <h1 className="upload-heading">
        이 사람까지
        <br />
        진짜 이어질까?
      </h1>
      <p className="subtitle">아는 사이가 모여 건너건너 이어져요.</p>
      {isBackendConfigured() ? (
        <div className="challenges-page-list">
          <PublicChallengeList />
        </div>
      ) : null}
      <Link href="/login?returnTo=/create" className="text-link text-xs mt-4">
        찾고 싶은 사람이 따로 있나요? →
      </Link>
    </main>
  );
}
