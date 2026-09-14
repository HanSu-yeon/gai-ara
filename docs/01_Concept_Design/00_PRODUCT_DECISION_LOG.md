# Product Decision Log

제품 가설과 변경 이유, 검증 지표, 재검토 조건을 기록한다. 구현 상태만 설명하는 문서가
아니며, 새 데이터가 쌓이면 기존 결정을 수정하거나 뒤집을 수 있다.

## 2026-09-15 — 홈 공개 챌린지 목록, 그리고 global start-set 제안 기각 (구현 완료)

### 상태

채택, 구현 완료. 같은 날 검토했던 "global start-set" 변경은 **기각**.

### 문제

1. 홈(화면 01)에 처음 온 사람은 "누구를 찾을지" 직접 떠올려서 `/create`에
   입력해야만 서비스를 경험할 수 있다. 남들이 이미 찾고 있는 대상을 눌러
   바로 참여해볼 수 있는 입구가 없었다.
2. 동시에 "챌린지 progress를 challenge별 start-set이 아니라 global trusted
   graph 전체(= edge를 하나 이상 가진 participant 전원) 기준으로 계산하자"는
   제안이 나왔다. 관계 데이터가 항상 global이라는 사실(이미 그렇다)과
   start-set이 challenge별이라는 사실이 섞여 보인 데서 나온 제안이다.

### 결정

1. **start-set은 계속 challenge별(`challenge_participants`)로 둔다 — global
   start-set 제안은 기각한다.** start-set을 "edge를 하나 이상 가진
   participant 전원"으로 두면 최단거리가 **항상 1로 붕괴**하기 때문이다:
   target이 그래프에 붙어 있다는 것은 곧 target과 직접 연결된 노드가
   존재한다는 뜻이고, 그 노드는 정의상 edge를 가졌으므로 그 자신이
   start-set 멤버가 된다(external Instagram target의 맞팔 leaf 후보도
   마찬가지로 0 + 1 = 1). 그러면 `found`는 "누군가 target과 직접 아는
   사이인가"라는 이진 판정이 되고, "N다리"라는 제품의 핵심 개념과
   `distance-copy`·마지막 연결자 fan-out이 전부 의미를 잃는다.
2. **관계 데이터(edge)는 지금도, 앞으로도 global이다.** 어느 챌린지
   화면에서 보탰든 trusted edge는 전역 그래프(`getAllEdges()`)에 들어가고,
   탐색은 그 전역 그래프 위에서 일어난다 — 중간 노드가 그 챌린지에
   참여했을 필요는 없다. 따라서 A가 부승관 챌린지에서 보탠 연결이
   장원영 챌린지 경로의 중간 edge로 쓰일 수 있다. 이 부분은 이미 구현돼
   있어 코드 변경이 없다. 최종 구조는 **global trusted graph +
   challenge별 start-set + challenge별 target**이다.
3. **홈에 "이 사람까지 진짜 이어질까?" 공개 챌린지 섹션을 추가한다.**
   보조 카피는 "아는 사이가 모여 건너건너 이어져요.". 항목은 이름 한 줄 +
   상태 한 줄이고, 상태는 두 가지뿐이다 — `{participantCount}명 참여 ·
   찾는 중` / `{N}다리 발견`. "닿는 길", "연결망", "네트워크", "경로 탐색"
   같은 표현은 목록 UI에서 쓰지 않는다. 항목 전체를 누르면 기존
   `/t/{token}`으로 가고, 별도 참여 화면은 만들지 않는다.
   **진행 중인 챌린지 목록을 볼 수 있는 곳은 `/challenges` 한 곳뿐이다** —
   홈은 목록을 직접 그리지 않고, 같은 제목·보조 카피와 함께 "진행 중인
   챌린지 보기 →" 버튼만 둔다. 목록이 여러 화면에 흩어지면 홈이
   대시보드처럼 보이고 각 화면의 목적이 흐려지기 때문이다. 공개된 챌린지가
   하나도 없으면 홈의 이 섹션은 아예 그리지 않는다(빈 화면으로 보내는
   버튼을 만들지 않는다).
4. **모든 user-created 챌린지를 자동 공개하지 않는다.** `target_challenges.is_public`
   (신규 컬럼, 기본값 false)을 운영자가 직접 켠 챌린지만 노출한다.
   사용자용 공개/비공개 설정 UI는 만들지 않는다 — 일반인 대상 챌린지가
   의도치 않게 공개 디렉터리에 올라갈 경로 자체를 코드에 두지 않기 위해서다.
5. **목록을 노출하는 공개 API 라우트를 만들지 않는다.** 홈과
   `/challenges`의 서버 컴포넌트가 DB를 직접 읽어 렌더링한다.
   검색·필터·카테고리·랭킹·무한스크롤·인기 검색어·target 자동완성은
   만들지 않는다 — `/challenges`는 "공개로 지정된 챌린지를 한 화면에 쭉
   보여주는" 것 이상을 하지 않는다. cookies/headers를 쓰지 않아 기본값으로
   두면 빌드 시점에 정적으로 굳어버리므로 `dynamic = "force-dynamic"`을
   명시한다. 운영자만 공개를 켤 수 있으므로 이
   목록이 통제 없이 커지지 않는다.
6. **found 챌린지도 목록에서 빼지 않는다.** 전역 그래프에 새 관계가
   추가되면 더 짧은 거리나 새로운 마지막 연결자가 나올 수 있으므로,
   길을 한 번 찾았다고 챌린지가 끝나지 않는다.
7. **`participantCount`는 실제 start-set 크기다.** `challenge_participants`
   행 수 그대로이고, 그 사람들이 곧 그 챌린지 탐색의 시작점이다 —
   "312명 참여"는 장식용 숫자가 아니다.
8. **`/create`에는 공개 챌린지 목록을 보여주지 않는다.** 자기 챌린지를
   만드는 화면에 남의 챌린지를 섞으면 화면의 목적이 흐려진다. 목록을
   보여주는 화면은 `/challenges` 하나뿐이다.
9. **`/challenges` 진입점은 `BrandHeader` 우측 끝에 상시로 둔다**
   ("챌린지 구경"). 홈 랜딩에만 두면 기존 사용자가 발견하지 못한다.
   `home`("처음으로")이 이미 우측을 쓰는 화면과 `/challenges` 자신에서는
   생략한다.
10. **홈(`/`)에서 로그인+표시 이름을 마친 세션을 `/create`로 보내던
    리다이렉트를 없앴다.** 헤더 로고가 항상 `/`를 가리키는데 `/`에 머물 수
    없어서 답답하고, 랜딩에만 있는 것들(공개 챌린지 입구,
    개인정보처리방침)에 기존 사용자가 도달할 방법이 사라지는 문제가
    있었다. 대신 세션 상태에 따라 메인 CTA의 목적지만 바꾼다 — 이미
    준비된 사용자는 `/login`을 거치지 않고 곧장 `/create`로 간다.
11. **`/t/{token}`에 "나는 몇 다리인지"(`viewerDistance`)를 함께 보여준다.**
    챌린지 전체의 진행 상황("우리가 길을 찾았는가", start-set 기준)과 뷰어
    개인의 거리는 서로 다른 질문이고 둘 다 의미가 있다 — 이 제품의 원래
    후킹("혹시 나도 유명인이랑 건너건너 아는 사이일까?")에 답하는 건 후자다.
    별도 엔드포인트를 만들지 않고 기존 공개 조회 응답에 필드 하나로 싣는다.
    로그인한 뷰어에게만 채우고, 길이 없거나 비로그인이면 null이라 화면에
    아무것도 그리지 않는다 — "당신은 아직 이어지지 않았어요" 같은 문구는
    쓰지 않는다(실패처럼 읽히고, 다음 행동은 어차피 바로 아래 CTA가 안내한다).
12. **공유 링크는 챌린지 링크(`/t/{token}`) 하나로 통일한다.** 이 제품이
    확인하고 싶은 건 "지인인지"가 아니라 "궁금한 사람까지 이어지는지"이므로,
    `/result`에서 지인 확인 링크(`/connect`)와 거리 확인 공유 링크(`/r`)를
    만드는 바텀시트를 없앴다. 두 화면과 API는 삭제하지 않았다 — 이미 링크를
    받은 사람은 그대로 동작한다. `/result`의 두 번째 행동은 `/create`로 보낸다.
13. **`/me`(내 챌린지)를 만든다.** 만든 뒤 `/t/{token}`을 벗어나면 토큰을
    다시 찾을 방법이 없었고, 참여한 챌린지의 진행 상황도 다시 볼 수 없었으며,
    `/result`는 메인 플로우에 진입점이 없어 고아 상태였다. 헤더 우측 끝
    "내 챌린지"가 어느 화면에서나 이 화면으로 돌아오는 길이다.
14. **로그인 후 기본 목적지를 홈(`/`)으로 바꾼다.** 기존에는 `/result`와
    `/connect`로 흩어졌다. `/me`가 returnTo 허용목록에 빠져 있어 로그아웃
    상태에서 "내 챌린지"를 누르면 로그인 뒤 엉뚱한 화면으로 가던 버그도
    함께 고쳤다 — 로그인을 요구하는 화면을 새로 만들면 `normalizeReturnTo`의
    허용목록에 반드시 추가한다.
15. **사용자용 공개/비공개 설정 UI는 이번에도 만들지 않는다**(재확인,
    2026-09-15). 챌린지 대상은 유명인으로 한정되지 않고 누구든 될 수
    있으므로, 만들 때 켤 수 있는 체크박스 하나만 있어도 동의한 적 없는
    일반인의 이름이 발견 화면에 올라간다. 목록이 비어 보이는 문제는
    운영자가 공개 대상을 직접 켜서 해결한다.

### 노출 범위(추가로 공개되는 개인정보 없음)

공개 목록이 내보내는 값은 이미 `/t/{token}` 공유 링크가 보여주는 것과 정확히
같다 — 챌린지 토큰, 운영자가 공개로 지정한 대상 이름, 참여자 수, status,
distance. participantId·중간 경로 identity·동의 없는 displayName·raw
Instagram username·Instagram 해시·내부 그래프 노드 id·전체 shortest path는
목록에도, 그 어떤 응답에도 포함되지 않는다.

### 성능

공개 목록(최대 5개)의 progress는 요청 시점에 계산한다.
`computeChallengeProgressBatch`가 전역 edge 조회와 `buildGraph`를 **한 번만**
수행하고 그래프를 재사용하며, 챌린지마다 남는 비용은 start-set 조회 한 번과
target 기준 BFS 한 번뿐이다(시작점이 몇 명이든 BFS는 target 쪽에서 한 번만
돈다). MVP 규모에서 충분하므로 progress 캐시나 백그라운드 잡은 도입하지
않는다 — 캐시가 없어서 누군가 연결을 보태면 다음 방문부터 바로 반영된다.

### 재검토 조건

- `/challenges`가 한 화면에 담기 어려울 만큼 길어지면 그때 페이지네이션을
  검토한다(무한스크롤은 만들지 않는다).
- 공개 목록의 progress 계산이 홈 응답 시간에 드러나기 시작하면 그때
  캐시를 도입한다.
- 사용자가 직접 자기 챌린지를 공개하고 싶다는 요구가 실제로 나오면,
  일반인 대상 노출 위험을 다시 검토한 뒤에만 설정 UI를 만든다.

### 관련 구현

- `apps/web/components/PublicChallengeList.tsx`
- `apps/web/app/challenges/page.tsx`
- `apps/web/app/page.tsx`
- `apps/web/components/Brand.tsx` (`BrandHeader`의 `explore`)
- `apps/web/lib/challenges.ts` (`listPublicChallenges`)
- `apps/web/lib/graph-service.ts` (`computeChallengeProgressBatch`)
- `apps/web/lib/distance-copy.ts` (`formatChallengeListStatus`)
- `packages/db/src/schema.ts` (`target_challenges.is_public`)
- `packages/db/migrations/0014_loose_adam_destine.sql`

## 2026-09-15 — 마지막 연결자 닉네임 조건부 공개 (구현 완료)

### 상태

채택, 구현 완료.

### 결정

1. **found 상태에서 target 바로 직전(1홉) participant("마지막 연결자")는
   조건부로 닉네임을 공개할 수 있다.** 중간(2홉 이상) participant의
   identity는 여전히 절대 공개하지 않는다 — 이 원칙은 바뀌지 않았다.
2. **동일 minimum distance를 만드는 마지막 연결자가 여럿이면 전부
   센다.** 한 명을 임의로 고르지 않는다. target이 실제 participant면
   `getAllEdges()` 기반 BFS-DAG 역전파로, target이 아직 participant가
   아니면(external Instagram leaf) minimum distance를 달성하는 leaf
   candidate 전부를 대상으로 계산한다(`apps/web/lib/graph-service.ts`의
   `findLastConnectors`/`computeChallengeReachability`). 동일 participant가
   여러 shortest path에 걸쳐 있어도 중복 없이 한 번만 센다.
3. **닉네임 공개는 사전 동의가 있는 participant에 한한다.**
   `participants.publicConnectorNameConsentAt`(신규 컬럼) — 이름을
   처음 설정하는 순간에만 채워진다(화면 02가 "길의 마지막 연결자가
   되면 이 이름이 챌린지에 표시될 수 있어요"라는 고지를 보여준 뒤의
   제출이 곧 동의). **이 기능 도입 전에 이미 이름을 설정한 기존
   participant는 이 문구를 본 적이 없으므로 값이 계속 NULL로 남고,
   소급 공개되지 않는다.** 기존 사용자를 위한 별도 재동의 화면은 이번
   범위에 넣지 않는다 — 필요해지면 추후 검토.
4. **동의 여부와 무관하게 "마지막 연결자 수"는 실제 그래프 계산값
   그대로 보여준다.** 닉네임 공개 여부가 챌린지 결과 자체를 바꾸지
   않는다. 동의 안 한 사람도 숫자에는 포함되고, 이름만 "익명"으로
   빠진다.
5. **공개 이름은 최대 3명까지만 노출한다**(390px 화면 기준). 나머지는
   "외 N명"으로 뭉뚱그린다 — 처음에는 "공개했지만 안 보이는 사람"과
   "애초에 비공개인 사람"을 구분해서 보여줬는데(예: "민지 · 수연 외
   공개 1명 · 익명 1명"), 실사용 확인 결과 한 화면에 정보가 너무 많아
   바로 이해되지 않아서 그냥 "민지 · 수연 외 2명"으로 단순화했다
   (`apps/web/lib/last-connector-copy.ts`) — 구분 정보 자체는 거짓이
   아니었지만 가독성이 우선이라고 판단했다.
6. **"OO가 target의 실제 지인이다" 같은 단정적 표현은 쓰지 않는다.**
   confirmed acquaintance와 Instagram mutual이 같은 trusted graph에
   함께 있으므로, 어느 쪽 관계인지 구분하지 않고 중립적으로 "연결"이라고만
   표현한다.
7. **public API는 participantId, 비동의 displayName, 전체 shortest
   path, intermediate identity, Instagram 원문/해시, 내부 그래프
   식별자 중 무엇도 내려보내지 않는다.** `GET /api/challenges/{token}`
   응답은 `lastConnectorCount`(그래프 계산값 그대로) /
   `consentedLastConnectorCount`(동의한 사람 수, API에는 남겨두되 UI는
   더 이상 쓰지 않음) / `visibleLastConnectorNames`(동의 + 상한 3명
   필터링 끝난 이름만)만 추가로 담는다.

### 유지하는 원칙

- 중간(2홉 이상) participant identity는 여전히 절대 공개하지 않는다.
- 동의 없는 participant의 displayName은 어떤 응답에도 나타나지 않는다.
- 기존 participant는 소급 공개되지 않는다(옵트인 없이는 항상 익명).
- 관계를 "실제 지인"이라고 과장하지 않는다.

### 재검토 조건

- 기존 사용자가 나중에 공개에 동의하고 싶어 하는 수요가 확인되면,
  현재 온보딩/라우팅 구조에서 가장 간단한 재동의 UX(예: `/result`에
  설정 링크 추가)를 검토한다 — 지금은 이름 편집 화면 자체가 없어서
  범위가 커진다.
- 상한 3명이 너무 적다/많다는 피드백이 쌓이면 숫자만 조정한다.

### 관련 문서

- [01_DB_SCHEMA.md §2](../03_Technical_Specs/01_DB_SCHEMA.md) —
  `participants.public_connector_name_consent_at`.
- [02_API_SPECS.md §8.2](../03_Technical_Specs/02_API_SPECS.md) —
  `GET /api/challenges/{token}` 응답 확장.

### 관련 구현

- `packages/db/src/schema.ts`의 `participants.publicConnectorNameConsentAt`,
  `packages/db/migrations/0013_true_ogun.sql`
- `apps/web/lib/participants.ts`의 `setDisplayName`(최초 설정 시에만
  동의 기록), `getConsentedDisplayNames`
- `apps/web/lib/graph-service.ts`의 `findLastConnectors`,
  `computeChallengeReachability`, `computeChallengePublicResult`
- `packages/shared/src/schemas.ts`의 `challengePublicResultSchema`
- `apps/web/lib/last-connector-copy.ts`(`formatLastConnectors`)
- `apps/web/components/TargetChallengeScreen.tsx`(found 화면에 표시),
  `apps/web/components/LoginScreen.tsx`(동의 고지 문구)
- `apps/web/app/privacy/page.tsx`(일반적인 수준의 고지 문구 추가)

## 2026-09-15 — 협업형 챌린지: 개인 Path Check가 아니라 "우리가 함께 찾는 길"로 최종 확정 (구현 완료, 아래 두 항목을 대체)

### 상태

채택, 구현 완료. 바로 아래 두 항목("타겟 챌린지 결과 화면", "Path Check를 공유형
'타겟 챌린지'로 확장")이 설계했던 **뷰어 개인 기준** 모델을 이 항목이 대체한다 —
그 두 항목의 "타겟 챌린지를 만든다"는 큰 방향(사용자가 직접 대상을 지정, opaque
token 공유, 존재 여부 비노출)은 그대로 유지하지만, 결과가 "나는 대상까지 N다리"가
아니라 "우리가 모은 연결에서 대상까지 가는 길을 찾았는가"로 바뀐다.

### 문제

바로 아래 항목까지의 설계는 `/t/{token}`을 열면 그 사람이 로그인해서 "자기 기준"
Path Check를 실행하는 화면이었다. 이 모델은 두 가지가 아쉬웠다: (1) 한 사람이
확인하고 끝나는 1회성 조회라 "여러 사람이 함께 참여해서 점점 더 가까워진다"는
바이럴 루프가 생기지 않는다. (2) "나는 이 사람까지 N다리"라는 결과가 각 조회자마다
따로 계산되므로, 챌린지라는 단어가 뜻하는 "공동의 목표"가 실제로는 없다.

### 결정

1. **`/t/{token}`은 챌린지 전체의 공동 진행 상황을 보여준다.** 뷰어가 누구인지와
   무관하게, 이 챌린지에 참여한 사람들(start-set) 전체를 놓고 대상까지 가는 최단
   경로를 발견했는지 계산한다. "아직 찾는 중"과 "N다리의 길 발견" 두 상태뿐이다.
2. **참여(participation)는 page view가 아니라 명시적 행동이다.** `/t/{token}`을
   열어보는 것만으로는 아무 일도 일어나지 않는다 — "나도 연결 보태기" 버튼을 눌러야
   `challenge_participants`(신규 테이블, `challengeId`+`participantId`
   UNIQUE)에 행이 생긴다. 이미 갖고 있는 confirmed acquaintance/Instagram
   mutual 관계 전체를 그 순간부터 이 챌린지의 시작점으로 써도 된다는 멤버십일
   뿐, 새 edge를 만들지 않는다.
3. **traversal은 여전히 전역 trusted graph 전체를 쓴다.** start-set에 없는 중간
   노드가 이 챌린지에 참여했을 필요는 없다 — 이미 검증된 관계(confirmed
   acquaintance + Instagram mutual, `getAllEdges()`)를 인위적으로 제한하지
   않는다. 챌린지 생성자는 `POST /api/challenges` 트랜잭션 안에서 자동으로 첫
   참여자가 된다.
4. **edge 판정 규칙은 절대 느슨해지지 않는다.** "저 이 사람 알아요" 자기 신고,
   일방적 팔로우만으로 edge 인정, 대상 본인에게 가입/확인을 요구하는 구조는
   추가하지 않는다. 톱 연예인처럼 일반 참여자와 맞팔이 거의 없는 대상은 실제로
   길을 못 찾을 수 있고, 인플루언서·지역 유명인처럼 실제 교류가 있는 대상은 더
   쉽게 발견될 수 있다 — 이 난이도 차이 자체가 챌린지의 재미이지 버그가 아니다.
5. **target을 "연예인"으로 한정하지 않는다.** 제품 카피·데이터 모델 모두 "궁금한
   사람"을 기준으로 하고, 유명인 사전 DB를 두지 않는다. `target_challenges`
   스키마는 이미 이렇게 설계돼 있었다(주석의 "예: 연예인"은 예시일 뿐 제약이
   아니었다) — 이번 결정으로 카피/UX 차원에서도 명시적으로 확정한다.
6. **계산 방식 — target/leaf 쪽에서 BFS, start-set은 조회만.** `bfsDistances`
   (single-source, `packages/graph` 변경 없음)를 target participant(또는
   external leaf 후보, 보통 1~2명) 쪽에서 한 번(또는 후보 수만큼) 돌리고,
   start-set 참여자들의 거리를 조회해 최솟값을 취한다 — 무방향 그래프라 어느
   방향에서 BFS를 돌려도 결과는 같고, target/leaf 쪽 수가 보통 start-set보다
   적으므로 이 방향이 항상 더 싸다. start-set마다 개별 BFS를 돌리는 multi-source
   BFS를 새로 구현하지 않는다.
7. **결과는 저장하지 않고 매 요청마다 재계산한다.** 새 participant가 참여하거나
   새 trusted edge가 생기면 다음 조회부터 자동으로 반영된다(더 짧은 경로가
   나오면 자동 갱신) — 무효화 로직이 필요 없다. 기존 `/api/me/result`,
   `/api/r/{token}/result`와 같은 패턴이다.
8. **공개 결과 화면의 path identity는 전부 익명화한다 — 시작점 포함.** `/r`의
   "뷰어의 direct 상대는 실명" 규칙(`referralPathNodeSchema`)보다 보수적이다 —
   챌린지 결과는 불특정 다수가 보는 공개 공유 surface이기 때문이다. 서버는
   `distance` 정수 하나만 내려준다(`challengeProgressSchema`) — 개별 노드
   id/이름 배열 자체를 클라이언트로 보내지 않는다. 클라이언트(`ChallengePathStrip`)는
   그 숫자만으로 "우리 ─ ○ ─ ○ ─ ○ ─ {target}" 형태를 그린다. 압축 규칙: 중간자
   3명 이하는 전부 개별 원, 4명 이상이면 "시작 직후 1명 + 압축 칩(+N) + target
   직전 1명"만 개별로 남긴다 — target 직전 노드는 경로가 아무리 길어도 압축
   칩에 흡수되지 않는다(경로의 구조 자체는 identity 없이도 드러나야 한다).
9. **"아직 못 찾음"은 실패 화면이 아니다.** 카피는 항상 "아직 찾고 있어요 +
   사람들이 연결을 보태면 새로운 길이 발견될 수도 있어요" 톤을 유지한다 —
   대상에 따라 영영 발견되지 않을 수도 있다는 것을 정상적인 챌린지 상태로
   취급한다.
10. **개인 뷰어 기준 엔드포인트(`POST /api/challenges/{token}/check`,
    `challengeResultSchema`)는 폐기한다.** 설계만 있었고 구현되지 않았다 —
    `challengeProgressSchema`(`status: "searching"|"found"`, `distance`)로
    대체한다.
11. **동일 target으로는 챌린지를 중복 생성하지 않는다(2026-09-15 추가
    결정).** 판정 기준은 `displayName`이 아니라 정규화된 username의
    해시(`target_instagram_username_hash`)다 — `target_challenges`에 이
    컬럼 UNIQUE 제약을 추가했다. 이미 같은 target을 가리키는 챌린지가
    있으면 `POST /api/challenges`가 `status: "duplicate"`(기존 `token`,
    기존 `displayName`)를 돌려준다 — **호출자를 조용히 자동 합류시키지
    않는다.** 클라이언트가 "이미 이 사람을 찾고 있는 챌린지가 있어요"
    화면을 먼저 보여주고, 사용자가 "챌린지에 합류하기"를 명시적으로 눌러야
    `POST /api/challenges/{token}/join`이 호출된다. displayName은 최초
    생성 시점 값을 그대로 유지한다 — 이번에 제출한 값은 버려진다. 이번
    MVP에서는 "새 챌린지 만들기" 대안을 제공하지 않는다 — 같은 target에
    대한 참여가 여러 챌린지로 쪼개지는 것을 원천적으로 막는다.

### 유지하는 원칙

- 원본 ZIP·followers 전체 목록은 서버로 전송하지 않는다.
- 평문 username은 저장하지 않는다.
- 대상의 존재 여부·가입 여부·challenge start-set 참여자 목록은 어떤 응답에도
  노출하지 않는다.
- 사람 검색 디렉터리·자동완성·prefix 검색·challenge 전체 목록 API는 만들지 않는다.
- 타겟 본인 인증(이 계정이 실제로 그 사람 소유인지)은 이번 범위에서 다루지
  않는다 — `displayName`은 검증된 인물명이 아니라는 전제를 유지한다.

### 재검토 조건

- rate limit(`02_API_SPECS.md` §8.6, 챌린지 생성 분당 5회/시간당 30회)은
  구현 완료(`apps/web/lib/rate-limit.ts`, 2026-09-15). 알려진 한계(멀티
  인스턴스 배포 시 인스턴스마다 메모리 분리)는 그대로 남아 있다 — 실제
  배포 환경이 멀티 인스턴스로 확정되거나 대량 스캔이 관찰되면 영속
  카운터로 전환한다.
- 참여 현황("127명이 함께 연결을 보탰어요" 같은 집계) 표시는 여전히 이번
  범위에 없다 — `challenge_participants` 테이블이 이미 존재하므로, 필요해지면
  `SELECT COUNT(*)`만으로 바로 가능하다(추가 스키마 불필요).
- `/invite/{token}`(지인 링크 확인)을 챌린지 맥락에서 열었을 때 원래 챌린지로
  복귀시키는 것은 이번 범위에서 다루지 않는다 — acquaintance link 하나가 여러
  챌린지에서 재사용될 수 있어 토큰 하나에 "어느 챌린지에서 왔는지"를 안전하게
  같이 실어 보낼 표준 자리가 없다(중첩 `returnTo` 검증 규칙이 필요해진다). `/connect`,
  `/upload`는 `returnTo`로 이미 복귀를 지원한다.

### 관련 문서

- [AGENTS.md](../../AGENTS.md) §0, §1 원칙 3 — 이번 결정 반영.
- [01_DB_SCHEMA.md §4.11](../03_Technical_Specs/01_DB_SCHEMA.md) — `challenge_participants` 스키마.
- [02_API_SPECS.md §8](../03_Technical_Specs/02_API_SPECS.md) — 구현된 3개 엔드포인트 계약으로 재작성.

### 관련 구현

- `packages/db/src/schema.ts`의 `challengeParticipants`,
  `packages/db/migrations/0011_oval_invaders.sql`
- `apps/web/lib/challenges.ts`(`joinChallenge`, `getChallengeParticipantIds`,
  생성자 auto-join을 포함한 `createChallenge`)
- `apps/web/lib/graph-service.ts`의 `computeChallengeProgress`
- `apps/web/app/api/challenges/route.ts`, `.../[token]/route.ts`,
  `.../[token]/join/route.ts`
- `packages/shared/src/schemas.ts`의 `challengeProgressSchema`
- `apps/web/app/create/`, `apps/web/app/t/[token]/`,
  `apps/web/components/CreateChallengeScreen.tsx`,
  `apps/web/components/TargetChallengeScreen.tsx`,
  `apps/web/components/ChallengePathStrip.tsx`
- `apps/web/lib/return-to.ts`(`/t/{token}`, `/create` allowlist 추가),
  `apps/web/app/upload/page.tsx`·`InstagramImportFlow.tsx`·`upload/guide/*`
  (`returnTo` passthrough), `apps/web/app/page.tsx`(홈 CTA → `/create`)
- `apps/web/lib/rate-limit.ts`(챌린지 생성 rate limit, §8.6)
- `packages/db/src/schema.ts`의 `targetChallenges.targetHashUnique`,
  `packages/db/migrations/0012_married_slipstream.sql`(UNIQUE 제약 추가)
- `apps/web/lib/challenges.ts`의 `createChallenge`(중복 감지),
  `packages/shared/src/schemas.ts`의 `createChallengeResultSchema`,
  `apps/web/components/CreateChallengeScreen.tsx`(중복 화면)

## 2026-09-15 — 타겟 챌린지 결과 화면: 전체 그래프 대신 "거리 숫자 + 압축 path" 중심 UX (대체됨 — 위 "협업형 챌린지" 항목이 최종 결정)

### 상태

채택. 화면 구조·카피 설계 확정, 구현 전(`/t/{token}` 자체가 아직 코드에
없다 — §8 API 계약도 미구현).

### 문제

`/result`가 이미 참여자 중심 미니 그래프(`MiniConnectionGraph`)를 쓰고
있어서, `/t/{token}`도 같은 방식으로 "전체 그래프"를 보여주고 싶은 유혹이
있다. 하지만 두 화면의 목적이 다르다: `/result`는 "내가 지금 어디서
출발하는지"를 보여주는 자기중심 지도이고, `/t/{token}`은 "이 사람 한
명까지 몇 다리인지"라는 단일 결과를 보여주는 화면이다. 그래프가 커지면
(수십~수백 노드) `/t/{token}`에 전체 그래프를 그리는 건 모바일에서 복잡하고,
"네트워크 분석 서비스"처럼 보이고, 중간 노드가 많아질수록 개인정보 노출
표면도 넓어지고, 무엇보다 챌린지의 핵심("몇 다리인가")이 그래프에 묻힌다.

### 결정

1. **`/t/{token}`은 전체 그래프를 시각화하지 않는다.** 그래프(`getAllEdges()`
   + `packages/graph`)는 서버에서 거리를 "계산"하는 용도로만 쓰고, 클라이언트에는
   ①대상 ②나와 대상 사이의 거리 ③(있다면) 아주 단순화된 path만 내려준다.
   `MiniConnectionGraph`나 그와 유사한 force-layout/전체 노드 시각화를
   `/t/{token}`에 새로 만들지 않는다 — D3·Three.js 등 그래프 라이브러리도
   추가하지 않는다.
2. **"N다리" 숫자가 화면의 시각적 hero다.** 결과 화면에서 가장 크고 먼저
   보이는 요소는 거리 숫자이지 path 그림이 아니다. path는 숫자를 뒷받침하는
   보조 요소로, 화면 아래쪽에 작게 둔다.
3. **path는 필요할 때만, 항상 가로 한 줄로 보여준다.** 세로 확장·zoom/pan·
   가로 스크롤 UI를 만들지 않는다 — 390px 안에 항상 한 줄로 들어와야 한다.
   짧은 경로(중간자 3명 이하)는 전부 그대로 보여준다. 그보다 길면(4명
   이상) 압축한다: **앞 2명 + "+N" 칩(나머지 수) + 마지막 1명**만 개별
   노드로 그리고, 그 사이는 전부 하나의 압축 칩으로 뭉갠다 — 두 끝(나,
   대상)은 절대 압축하지 않는다. 예:
   - 중간자 3명 이하: `나 ─ ○ ─ ● ─ ○ ─ {대상}`(전부 표시)
   - 중간자 4명 이상: `나 ─ ○ ─ ● ─ +N ─ ○ ─ {대상}`(가운데 뭉침)
   기존 `/r`이 쓰는 `ConnectionPath.tsx`(여러 줄로 감싸는 방식)는 건드리지
   않는다 — 이 압축 규칙은 `/t/{token}` 전용 새 컴포넌트로 구현한다(가칭
   `ChallengePathStrip`). 마스킹 규칙은 기존과 동일하게 유지한다: 나=실명,
   대상=챌린지 `displayName`, 뷰어의 direct 상대=실명 가능, 그 외 중간자는
   전부 익명 원(○) — 압축 칩 안에 뭉친 사람들은 애초에 개별 식별자 자체를
   클라이언트로 내려보내지 않는다(추가 익명화 효과).
4. **참여 현황(집계 숫자)은 이번 라운드에 넣지 않는다.** "127명이
   확인했어요" 같은 문구는 매력적이지만, 지금 스키마(`target_challenges`
   단독)로는 계산할 방법이 없다 — 누가 언제 이 챌린지를 확인했는지 기록하는
   행이 어디에도 없다. 존재하지 않는 숫자를 화면에 가짜로 채우지 않는다
   (§ 아래 "스키마/구현 갭" 참고). "현재 발견된 가장 가까운 결과" 같은
   좀 더 민감한 집계는 이번 라운드에 아예 설계하지 않는다 — 특정
   participant의 identity를 간접적으로라도 좁혀낼 수 있는지 별도 검토가
   필요하다.
5. **`/result`와 `/t/{token}`의 시각적 역할을 분리한다.** `/result` =
   "내 연결의 출발점"(기존 미니 그래프 유지, 이번 결정과 무관), `/t` =
   "특정 대상까지의 결과"(그래프 없음, 숫자+압축 path 중심). 하나를 다른
   하나로 재사용하지 않는다.
6. **공유 카드로 확장하기 쉬운 구조를 의식한다.** 결과 화면 자체를 "타겟
   이름 + 큰 거리 숫자 + 짧은 path" 중심으로 만들어두면, 나중에 이미지
   공유 카드를 붙일 때 지금 레이아웃을 거의 그대로 캡처할 수 있다 — 이번
   라운드에 이미지 카드 자체를 만들지는 않는다.

### 화면 구조·카피 (390px 기준, 설계)

**A. 로그인 전 challenge landing** (`/t/{token}`, 미확인 상태 — 홈 랜딩의
"혹시 나도 유명인이랑..." 훅과 같은 패턴, 대상 이름으로 개인화):

```
[로고]
혹시 나도 {displayName}이랑
건너건너 아는 사이일까?

아는 사람을 따라가다 보면
생각보다 가까울지도 몰라요.

[확인해보기]
```
"확인해보기" 클릭 시 미로그인이면 기존 `returnTo` 패턴으로 로그인 →
표시 이름 설정 → `/t/{token}`으로 복귀(ReferralLanding의 대기 확인
패턴과 동일하게 구현 가능 — 새 메커니즘 불필요).

**B. Connected**

```
[로고]
{displayName}까지
{distance-1}다리!          ← distance<=1이면 "이미 바로 아는 사이!"

나 ─ ○ ─ ● ─ +N ─ ○ ─ {displayName}   ← ChallengePathStrip, 필요할 때만 압축

생각보다 가까운데요?

[결과 공유하기]
다른 사람으로 만들어보기 →
```
"결과 공유하기"는 기존 `/r`의 `handleShare`(Web Share API, 실패 시 복사)
패턴 재사용. "다른 사람으로 만들어보기 →"는 `/create`로 이동.

**C. Not connected** (`not_connected` — `not_found`/`unreachable` 내부
구분은 사용자에게 노출하지 않는다, §8.3):

```
[로고]
아직 {displayName}까지
이어지는 길을 찾지 못했어요.

사람들이 각자 아는 사람을 보태면
새로운 길이 발견될 수도 있어요.

[내 연결 더 보태기 →]
이 챌린지 친구에게 보내기 →
```
"내 연결 더 보태기"는 `/result`에 이미 있는 "더 많은 길 만들기" bottom
sheet(아는 사람과 연결하기 / 인스타에서 아는 사람 가져오기)를 그대로
재사용한다 — `/t/{token}` 전용으로 새로 만들지 않는다. 단, 이 화면에서
인스타 가져오기로 들어갔다면 완료 후 `/result`가 아니라 **원래 보던
`/t/{token}`으로 복귀**해야 한다(사용자의 목적이 "업로드"가 아니라
"이 사람까지 몇 다리인지 확인하는 것"이므로) — `/upload`가 이미 갖고
있는 `returnTo` 확장 지점을 그대로 쓰면 된다(§ 아래 "구현 시 참고").
"이 챌린지 친구에게 보내기"는 `/t/{token}` 링크 자체를 공유한다 — 결과
공유(위 B)와는 다른 대상(결과가 아니라 챌린지 자체)이므로 별도 문구로
구분한다.

### 스키마/구현 갭 (지금 가능한 것 vs 추가 구현 필요한 것)

**지금 스키마로 바로 가능**:
- A/B/C 세 화면의 카피·상태 분기 전부 — `challengeResultSchema`의
  `status`/`distance`만으로 충분하다.
- Path 압축 표시 — `computeChallengeResult`가 돌려주는 path 배열 길이로
  클라이언트가 압축 여부를 판단하면 된다(서버가 이미 압축해서 내려줄
  수도 있고, 클라이언트가 배열을 받아 압축해도 된다 — 마스킹은 서버가
  이미 끝낸 상태이므로 어느 쪽이든 개인정보 노출 차이는 없다).

**추가 구현 필요**:
- 참여 현황(예: "127명이 확인했어요")은 `target_challenges` 단독으로는
  계산 불가 — `referral_visits`와 같은 형태의 새 테이블(가칭
  `challenge_checks`: `id`, `challenge_id`, `viewer_participant_id`,
  `status`, `distance`, `checked_at`, `(challenge_id, viewer_participant_id)`
  유니크로 재확인 시 중복 집계 방지)이 필요하다. **이번 라운드에는
  추가하지 않는다** — 필요하다고 확정되면 다음 라운드에서 스키마
  추가와 함께 다시 검토한다.
- "현재 발견된 가장 가까운 결과"는 위 테이블이 있어도 별도로 "노출해도
  되는 집계인가"를 검토해야 한다(예: 참여자가 매우 적은 챌린지에서는
  최솟값 자체가 특정 개인의 결과와 사실상 동일해질 수 있다) — 이번
  라운드에서는 설계하지 않는다.
- `ChallengePathStrip` 컴포넌트, `/upload`의 `returnTo` 파라미터를
  `/t/{token}`까지 받아들이도록 하는 확장(`normalizeReturnTo`의 허용
  목록에 `/t/{token}` 패턴 추가 포함) — 둘 다 코드 미작성.

### 재검토 조건

- 참여 현황을 실제로 넣기로 결정하면, `challenge_checks` 테이블 추가와
  함께 이 항목을 갱신한다.
- path 압축 임계값(중간자 3명)이 실사용에서 너무 이르다/늦다는 피드백이
  쌓이면 숫자만 조정한다 — 압축 방식 자체(앞 2명 + 칩 + 뒤 1명)는
  유지한다.

### 관련 문서

- [02_API_SPECS.md §8](../03_Technical_Specs/02_API_SPECS.md#8-path-check-타겟-챌린지--username을-정확히-아는-경우에만-거리-확인-설계-확정-미구현) —
  API 계약(이 문서가 다루는 화면이 소비하는 데이터).
- [01_DB_SCHEMA.md §4.9](../03_Technical_Specs/01_DB_SCHEMA.md#49-타겟-챌린지-target_challenges--2026-09-14) —
  `target_challenges` 스키마.

### 관련 구현

없음 — `/t/{token}` 라우트·컴포넌트·`ChallengePathStrip` 전부 미작성.

## 2026-09-14 — Path Check를 공유형 "타겟 챌린지"로 확장 (아래 항목을 대체)

### 상태

채택. 바로 아래 "Instagram username Path Check" 항목(개인용, 비공유)을
대체한다 — 그 항목은 같은 날 먼저 검토됐지만 제품 방향과 맞지 않아
구현되지 않았고, 이 항목이 최종 결정이다. 문서·API 계약 설계까지 완료,
구현 전.

### 문제

바로 아래 항목의 "개인용 Path Check만 허용"(공유 링크 없음, 결과를 본인만
봄) 설계는 "범용 검색 API를 만들지 않는다"는 원칙과의 충돌은 피했지만,
제품이 실제로 원하는 바이럴 구조("내가 궁금한 사람 하나를 정해서, 그
사람까지 몇 다리인지 여러 사람이 같이 확인해보는 챌린지")를 만들 수 없다.
개인용 조회로는 한 사람이 확인하고 끝나고, 공유·재확인·다음 챌린지로
이어지는 루프가 없다.

### 결정

1. **"정확한 username 직접 입력"이라는 경계는 그대로 유지한다.** 로그인
   사용자가 이미 알고 있는 Instagram username을 직접 타이핑해서 넣는
   것만 입력으로 받는다 — 검색창도, 자동완성도, 추천 목록도 없다. 서버는
   받는 즉시 정규화 후 `hashInstagramUsername()`으로 해싱하고, 원문은
   요청 처리 도중에만 살아 있다가 버려진다(로그·DB·analytics 어디에도
   남기지 않는다).
2. **그 입력을 "1회성 개인 조회"가 아니라 "재사용 가능한 challenge
   resource"로 만든다.** 사용자가 `displayName`(챌린지에 보여줄, 검증되지
   않은 표시 이름)과 함께 타겟을 지정하면, 서버는 그 타겟의 해시를
   `target_challenges` 행 하나로 저장하고 예측 불가능한 opaque token을
   발급한다. 이후 누구든 `/t/{token}`으로 들어와 "자기 기준"으로 같은
   타겟까지의 Path Check를 반복할 수 있다 — 매번 새로 만들 필요 없이
   토큰 하나를 여러 명이 공유해서 쓴다.
3. **이것은 범용 계정 검색 API가 아니다 — 여전히 금지하는 것.** 사람/계정을
   찾아내는 디렉터리, 자동완성, prefix 검색, 전체·인기 계정 목록, "이
   계정이 존재하는지/가입했는지" 자체를 알려주는 조회, challenge 목록·전체
   탐색 API. `/t/{token}`은 token을 이미 아는 사람만 여는 리소스이지,
   token 없이 아무 계정이나 찾아보는 진입점이 아니다.
4. **존재 여부·가입 여부는 여전히 노출하지 않는다.** `/t/{token}`이
   공개적으로 보여주는 건 챌린지 작성자가 입력한 `displayName`과 그 챌린지
   고유 카피뿐이다 — 대상의 Instagram username 원문, 대상이 실제 참여자인지
   (`participants.instagramUsernameHash` 매칭) 아니면 아직 참여 전인 맞팔
   상대(`follows` leaf)일 뿐인지는 어떤 응답에도 구분해서 내보내지 않는다.
   Path Check 결과도 바로 아래 항목과 동일하게 `connected`(거리 포함)/
   `not_connected`(그 외 전부) 두 상태로만 합친다.
5. **`displayName`은 검증된 인물명이 아니다.** Instagram API·profile
   scraping으로 이름을 자동으로 가져오거나 검증하지 않는다 — 챌린지를 만든
   사람이 붙인 표시 이름일 뿐이라는 걸 UI 카피에서도 분명히 한다.
6. **재사용 가능한 challenge라서 생기는 새 남용 경로(반복 생성으로 스캔)를
   막는다.** challenge "생성"이 곧 "이 username에 대해 조회를 하나
   연다"는 뜻이므로, 개인용 설계 때보다 오히려 이 경로를 더 신경 써야 한다
   — 한 계정이 서로 다른 username으로 challenge를 빠르게 반복 생성하면
   사실상 무제한 조회 오라클이 된다. `creatorParticipantId` 기준 rate
   limit(분당/시간당 상한)을 challenge 생성에 건다 — 상세는
   `02_API_SPECS.md` §8.6.
7. **`target_challenges` 테이블을 새로 만든다.** 바로 아래 항목의 "새 테이블
   금지, 인덱스 1개만" 제약은 이 결정으로 폐기한다 — 공유 가능한 challenge
   resource 자체가 요구사항이므로 상태를 어딘가에 저장해야 한다. 저장 필드는
   `id`, `token`, `displayName`, `targetInstagramUsernameHash`,
   `creatorParticipantId`, `createdAt`뿐이다 — Instagram username 원문은
   저장하지 않는다. `follows.followee_identity_hash` 단일 컬럼 인덱스(§4.8)는
   이 결정에서도 그대로 필요하다.

### 재검토 조건

- challenge 생성 rate limit에도 불구하고 실제 스캔 시도가 관찰되면, 더 낮은
  한도나 영속 저장소 기반 카운터로 전환한다.
- "존재 여부를 구분 안 함"이 실제 사용자에게 혼란을 준다는 피드백이 쌓이면
  (예: 오타로 인한 not_connected와 진짜 안 이어진 not_connected를 구분하고
  싶어함), 클라이언트 사이드 형식 검증만 강화하고 서버 응답 구분은
  유지한다(바로 아래 항목과 동일).

### 유지하는 원칙

- 범용 사람 검색(디렉터리, 자동완성, prefix 검색, 전체/인기 계정 목록,
  challenge 전체 목록)은 여전히 금지한다.
- 두 사람 사이의 경로가 아니라 거리만(그것도 `connected`/`not_connected`
  상태로만) 반환한다.
- 평문 username은 저장하지 않는다.
- 대상의 참여자 여부·가입 여부는 어떤 응답에도 노출하지 않는다.

### 관련 문서

- [AGENTS.md](../../AGENTS.md) §1 원칙 3 — "정확한 username 직접 입력 → HMAC
  → 본인 경로 확인 또는 opaque challenge 생성" 허용, 계정 탐색·존재 확인은
  금지로 재작성.
- [개발 원칙](../03_Technical_Specs/00_DEVELOPMENT_PRINCIPLES.md) §3 원칙 3 —
  동일 개정.
- [01_DB_SCHEMA.md](../03_Technical_Specs/01_DB_SCHEMA.md) §4.8 — `target_challenges`
  테이블 설계 추가.
- [02_API_SPECS.md](../03_Technical_Specs/02_API_SPECS.md) §8 — challenge 생성/
  조회/Path Check 3개 엔드포인트로 계약 재작성.

### 관련 구현

없음 — 이번 라운드도 설계까지만 진행한다(`target_challenges` 스키마와
마이그레이션은 미리 만들어 적용해뒀다 — 데이터는 없는 빈 테이블).

## 2026-09-14 — Instagram username Path Check: 범용 검색 금지 원칙에 좁은 예외를 추가 (대체됨)

### 상태

**대체됨 — 위 "Path Check를 공유형 '타겟 챌린지'로 확장" 항목이 최종
결정이다.** 아래 내용은 그 결정에 이르기까지의 중간 검토 기록으로 남겨둔다.

### 문제

이전 턴에서 검토한 "on-demand Instagram username 검색" 설계는 기존 "검색
가능한 범용 조회 API를 만들지 않는다"는 원칙(`AGENTS.md` §1 원칙 3,
`00_DEVELOPMENT_PRINCIPLES.md` §3 원칙 3)과 정면으로 충돌한다고 지적됐다.
이 충돌을 해소하지 않고는 구현에 들어갈 수 없었다.

### 결정

1. **기능 범위를 "탐색"이 아니라 "Path Check"로 한정한다.** 사용자가 정확히
   알고 있는 Instagram username을 직접 입력해 "나와 이 계정 사이에 이어지는
   길이 있는가"만 확인하는 기능으로 좁힌다. 사람/계정을 찾아내는 디렉터리,
   자동완성, prefix 검색, 전체 계정 목록, 인기 계정 목록은 이 예외에 포함되지
   않으며 여전히 금지한다.
2. **원칙 3에 좁은 예외를 추가한다.** "검색 가능한 범용 조회 API를 만들지
   않는다"는 원칙은 유지하되, "로그인 사용자가 정확한 username을 직접 입력 →
   해싱 → 기존 그래프·`follows` 데이터로 거리만 계산" 형태의 단일 목적
   엔드포인트 1개는 예외로 허용한다.
3. **성공 여부만 노출하고, 존재 여부는 노출하지 않는다.** 서버 내부적으로는
   "그래프에 아예 없음"과 "그래프에는 있지만 도달 불가"를 구분해 계산해도,
   사용자 응답은 `connected`(거리 있음)와 `not_connected`(그 외 전부, 사유
   불문) 두 상태로만 합친다. 대상이 가입자인지 Instagram 맞팔로만 존재하는
   leaf인지도 응답에서 구분하지 않는다 — "이 계정이 가이 알아? 어딘가에
   존재한다"는 사실 자체가 노출되지 않게 하기 위함이다.
4. **로그인 필수, 원문 미저장.** 검색은 세션 있는 참여자만 호출할 수 있고,
   입력한 username 원문은 DB·analytics·application log·에러 트래킹
   breadcrumb 어디에도 남기지 않는다 — 요청 처리 중 메모리에서만 쓰고 즉시
   `hashInstagramUsername()`으로 변환한다.
5. **DB 변경은 인덱스 1개로 제한한다.** 새 external account 테이블을 만들지
   않는다. `follows.followee_identity_hash` 단일 컬럼 인덱스만 추가한다 —
   구체적인 계약은 `02_API_SPECS.md` §8, 인덱스는 `01_DB_SCHEMA.md` §4.8 참고.

### 재검토 조건

- 대량 스캔 시도가 실제로 관찰되면 rate limit을 in-memory에서 영속 저장소
  기반으로 전환하는 걸 재검토한다(`02_API_SPECS.md` §8.6).
- "not_connected로 뭉뚱그리는" 응답이 실제 UX에서 혼란을 준다는 피드백이
  쌓이면(예: 사용자가 "오타인지 진짜 안 이어진 건지" 반복 재입력을 한다면),
  오타 여부만 별도로 클라이언트 사이드 형식 검증으로 줄이는 걸 검토한다 —
  서버 응답 구분은 여전히 유지한다.

### 유지하는 원칙

- 범용 사람 검색(디렉터리, 자동완성, prefix 검색, 전체/인기 계정 목록)은
  여전히 금지한다 — 이번 예외는 "정확한 단일 username 직접 입력"에만
  한정된다.
- 두 사람 사이의 경로가 아니라 거리만(그것도 `connected`/`not_connected`
  상태로만) 반환한다.
- 평문 username은 저장하지 않는다.

### 관련 문서

- [AGENTS.md](../../AGENTS.md) §1 원칙 3 — 이번 결정에 맞춰 개정.
- [개발 원칙](../03_Technical_Specs/00_DEVELOPMENT_PRINCIPLES.md) §3 원칙 3 — 동일 개정.
- [01_DB_SCHEMA.md](../03_Technical_Specs/01_DB_SCHEMA.md) — §4.8 인덱스 설계
  추가, §1/§3/§4를 2026-09-14 시점 실제 스키마에 맞춰 재작성.
- [02_API_SPECS.md](../03_Technical_Specs/02_API_SPECS.md) §8 — Path Check
  API contract 신설.

### 관련 구현

없음 — 이번 라운드는 설계까지만 진행한다.

## 2026-09-14 — Instagram 맞팔을 지인 확인과 함께 shortest-path edge 소스로 재도입

### 상태

채택, 구현 완료. `POST /api/instagram-import`, `follows` 테이블 재정의, `getAllEdges()`의
두 source 통합까지 이미 배포돼 있다. 이 항목은 코드보다 뒤늦게 문서를 맞추는
결정이다 — `AGENTS.md`는 이미 이 내용을 반영해 작성돼 있었지만, 이 결정 로그와
`00_DEVELOPMENT_PRINCIPLES.md`는 2026-09-13 시점 그대로였다.

### 문제

2026-09-13 결정의 "재검토 조건"은 "Instagram 연동을 다시 붙일 경우 연결 후보를 찾는
보조 수단으로만 쓰고, 맞팔 기반 edge와 지인 확인 기반 edge를 하나의 그래프에 섞지
않는다"고 명시했다. 그런데 지인 링크 확인만으로는 그래프 밀도가 자라는 속도가 느려
"몰랐는데 연결돼 있었네"를 첫 방문에서 체감시키기 어려웠고, 이미 Instagram 맞팔이라는
객관적 사실로 아는 사이임이 확인되는 관계까지 매번 별도로 지인 링크를 주고받게 하는
것은 불필요한 마찰이라고 판단했다.

### 결정

1. **두 edge source를 하나의 그래프에서 함께 쓴다.** `acquaintance_confirmations`
   (지인 링크 확인)와 `follows`(Instagram 맞팔, 상대도 실제 참여자로 확인된 경우만)
   둘 다 shortest-path 계산에 포함한다. 2026-09-13 "재검토 조건"의 "섞지 않는다"
   조항은 이 결정으로 **폐기·대체**한다.
2. **Instagram mutual은 followers ∩ following 교집합으로만 생성한다.** 일방적
   팔로우/팔로잉은 edge 후보에도 포함하지 않는다 — `packages/ig-parser`의
   `computeMutuals`가 브라우저에서 이 교집합만 계산해 서버로 넘긴다.
3. **두 source 사이에 신뢰 수준 구분을 두지 않는다.** MVP 규모에서는 둘 다 "실제로
   아는 사이"라는 사실을 나타낸다고 보고, BFS/거리 계산에서 가중치나 우선순위를
   두지 않는다(`apps/web/lib/participants.ts`의 `getAllEdges()`가 `UNION`으로 합침).
4. **거리·경로 비노출 원칙은 그대로 유지한다.** edge source가 늘어난 것과 무관하게,
   두 사람 사이의 거리만 반환하고 중간 연결자는 노출하지 않는다(`AGENTS.md` §1 원칙 4).

### 재검토 조건

- 허위/광고성 맞팔이나 스팸성 계정이 실제 문제로 관찰되면, instagram_mutual을 다시
  "후보 발견 전용"으로 낮추는 걸 재검토한다.
- 두 source의 신뢰 수준이 실제로 다르다는 사용자 피드백이 쌓이면(예: "이 사람과는
  진짜 아는 사이가 아닌데 연결로 나온다"), edge에 source 구분 필드를 추가해 별도
  가중치를 주는 걸 검토한다.

### 유지하는 원칙

- 원본 데이터(ZIP, followers 전체 목록)는 서버로 전송하지 않는다.
- 평문 username은 저장하지 않는다 — 해시만 저장한다.
- 두 사람 사이의 경로가 아니라 거리만 반환한다.

### 관련 문서

- [AGENTS.md](../../AGENTS.md) §0, §1 원칙 5 — 이미 이 결정을 반영해 작성돼 있었다
  (문서가 코드를 따라가지 못한 게 아니라, 이 결정 로그가 `AGENTS.md`를 따라가지
  못하고 있었다).
- [개발 원칙](../03_Technical_Specs/00_DEVELOPMENT_PRINCIPLES.md) §3 원칙 5 — 이번
  결정에 맞춰 개정.
- [01_DB_SCHEMA.md](../03_Technical_Specs/01_DB_SCHEMA.md) §3-4 — `follows`를
  "비활성 보존"으로, `pair_invites`를 활성 edge 소스로 설명하는 부분이 현재 스키마
  (`packages/db/src/schema.ts`)와 맞지 않는다. 이번 결정과 별개로 스키마 실제
  상태에 맞춘 재작성이 필요하다(범위가 커서 이번 갱신에는 포함하지 않음).

### 관련 구현

- `apps/web/lib/participants.ts`의 `getAllEdges()`
- `apps/web/app/api/instagram-import/route.ts`
- `packages/ig-parser`(`computeMutuals`)
- `packages/db/src/schema.ts`의 `follows` 재정의

## 2026-09-13 — Instagram 기반 맞팔 그래프를 지인 확인 기반 그래프로 전환

### 상태

채택. 지인 링크 accept가 edge를 만드는 최소 슬라이스는 구현됐다. 소셜 로그인,
표시 이름, 재사용 지인 링크를 포함한 전체 여정은 구현 전이다.

### 문제

Instagram 내보내기 대기(2026-09-12 결정으로 완화했음에도 최소 몇 분~며칠)가 여전히
첫 경험의 진입장벽이었고, 참여자가 아무도 없는 상태에서는 그래프가 비어 있어 핵심
재미("몰랐는데 연결돼 있네")를 첫 방문에서 보여줄 수 없었다. 대안으로 검토한 "휴대폰
주소록 업로드"는 개인정보보호법상 제3자(주소록 속 타인) 전화번호를 동의 없이 서버로
전송하는 문제가 있어 기각했다 — 전화번호처럼 값 공간이 좁은 입력은 단순 해시만으로는
가명처리로 충분하지 않다.

### 결정

1. **관계의 정의를 바꾼다.** "서로 신고한 Instagram 맞팔"이 아니라 "지인 전용 초대
   링크를 통해 상대가 직접 확인한 관계"만 그래프의 edge로 인정한다. Instagram 팔로우
   데이터는 MVP 범위에서 제외한다(완전 폐기가 아니라 후순위로 미룸).
2. **링크를 두 종류로 분리한다.**
   - 지인 링크(생성): 한 사람이 만든 링크를 실제 지인 여러 명에게 재사용해서 보낸다.
     링크를 받은 사람이 "실제로 아는 사이인가요?"에 응답하면 두 참여자 사이에 edge가
     생긴다. 확인된 관계는 현재의 친밀도가 아니라 서로 아는 사이였다는 사실을
     나타낸다. MVP에서는 개별 관계 해제 기능을 제공하지 않는다. 계정 삭제와 허위
     연결 대응은 관계 해제 기능과 구분한다.
     후속 결정으로 확인 가능 인원 상한과 만료 기간은 제거했다. 링크는 계속 재사용하며,
     필요할 때 소유자가 폐기할 수 있는 구조만 유지한다.
   - 공개(탐색) 링크: 몇 번을, 몇 명이 방문해도 edge를 만들지 않는다. 이미 존재하는
     그래프에서 두 사람 사이의 최단 거리만 조회한다.
3. **중간 연결자는 여전히 비공개다.** 결과에는 거리(다리 수)만 보여주고, 경로 위의
   사람은 이름은커녕 존재 자체도 숫자(점 개수)로만 표현한다.
4. **콜드 스타트는 "완전히 풀어야 할 문제"가 아니라 "그래프가 자랄 때까지 사용자를
   붙잡는 설계"로 다룬다.** 전 국민 대상으로 시작하지 않고, 서로 관계가 겹칠 가능성이
   높은 단일 커뮤니티(동아리·직장·학교 등)에서 먼저 밀도를 만든다. 연결을 못 찾은
   방문자에게는 실패 화면 대신 "아직 닿지 않았어요 + 내 인맥 시작하기"를 보여줘
   실패한 방문자를 그래프 구축자로 전환한다.
5. **재방문 동기는 그래프 그림이 아니라 숫자다.** "1다리 4명 · 2다리 11명 · 3다리
   22명"처럼 도달 범위 숫자를 성장시켜 재방문 이유를 만든다. LinkedIn류 네트워크
   그래프처럼 보이면 안 되며, 1촌 몇 명만 캐릭터(감귤)로 보여주고 나머지는 숫자로
   압축한다.
6. **포지셔닝을 "인맥관리 서비스"가 아니라 "세상이 좁은지 확인하는 인터넷 실험"으로
   못박는다.** 화면 문구에서 "인맥", "네트워크"류 어휘를 피하고 "발견", "연결됐어요",
   "세상 진짜 좁다" 같은 실험/발견형 어휘를 쓴다. 결과 공유 카드를 서비스 화면과
   동시에 설계한다 — 사람들이 처음 만나는 화면은 홈이 아니라 커뮤니티에 돌아다니는
   결과 공유 이미지일 가능성이 높기 때문이다.
7. **동일 사용자를 하나의 그래프 노드로 식별한다.** 로그인은 카카오만 제공한다 —
   카카오는 사실상 한국에서만 쓰여서, 로그인 수단을 이것 하나로 좁히는 것 자체가
   콜드 스타트 전략(전 세계가 아니라 한 국가·커뮤니티에서 먼저 밀도를 만드는 것)과
   맞고, OAuth 연동을 하나만 구현하면 되는 이점도 있다. 로그인 제공자의 고유 계정
   ID를 내부 participant에 연결한다. 해외 확장이 실제로 필요해지면 그때 Google 등
   다른 제공자를 추가로 검토한다(재검토 조건 참고).
8. **표시 이름과 로그인 식별자를 분리한다.** 사용자가 직접 정한 이름 또는 닉네임은
   직접 연결된 사람과 본인 화면, 사용자가 만든 공개 링크에서만 보여준다. 로그인 계정
   ID, 이메일, 전화번호는 화면·검색·그래프 결과에 노출하지 않는다.
9. **위치와 전체 그래프 시각화는 후순위로 미룬다.** 첫 MVP에서는 edge 생성과 거리
   발견의 반복만 검증하며 도시 등 위치 데이터를 수집하지 않는다.

### 첫 검증 목표

`가입자 수`가 아니라 **"모르는 두 사람 사이의 첫 3촌(또는 그 이상) 연결 발견"**을
성공 기준으로 삼는다. 5~10명 규모로, 모두가 서로 아는 하나의 무리가 아니라 일부만
겹치는 두세 무리로 시작하고, 최소 하나의 교차 연결은 실제 지인 관계로 의도적으로
확보해 표본 부족으로 우연히 다리가 하나도 안 생기는 상황을 피한다. 관찰 기준은 세 가지다.

- 설명 없이 초대 링크 열기 → 확인이 끝나는가.
- 직접 아는 친구를 연결한 뒤, 다른 사람과의 거리가 궁금해지는가.
- 결과를 보고 진행자 요청 없이 스스로 다음 사람을 데려오려 하는가.

### 재검토 조건

- 서비스 규모가 커지거나 가짜 연결이 실제 문제로 관찰되면, 지인 링크의 "한쪽 확인"을
  "양쪽 확인"으로 강화하는 것을 재검토한다.
- Instagram 연동을 다시 붙일 경우, "연결 후보를 찾는 보조 수단"으로만 쓰고 edge
  확정 기준은 지인 링크 확인 방식으로 통일한다 — 맞팔 기반 edge와 지인 확인 기반
  edge를 하나의 그래프에 섞지 않는다.
- 관찰 기준 중 "친구는 추가하지만 다른 사람과의 거리는 궁금해하지 않는다"가
  관찰되면, 온보딩이 아니라 핵심 재미 가설 자체가 아직 검증되지 않은 것으로 판단한다.
- 해외 사용자 확보가 실제 목표가 되는 시점이 오면, 로그인 제공자를 카카오 외에도
  확장하는 것을 재검토한다. 그 전까지는 카카오 단일 제공자를 유지해 베타가 저절로
  한국 인구로 좁혀지는 효과를 활용한다.

### 유지하는 원칙

- 원본 개인정보(연락처, Instagram ZIP 등)를 대량으로 서버에 올리는 방식은 쓰지 않는다.
- 검색 가능한 범용 조회 API를 만들지 않는다.
- 두 사람 사이의 경로가 아니라 거리만 반환한다.

### 관련 문서

- [AGENTS.md](../../AGENTS.md) §1 원칙 5 (이번 결정에 맞춰 개정)
- [개발 원칙](../03_Technical_Specs/00_DEVELOPMENT_PRINCIPLES.md) §3 원칙 5 (동일 개정)
- [초대/탐색 그래프 화면 개념](../02_UI_Screens/02_INVITE_GRAPH_CONCEPT.md)

### 관련 구현

- 지인 링크 accept 기반 edge 생성 최소 슬라이스 구현 완료.
- 카카오 로그인, 표시 이름, 재사용 지인 링크는 구현 전.

## 2026-09-12 — Instagram 데이터 가져오기를 기대 형성 뒤로 이동

### 상태

채택, 구현 완료. 실제 사용자 퍼널 검증 전.

### 문제

서비스의 핵심 재미는 초대한 사람과 몇 다리로 연결되는지 바로 확인하는 데 있다. 기존
흐름은 그 기대를 충분히 보여주기 전에 Instagram 데이터 ZIP을 요구했다.

```text
기존: 설명 → Instagram 데이터 요청 → 대기 → ZIP 찾기 → 업로드
변경: 초대와 연결 예시 → 내 연결 알아보기 → 받은 파일 선택 → 결과
```

Instagram 아이디만으로 일반 사용자의 전체 팔로워·팔로잉 목록을 안정적으로 가져올 수
있는 공식 API는 전제로 삼지 않는다. 비공식 스크래핑도 제품 기반으로 사용하지 않는다.
정확한 participant-only 그래프를 유지하려면 참여자가 제공한 following 데이터가 여전히
필요하다.

### 결정

1. ZIP 업로드는 유지하되 첫 화면에서 `ZIP 파일 업로드`라고 부르지 않는다.
2. 초대 화면에서는 초대한 사람과 몇 다리인지 궁금하게 만드는 예시를 먼저 보여준다.
   예시는 실제 결과가 아니라는 점을 명시하고 중간 참여자의 이름은 결과로 공개하지 않는다.
3. 사용자가 `내 연결 알아보기`를 누른 뒤 `인스타 데이터 가져오기`와 파일 선택 UI를
   보여준다. 파일은 압축을 풀지 않고 그대로 선택하게 한다.
4. `어디서 받나요?`를 누르면 같은 화면 안에 4단계 안내를 펼친다. 파일 선택 상태와
   초대 맥락을 잃지 않게 한다.
5. 공식 Accounts Center의 [정보 다운로드 화면](https://accountscenter.instagram.com/info_and_permissions/dyi?source=external&account_type=1&format=JSON&date_range=ALL_TIME)을
   새 창으로 연다. Google 검색 중간 URL은 목적지가 불투명하고 만료될 수 있어 제품 링크로
   저장하지 않는다. Instagram 계정, JSON, 전체 기간을 딥링크 파라미터로 미리 지정한다.
   Meta가 화면 구조나 URL을 바꿀 경우에 대비해 수동 안내도 유지한다.
6. 진행 중인 경로만 브라우저에 최대 7일 저장해 같은 브라우저에서 이어갈 수 있게 한다.
   ZIP, Instagram 아이디, 초대 토큰을 GA 이벤트 속성으로 보내지 않으며 파일 자체도
   브라우저 저장소에 저장하지 않는다.
7. 내보내기 링크를 연 뒤 별도 대기 화면을 만들지 않는다. 파일 생성과 완료 알림은
   Instagram이 담당하므로, 가이 알아?는 바로 ZIP 선택 화면을 보여주고 재방문 시 원래
   초대 맥락으로 돌아간다. iPhone과 Android에서는 각 운영체제의 기본 다운로드 폴더
   위치를 안내한다.
8. 준비 완료 알림만으로 ZIP이 기기에 저장되지는 않는다. 사용자는 Accounts Center에
   다시 들어가 준비된 내보내기를 내려받아야 하므로, 파일 선택 화면에
   `인스타에서 준비된 파일 받기` 링크를 항상 제공한다.
9. 복귀 UI 상태와 퍼널 측정 상태를 분리한다. `fileStepOpenedAt`은 파일 선택 단계 복귀에,
   `exportOpenedAt`은 실제 Accounts Center 링크를 연 뒤 경과 시간 측정에만 사용한다.
10. 독립 가이드 방문만으로는 복귀 상태를 만들지 않는다. 방문 시각은 페이지 메모리에만
    유지하고, 사용자가 Instagram 열기나 파일 선택을 실행했을 때 진행 상태와 함께 저장한다.

### 측정할 퍼널

```text
start_click
→ download_guide_open
→ instagram_export_open
→ instagram_export_reopen
→ import_resume_click
→ file_selected
→ upload_success
→ referral_link_create
→ invite_upload_success
```

`source`는 `direct`, `referral`, `pair`로 구분한다. `file_selected`에는 파일 형식이
유효한지, 내보내기 화면 및 가이드를 연 뒤 경과한 초만 기록한다. Instagram export는 준비에 여러 방문이
걸릴 수 있으므로 같은 세션 전환율만으로 판단하지 않는다.

### 성공 기준과 다음 결정

- `start_click → file_selected`에서 큰 이탈이 생기면 파일 선택 UI보다 Instagram export
  자체가 핵심 진입장벽이라고 판단한다.
- `file_selected → upload_success`에서 큰 이탈이 생기면 export 형식 변화, ZIP 파서 오류,
  계정 추론 UX를 먼저 고친다.
- 초대 유입의 `invite_upload_success`가 계속 낮으면 ZIP을 선택 기능으로 내리고 양쪽
  사용자가 관계를 독립적으로 확인하는 `self-confirmed edge` 실험을 검토한다.
- 수동 확인 edge를 도입하더라도 자동 검증된 관계와 동일한 신뢰도로 표시하지 않는다.
- 업로드 전 공유 링크 생성은 참여자 식별과 링크 소유권을 새로 설계해야 하므로 현재
  구현에 포함하지 않는다. 대기 구간 이탈이 크면 익명 임시 링크 방식으로 별도 실험한다.

### 유지하는 데이터 원칙

- 브라우저는 ZIP 전체에서 following 데이터만 찾아 읽는다.
- 원본 ZIP과 followers 데이터는 서버에 보내거나 저장하지 않는다.
- 참여자끼리 서로의 following에 포함된 경우에만 맞팔 edge를 만든다.
- 사용자에게 중간 연결자나 실제 경로를 공개하지 않고 거리만 보여준다.

### 관련 구현

- `apps/web/components/ImportOnboarding.tsx`
- `apps/web/components/UploadFlow.tsx`
- `apps/web/lib/import-progress.ts`
- `apps/web/lib/analytics.ts`
- `apps/web/test/README.md`
