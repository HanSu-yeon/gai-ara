import Link from "next/link";
import type { ConnectionSummary } from "@/lib/participants";
import { BrandHeader, Character, Icon } from "@/components/Brand";

/**
 * 화면 06(`/result`) — 2026-09-15 협업형 챌린지 결정으로 메인 플로우에서
 * 빠진 뒤, 화면 자체도 최소한으로 줄였다. 이 화면의 일은 하나다: **내
 * 연결이 지금 어떤 상태인지 정직하게 보여주고, 다음 행동 하나만 제시한다.**
 *
 * 2026-09-15 추가 정리
 * 1. "다른 방법으로 이어보기" 바텀시트를 없앴다. 관계를 보태는 방법을 한
 *    화면에서 여러 갈래로 늘어놓으면 "지금 뭘 해야 하는지"가 흐려진다.
 *    공유 링크도 챌린지 링크(`/t/{token}`) 하나로 통일했다 — 이 제품이
 *    확인하고 싶은 건 "지인인지"가 아니라 "궁금한 사람까지 이어지는지"다.
 *    `/connect`·`/r` 화면과 API는 삭제하지 않았다(이미 링크를 받은 사람은
 *    그대로 동작한다). 챌린지를 만드는 버튼도 여기 두지 않는다 — 그건
 *    홈과 마이페이지의 일이고, 이 화면의 주제가 아니다.
 * 2. **이미 가져온 사람에게 "인스타 연결 가져오기"를 다시 내밀지 않는다.**
 *    대신 가져온 맞팔 수와 실제로 이어진 사람 수를 나란히 보여준다. 이
 *    둘은 다를 수 있고(맞팔 상대도 참여자여야 edge가 된다), 그 차이를
 *    숨기면 "데이터를 넣었는데 왜 아무것도 없지?"가 된다. 이어진 사람이
 *    0명이면 이유까지 한 줄로 말해준다.
 */
export function ResultScreen({ summary }: { summary: ConnectionSummary | null }) {
  const imported = summary?.hasLinkedInstagram ?? false;

  return (
    <main className="brand-page result-page">
      <BrandHeader />
      <Character kind={summary && summary.connectedPeople > 0 ? "heart" : "curious"} className="result-character" />

      {imported && summary ? (
        <>
          <h1 className="upload-heading cluster-heading">
            {summary.connectedPeople > 0
              ? `${summary.connectedPeople}명과 이어져 있어요`
              : "아직 이어진 사람이 없어요"}
          </h1>
          <p className="subtitle cluster-subtitle">
            {summary.connectedPeople > 0 ? (
              <>
                인스타에서 가져온 맞팔 {summary.importedMutuals}명 중<br />
                {summary.connectedPeople}명이 가이 알아?에 함께 있어요.
              </>
            ) : (
              <>
                맞팔 {summary.importedMutuals}명을 가져왔지만
                <br />
                아직 가이 알아?에 함께 있는 사람이 없어요.
              </>
            )}
          </p>
          <p className="status-caption">상대도 인스타를 연동해야 서로 이어져요.</p>
          <Link href="/upload?step=form" className="public-challenges-more mt-5">
            아는 사람 더 가져오기 →
          </Link>
        </>
      ) : (
        <>
          <h1 className="upload-heading cluster-heading">여기서부터 이어져요</h1>
          <p className="subtitle cluster-subtitle">
            인스타에서 아는 사람을 가져오면
            <br />
            여기서부터 길이 이어져요.
          </p>
          <Link href="/upload?step=form" className="primary-button mt-4">
            인스타 연결 가져오기 <Icon name="arrow" />
          </Link>
          <p className="status-caption">서로 팔로우하는 사람만 연결에 사용해요.</p>
        </>
      )}
    </main>
  );
}
