# Backlog
> Created: 2026-09-13 00:00
> Last Updated: 2026-09-13 00:00

## TASK-012 — `/challenges` 목록 UI 정리 + 공개 요청 문의 도입
- Work Type: code
- 요청 배경(사용자 지정): "챌린지 항상 공개"를 요청했으나, 일반인 대상
  챌린지를 무조건 공개 목록에 올리는 건 AGENTS.md §1 원칙 3(사람을 찾아내는
  디렉터리 금지)과 정면 충돌해 Coordinator가 반려했다. 대신 사용자가 절충안을
  제시: 공개를 원하면 운영자에게 문의하도록 안내한다. 별도로 목록 가독성
  개선(글씨 크기, 대상 이름 말줄임)과 목록이 길어질 때의 "더보기"도 요청했다.
- Scope:
  - `/challenges` "더보기": 새 API 라우트 없이 `?limit=N` 쿼리로 서버
    컴포넌트를 다시 렌더링하는 방식(무한스크롤 아님, 클릭으로만 증가).
  - 목록 행 글씨 크기 축소, 대상 이름이 길면 `...`로 말줄임(상세 페이지
    `/t/{token}`에서는 전체 이름 그대로 보임 — 그 화면은 원래 안 잘랐다).
  - `/t/{token}`에 "공개 목록에 올리고 싶으면 문의하기" mailto 링크를
    **챌린지를 만든 사람에게만** 보여준다(다른 참여자가 남의 챌린지 공개를
    대신 요청하는 통로를 만들지 않기 위해). 실제 공개 전환은 여전히 운영자가
    `is_public`을 직접 SQL로 켜는 수동 검토로만 이뤄진다 — 자동 공개 경로는
    추가하지 않았다.
- Implementation Preconditions:
  - `packages/shared/src/schemas.ts`의 `challengePublicInfoSchema`에
    `viewerIsCreator: boolean`만 추가한다 — 다른 뷰어에게 만든 사람의
    신원을 노출하지 않는다.
  - `apps/web/app/api/challenges/[token]/route.ts`가 세션 participantId와
    `challenge.creatorParticipantId`를 비교해 `viewerIsCreator`를 계산한다.
  - `apps/web/components/PublicChallengeList.tsx`가 `limit+1`행을 조회해
    "더보기" 필요 여부만 판단하고 실제로는 `limit`개만 렌더링한다.
  - `apps/web/app/challenges/page.tsx`의 `limit` 쿼리는 페이지 크기(12)의
    배수로 클램프한다(임의로 큰 값을 넣어 한 번에 긁어가는 것 방지).
  - `RequestPublicListing`(`TargetChallengeScreen.tsx`)은 `viewerIsCreator`가
    false면 아무것도 렌더링하지 않는다.
- Context Receipt:
  - Status: PASS
  - Required References Read: Coordinator가 `apps/web/app/challenges/page.tsx`,
    `apps/web/components/PublicChallengeList.tsx`,
    `apps/web/components/TargetChallengeScreen.tsx`,
    `apps/web/app/api/challenges/[token]/route.ts`,
    `apps/web/lib/challenges.ts`(`listPublicChallenges`/`ChallengeDetail`),
    `packages/shared/src/schemas.ts`, `apps/web/app/me/page.tsx`(공유 컴포넌트
    영향 확인), `apps/web/app/privacy/page.tsx`(기존 mailto 패턴)를 직접
    읽었다(2026-09-19). 백로그 항목 자체는 이 작업 직후 추가.
  - Constraints: `AGENTS.md` §1 원칙 3(디렉터리·무한스크롤·목록 API 금지).
    "이 목록을 내보내는 공개 API 라우트도 만들지 않는다"(2026-09-15 결정).
  - Conflicts: "항상 공개" 요청 자체가 원칙과 충돌 → Coordinator가 반려하고
    사용자가 문의 기반 절충안으로 대체. 그 외 충돌 없음.
- Acceptance Criteria:
  - `/challenges?limit=N`으로 서버 컴포넌트가 다시 렌더링되고, 더 있으면
    "더보기" 링크가 다음 배수로 이동한다. 새 API 라우트가 생기지 않는다.
  - 목록 행 글씨가 이전보다 작고, 이름이 길면 `...`로 잘린다.
  - `/t/{token}`에서 만든 사람에게만 "공개 목록에 올리고 싶다면 문의하기"
    mailto 링크가 보인다(비로그인/타인 조회 시 확인 — 브라우저로 실제 확인).
  - `pnpm typecheck` PASS.
- Document Sync Check: 별도 결정 로그 항목은 만들지 않는다 — "공개 기본값
  false" 원칙 자체는 바뀌지 않았고, 이번 변경은 그 원칙 위에 문의 도입선을
  하나 얹은 것뿐이라 기존 2026-09-15/09-19 항목의 취지를 벗어나지 않는다.
- Change Receipt:
  - Files Changed: `packages/shared/src/schemas.ts`,
    `apps/web/app/api/challenges/[token]/route.ts`,
    `apps/web/components/TargetChallengeScreen.tsx`,
    `apps/web/components/PublicChallengeList.tsx`,
    `apps/web/app/challenges/page.tsx`, `apps/web/app/globals.css`.
  - Requirements Covered: 위 Acceptance Criteria 전체.
  - Excluded Scope: "챌린지 항상 공개"(반려), `/me` 페이지 자체 로직 변경
    없음(공유 CSS/컴포넌트 영향만 받음), 새 API 라우트, 무한스크롤.
  - Basic Checks: `pnpm typecheck`(워크스페이스 전체) - PASS.
  - Remaining Risks: 현재 운영 DB에 공개 챌린지가 3건뿐이라 "더보기"가
    실제로 나타나는 경우를 브라우저에서 직접 보지는 못했다(로직은
    `limit+1` 조회로 코드 리뷰 및 소규모 데이터로 검증). 챌린지 수가 늘면
    한 번 더 확인이 필요하다.
- Verification Receipt:
  - Status: PASS(제한적)
  - Commands and Results: `pnpm typecheck`(워크스페이스 전체) - PASS.
    로컬 서버(`gai-ara-web`)에서 `/challenges`, `/t/{token}`(부승관) 실제
    렌더링 확인 - PASS(글씨 크기 축소, masked username `@ple****os` 표시
    확인). 비로그인 상태라 `RequestPublicListing`은 렌더링되지 않음을
    확인(예상대로 — 로그인·생성자 세션으로는 추가 확인 필요).
  - Unrun Checks: "더보기" 버튼이 실제로 나타나는 경로(공개 챌린지 13개
    이상)와 생성자 로그인 세션에서의 mailto 링크 노출은 데이터/세션 제약으로
    미확인 — 코드 리뷰로만 검증.

## TASK-011 — 타겟 챌린지: masked Instagram username 공개 표시
- Work Type: code
- 요청 배경(사용자 지정): 챌린지 생성자 본인도 "내가 등록해도 진짜 그 사람이
  맞는지 헷갈린다"는 문제가 있었고, 이어서 챌린지 참여자도 `/t/{token}`에서
  "내가 생각하는 그 사람을 대상으로 한 챌린지가 맞는지" 확인할 수 있어야
  한다는 요구로 범위가 확장됐다. Raw Instagram username을 저장하지 않는다는
  기존 원칙(AGENTS.md §1 원칙 2)은 그대로 유지하면서, 마스킹된 표시용 값만
  별도로 저장·노출하는 것으로 절충하기로 사용자가 직접 결정했다.
- Scope: `target_challenges`에 마스킹 표시용 컬럼 추가, 챌린지 생성 시 계산·
  저장, `GET /api/challenges/{token}` 공개 응답에 masked 값만 노출,
  `/t/[token]` 화면에 표시. `/create` 입력 화면, 그래프 계산
  (`getAllEdges`/`computeChallengeProgress`), `challenge_participants`
  start-set, `POST /api/challenges/{token}/join` 응답, Instagram mutual
  matching 로직은 변경하지 않는다.
- Related Concept Docs: [Product decisions](../01_Concept_Design/00_PRODUCT_DECISION_LOG.md)
  신규 항목(이번 작업에서 추가)
- Related Technical Docs: [DB Schema](../03_Technical_Specs/01_DB_SCHEMA.md) §4.9,
  [API Specs](../03_Technical_Specs/02_API_SPECS.md) §8.2,
  [개발 원칙](../03_Technical_Specs/00_DEVELOPMENT_PRINCIPLES.md) §3 원칙 2·3
- Related QA Docs: N/A - 구현 후 작성
- Implementation Preconditions:
  - DB: `target_challenges.target_instagram_username_masked` (nullable text,
    unique 제약 없음) 컬럼을 `packages/db/src/schema.ts`에 추가하고
    `pnpm db:generate`로 마이그레이션을 생성한다(수기 작성 금지). 기존 row는
    NULL로 남는다 — 과거 해시로부터 복원 시도를 하지 않는다.
  - 생성 로직: `apps/web/lib/instagram-identity.ts`에
    `maskInstagramUsername(normalizedUsername)` 순수 함수를 추가한다.
    `normalizeUsername`(트림·`@`제거·소문자화, `@gai-ara/ig-parser`)으로 정규화한
    뒤에만 마스킹한다. 규칙: 길이 3 이하는 첫 1글자+고정 마스크, 4~6은 첫
    2글자, 7~9는 첫 2글자+끝 1글자, 10 이상은 첫 3글자+끝 2글자(예:
    `pledis_boos` → `ple****os`) — 가운데는 실제 길이와 무관하게 항상 고정
    개수의 `*`로 표시해 길이를 유추할 수 없게 한다. 노출 글자 수가 전체 길이의
    절반을 넘지 않게 한다. 표시할 때는 `@` 접두사를 붙인다.
  - `POST /api/challenges`(`apps/web/app/api/challenges/route.ts`)가 해시와
    함께 masked 값도 계산해 `createChallenge`(`apps/web/lib/challenges.ts`)에
    전달·저장한다. 중복 생성 응답(`createChallengeResultSchema`)에는 masked
    값을 추가하지 않는다(스펙에 없는 범위, YAGNI).
  - `getChallengeByToken`(`apps/web/lib/challenges.ts`)이 masked 컬럼을 함께
    조회해 `ChallengeDetail`에 포함한다.
  - `packages/shared/src/schemas.ts`의 `challengePublicInfoSchema`에
    `targetInstagramUsernameMasked: z.string().nullable()`을 추가한다.
    `challengePublicResultSchema`/`challengeProgressSchema`(join 응답과 공유)는
    건드리지 않는다 — join 엔드포인트 응답에 username 관련 필드가 새지
    않아야 한다.
  - `GET /api/challenges/{token}`(`apps/web/app/api/challenges/[token]/route.ts`)
    응답에 masked 값을 포함한다. raw username과 해시는 어떤 응답에도 절대
    포함하지 않는다.
  - `/t/[token]` UI(`apps/web/components/TargetChallengeScreen.tsx`,
    "found"·"searching" 두 분기 모두)에서 `displayName` 바로 아래 masked
    username을 작은 회색 텍스트로 단독 표시한다("Instagram ·" 같은 접두 설명
    문구 없이 `@ple****os`만, 사용자 지정). masked 값이 null(과거 챌린지)이면
    이 영역 자체를 렌더링하지 않는다.
  - masked 값은 UI 표시 전용이며 identity matching/조회에 절대 사용하지
    않는다. username 검색·lookup API, masked username 기반 챌린지 검색
    기능은 만들지 않는다.
  - `maskInstagramUsername`에 대해 길이 1~3, 4~6, 7~9, 10 이상 경계값과
    실제 예시(`pledis_boos`)를 포함한 테스트를 `apps/web/lib/` 관행(co-located
    `*.test.ts`, `node:test`)대로 추가한다.
  - 이번 작업 범위 밖의 리팩터링은 하지 않는다.
- Context Receipt:
  - Status: PASS
  - Required References Read: Coordinator가 `packages/db/src/schema.ts`
    (`targetChallenges` 345-380), `packages/db/drizzle.config.ts`,
    `packages/db/migrations/`(네이밍 컨벤션), `apps/web/app/api/challenges/route.ts`,
    `apps/web/lib/instagram-identity.ts`, `packages/ig-parser/src/normalize.ts`,
    `apps/web/lib/challenges.ts`(`createChallenge`/`getChallengeByTargetHash`/
    `getChallengeByToken`), `apps/web/app/api/challenges/[token]/route.ts`,
    `apps/web/app/api/challenges/[token]/join/route.ts`,
    `packages/shared/src/schemas.ts`(challenge 관련 스키마),
    `apps/web/components/TargetChallengeScreen.tsx`,
    `apps/web/app/t/[token]/page.tsx`(OG 메타에는 추가하지 않음 확인),
    `docs/01_Concept_Design/00_PRODUCT_DECISION_LOG.md`(항목 포맷),
    `docs/03_Technical_Specs/02_API_SPECS.md` §8,
    `docs/03_Technical_Specs/01_DB_SCHEMA.md` §4.9,
    `docs/03_Technical_Specs/00_DEVELOPMENT_PRINCIPLES.md` §3, `AGENTS.md` §1을
    `solmate-context-reader` 서브에이전트를 통해 읽었다(2026-09-19).
  - Constraints: 위 Implementation Preconditions 전체. `AGENTS.md` §1 원칙 2·3
    (평문 미저장, 외부 계정 탐색/검색 API 금지).
  - Conflicts: 초기에 백로그 항목 자체가 없어 Context Receipt가 BLOCKED였다 →
    이 TASK-011 항목을 추가해 해결. `POST /api/challenges` 중복 응답에도
    masked 값을 넣을지는 스펙 밖 질문으로 남아있었다 → Excluded Scope로
    명시해 해결(필요해지면 별도 태스크).
- Acceptance Criteria:
  - `target_challenges`에 nullable masked 컬럼이 존재하고 마이그레이션이
    `pnpm db:generate`로 생성됐다.
  - 새 챌린지 생성 시 masked 값이 저장된다. 예시 입력(`pledis_boos`)에 대해
    `ple****os`가 계산된다.
  - `GET /api/challenges/{token}` 응답에 masked 값이 포함되고, raw
    username/hash는 어떤 응답 바디에도 없다(join 응답 포함해 grep으로 확인).
  - `/t/{token}`에서 displayName 아래 `@ple****os` 형태만(접두 설명 없이)
    작은 회색 텍스트로 보인다. masked 값이 null인 기존 챌린지는 이 영역이
    렌더링되지 않는다.
  - `maskInstagramUsername` 경계값 테스트가 통과한다.
  - `pnpm typecheck` PASS.
- Document Sync Check: `docs/01_Concept_Design/00_PRODUCT_DECISION_LOG.md`에
  이번 결정을 기존 항목 포맷대로 새 항목으로 추가(2026-09-16 항목 위에
  prepend)한다. `docs/03_Technical_Specs/02_API_SPECS.md` §8.2의
  `ChallengePublicInfo` 타입 블록에 masked 필드를 추가한다.
  `docs/03_Technical_Specs/01_DB_SCHEMA.md` §4.9에 새 컬럼을 문서화한다.
- Internal CLI: 이전 태스크들과 동일하게 체크박스 없는 헤딩 형식 때문에
  `solmate-skills preflight`가 인식하지 못한다 — 독립 Receipt로 대체.
- Change Receipt:
  - Files Changed:
    - `packages/db/src/schema.ts` — `targetChallenges.targetInstagramUsernameMasked` 컬럼 추가
    - `packages/db/migrations/0016_youthful_microchip.sql` — `pnpm db:generate`로 생성, DB에 적용 완료
    - `apps/web/lib/instagram-identity.ts` — `maskInstagramUsername` 추가
    - `apps/web/lib/instagram-identity.test.ts` — 경계값(1~3/4~6/7~9/10+) + `pledis_boos` 예시 테스트(신규)
    - `apps/web/app/api/challenges/route.ts` — 생성 시 masked 값 계산·전달
    - `apps/web/lib/challenges.ts` — `createChallenge` 시그니처 확장, `getChallengeByToken`/`ChallengeDetail`에 포함
    - `packages/shared/src/schemas.ts` — `challengePublicInfoSchema`에 `targetInstagramUsernameMasked` 추가
    - `apps/web/app/api/challenges/[token]/route.ts` — 공개 응답에 masked 값 포함
    - `apps/web/components/TargetChallengeScreen.tsx` — `TargetMaskedUsername` 추가, found/searching 두 분기에 표시
    - `apps/web/app/globals.css` — `.target-masked-username` 스타일 추가
    - `docs/01_Concept_Design/00_PRODUCT_DECISION_LOG.md` — 2026-09-19 항목 추가
    - `docs/03_Technical_Specs/02_API_SPECS.md` §8.2 — `ChallengePublicInfo`에 필드 추가
    - `docs/03_Technical_Specs/01_DB_SCHEMA.md` §4.9 — 새 컬럼 문서화
    - (스코프 밖, 필요 최소 수정) `packages/ig-parser/src/index.ts`,
      `packages/ig-parser/src/mutuals.ts`, `packages/ig-parser/src/zip.ts`,
      `packages/ig-parser/tsconfig.json` — 상대 import에 `.ts` 확장자를
      명시하지 않아 Node 내장 테스트 러너(`node --test`)가 barrel(`index.ts`)을
      거쳐 이 패키지를 import하는 모든 코드에서 `ERR_MODULE_NOT_FOUND`로
      깨지는 기존 버그를 발견 — 이번 태스크의 신규 테스트
      (`instagram-identity.test.ts`)가 `@gai-ara/ig-parser`를 처음으로
      가져오면서 드러났다. 동작 변경 없이 확장자만 명시(`tsconfig.json`에
      `allowImportingTsExtensions` 추가, `apps/web/tsconfig.json`과 동일
      패턴)해 해결했다.
  - Requirements Covered: 위 Acceptance Criteria 전체(DB 컬럼·마이그레이션,
    생성 시 저장, 공개 응답 노출 + raw/hash 비노출, `/t/{token}` UI 표시,
    경계값 테스트, `pnpm typecheck` PASS).
  - Excluded Scope: `/create` 입력 화면, 그래프 계산
    (`getAllEdges`/`computeChallengeProgress`), `challenge_participants`,
    `POST /api/challenges/{token}/join` 응답, `getChallengeByTargetHash`
    (중복 생성 감지 경로) — 전부 손대지 않음. `apps/web/AGENTS.md`도
    사용자 지시대로 건드리지 않음.
  - Basic Checks:
    - `pnpm db:generate` - PASS - `0016_youthful_microchip.sql`(nullable
      `ADD COLUMN`, unique 제약 없음) 생성
    - `pnpm db:migrate` - PASS - 실제 DB에 적용, `information_schema.columns`로
      컬럼 존재·nullable 확인
    - `pnpm typecheck`(워크스페이스 전체) - PASS
    - `pnpm --filter @gai-ara/web test` - PASS - 12개 전체(신규
      `maskInstagramUsername` 4개 포함)
    - `pnpm --filter @gai-ara/ig-parser test` - PASS - 15개(회귀 없음 확인)
    - `grep`으로 `targetInstagramUsernameHash`/raw `instagramUsername`이
      API 응답 조립부(`NextResponse.json`)에 등장하지 않음을 확인 - PASS
  - Remaining Risks: `packages/shared`의 `pnpm -r test`가 이번 작업과
    무관하게 "No test files found"로 이미 실패 상태였다(해당 패키지에
    테스트 파일 자체가 없음) — 기존 상태이고 이번 변경과 무관해 손대지
    않았다. DB 마이그레이션은 로컬 `.env.local`이 가리키는 Neon 브랜치에
    적용했는데, 이 브랜치가 dev/prod 공유 상태라는 별도 인프라 이슈가
    남아있다(MEMORY 기록) — 추가한 컬럼은 nullable이라 기존 행에 영향
    없음.

## TASK-010 — 화면 10(연결 미발견) 카피·CTA·일러스트 개정
- Work Type: code
- Scope: `apps/web/components/ReferralLanding.tsx`의 `result.status ===
  "unreachable"` 분기(화면 10)만 수정. 화면 08/09는 건드리지 않는다.
- 문제의식(사용자 지정): 이 화면은 "두 사람이 연결되어 있지 않다"는 단정이
  아니라 "현재 참여한 사람들의 데이터 안에서 아직 경로를 못 찾았다"는
  뜻이어야 한다 — 헤드라인·설명 문구·코드 주석 모두에서 이 의미를 지켜야
  한다.
- 변경 내용:
  - 헤드라인: "아직 이어지지 않았어요." → "아직 연결을 찾지 못했어요"
    (단정형 어미를 피함).
  - 설명 문구를 두 문단으로 교체: "현재 참여한 사람들 사이에서는 아직
    이어지는 길을 찾지 못했어요." / "아는 사람들이 더 참여하면 결과가
    달라질 수 있어요."
  - 일러스트: `Character kind="search"`(돋보기/노트북 인상의 캐릭터) →
    `kind="curious"`로 교체해 화면 08과 같은 시각 언어를 쓴다. 중간에는
    사람 노드 없이 기존 `.duo-dots`(점 세 개, 연한 색)만 유지 — 새 도형을
    만들지 않았다.
  - CTA: "다시 확인하기" 보조 버튼과 그에 딸린 `confirmError` 표시를
    제거했다. 같은 데이터로 다시 계산해도 결과가 같으므로 재시도 버튼은
    불필요하고, 다음에 `/r/{token}`에 다시 들어오면 그때 최신 데이터로
    자동 재계산된다. "나도 시작하기" 주 CTA만 남겼다.
  - 헤더: `<BrandHeader home />` → `<BrandHeader />`로 바꿔 "처음으로"
    링크를 제거했다(이 화면에서는 "나도 시작하기"가 유일한 다음 행동).
  - 에러/경고 색상, 아이콘 등 실패 화면 인상을 주는 요소는 원래도 없었고
    추가하지 않았다. 배경(cream)·헤드라인(deep green)·CTA 스타일은 기존
    브랜드 톤 그대로 유지.
  - "현재 참여 데이터 안에서 아직 못 찾음"이라는 의미는 UI 카피뿐 아니라
    코드 자체도 이미 그렇게 동작한다 — `computePairResult`가 확인된
    지인 링크 edge만으로 BFS 탐색하고, 없으면 `unreachable`을 반환할 뿐
    "관계 없음"을 저장하거나 단정하지 않는다. 이 분기 위에 그 취지를
    설명하는 주석을 추가했다.
- Verification: `pnpm --filter @gai-ara/web typecheck` PASS. 로컬 서버에서
  실제로 미연결 테스트 계정으로 `/r/{token}` 확인 → 새 헤드라인/설명
  문구/일러스트(curious 캐릭터 + 점 세 개)가 렌더링되는 것을 스크린샷으로
  확인. "처음으로"·"다시 확인하기" 문구가 화면에 없음을 검색으로 확인.
- Document Sync Check: `02_INVITE_GRAPH_CONCEPT.md`의 "10. 연결 미발견" 절을
  이 확정 카피·의미·일러스트 설명으로 동기화했다.

## TASK-009 — 화면 08(공개 링크 진입) 일러스트 축소, 08/08B 통합 확인
- Work Type: code
- 요청: 사용자가 화면 08(`/r/{token}`) 카피·CTA·헤더·returnTo 흐름·일러스트
  사양을 다시 정리해 전달했다. 이어서 "08B(공개 링크 진입-미연결)"가 08과
  같은 화면이면 중복 컴포넌트 없이 08로 통합해달라고 요청했다 — 공개 링크
  진입 시점에는 아직 결과(연결/미연결)를 미리 구분하지 않아야 한다는 것.
- 조사 결과: `ReferralLanding.tsx`(화면 08~10)를 다시 읽어보니 헤드라인
  ("{표시 이름}님과 나는 몇 다리 건너 아는 사이일까?"), 서브카피, CTA
  ("몇 다리인지 확인하기"), 헤더(로고만, `처음으로` 없음), returnTo 기반
  로그인 복귀(`lib/return-to.ts`의 `loginPathFor`/`normalizeReturnTo`를
  `/invite/{token}`과 공통 사용)까지 전부 이미 구현돼 있었다 — 아마 직전
  커밋(`bfd5ec5 Refresh referral teaser with curious characters`)에서 같이
  반영된 것으로 보인다. "08B" 같은 별도 화면/컴포넌트도 현재 코드에는 없다
  — `GET /api/r/{token}`은 소유자 표시 이름만 반환하고, 거리 계산은
  `POST /api/r/{token}/result`로 사용자가 CTA를 눌러야만(로그인 필요시
  로그인·이름 설정 후 자동으로) 실행된다. 즉 진입 시점에 연결 여부를 미리
  아는 경로 자체가 없어 08/08B 분리 문제가 실제로는 이미 해소돼 있었다.
  `docs/05_QA_Validation/user-journey-2026-09-13/README.md`에 남아있는
  `08-public-entry.png`/`08b-public-entry-unconnected.png` 캡처는 이 개정
  전 화면이라고 그 문서 스스로 명시해뒀다(재촬영 필요 상태로 표시됨).
- 실제 변경: 일러스트(`curious.png`, 두 감귤 + ?) 크기만 요청대로 약
  12.5% 축소했다. `apps/web/app/globals.css`의 `.referral-entry-art`
  width를 280px → 245px로, `ReferralLanding.tsx`의 해당 `Image`
  `sizes` 속성도 245px로 맞췄다. 연결선은 원래도 없었고 추가하지 않았다.
- Verification: `pnpm --filter @gai-ara/web typecheck` PASS. 로컬 서버에서
  실제로 비로그인 방문자로 `/r/{token}` 접속 → 카피/헤더/일러스트 크기
  확인(스크린샷) → CTA 클릭 → `/login?returnTo=/r/{token}`로 이동 확인 →
  로그인+표시 이름 설정 시뮬레이션 → `/login` 재방문 시 `/r/{token}`으로
  자동 복귀하고 대기 중이던 확인 요청이 자동 실행되어 결과 화면(10,
  미연결 테스트 데이터라 미발견)까지 그대로 이어지는 전체 흐름을 눈으로
  확인했다.
- Remaining: 새 390×844 스크린샷 재촬영은 QA 문서 쪽 후속 작업으로 남아있고
  (사용자가 별도 데스크톱에서 진행 중), 이번 작업 범위 밖이라 손대지 않았다.

## TASK-008 — `/api/participants` 부트스트랩을 프로덕션에서 차단
- Work Type: code
- 문제: 사용자가 직접 테스트하다가 발견함 — `/connect`가 "세션이 있는지"만
  확인하고 카카오 로그인 여부는 확인하지 않는데, `/api/participants`(TASK-002
  시절 임시 부트스트랩)가 인증 없이 열려 있어서 누구나 브라우저 콘솔에서
  직접 호출하면 카카오 로그인을 완전히 건너뛰고 계정을 만들 수 있었다.
  결정 로그의 "로그인은 카카오만 제공한다"(2026-09-13 결정 7)를 코드가
  실제로 강제하지 못하고 있었던 것.
- 조사: 이 엔드포인트의 유일한 실제 호출부는 `LivePairPage.tsx`(옛
  `/pair/[token]` 화면)인데, 이 화면은 현재 어떤 화면에서도 링크로 연결되지
  않는 고아 경로다. 즉 프로덕션에서 막아도 깨지는 현재 화면이 없다.
- 조치: `apps/web/app/api/participants/route.ts`에 `process.env.NODE_ENV
  === "production"`이면 403을 반환하는 가드를 추가했다. 개발 환경에서는
  그대로 동작해 테스트용 콘솔 스니펫(`fetch('/api/participants',
  {method:'POST'})`)을 계속 쓸 수 있다.
- Verification: `pnpm typecheck` PASS. 로컬(dev, NODE_ENV≠production)에서
  `curl -X POST /api/participants`가 여전히 200을 반환함을 확인 — 개발 편의는
  유지됨. 프로덕션 배포 후 실제로 403이 나는지는 배포 시 별도 확인 필요
  (Vercel은 프로덕션 빌드에 NODE_ENV=production을 자동으로 설정한다).

## TASK-007 — 화면 08~10 실제 구현: 공개 링크 진입/발견/미발견 (`ReferralLanding.tsx`)
- Work Type: code
- Scope: `apps/web/components/ReferralLanding.tsx`(`/r/[token]`)를 Instagram
  업로드 중심 옛 흐름(`ImportOnboarding`)에서
  화면 08(공개 링크 진입)·09(연결 발견, 다크 톤)·10(연결 미발견) 확정 카피로
  다시 만든다. 화면 07(공개 링크 만들기)은 이미 TASK-005가 `/result`에
  구현해뒀으므로 이번 스코프에서 제외. 화면 11(공유 카드)은 실제 이미지
  생성 없이 OG 메타 태그만 새 카피로 갱신한다(범위를 좁힘, 아래 참고).
- Related Concept Docs: [Product decisions](../01_Concept_Design/00_PRODUCT_DECISION_LOG.md) 2026-09-13 항목
- Related UI Docs: [Invite-graph concept](../02_UI_Screens/02_INVITE_GRAPH_CONCEPT.md) 화면 08·09·10·11, "제품 용어" 섹션
- Related HTML Preview: [Invite-graph preview](../02_UI_Screens/previews/02_INVITE_GRAPH_PREVIEW.html) 08~11번 카드
- Related Technical Docs: [v2 명세](../03_Technical_Specs/03_INVITE_GRAPH_V2_SPEC.md) §3.3(`/api/r/:token` `ownerDisplayName`)
- Related QA Docs: [2026-09-13 user-journey captures](../05_QA_Validation/user-journey-2026-09-13/README.md) - 화면 08 기존 PNG는 개정 전 자료이며 새 캡처가 필요함
- Implementation Preconditions:
  - 로그인 여부와 관계없이 `/r/{token}` 진입 시 화면 08을 먼저 보여준다. 확인 CTA를
    누른 시점에만 인증이 필요하면 `/login?returnTo=/r/{token}`으로 이동한다.
  - CTA의 확인 의도를 token별로 보존하고, 로그인과 표시 이름 설정 뒤 원래 공개 링크로
    복귀하면 그 의도를 한 번만 소비해 `computePairResult` 기반 거리 조회를 자동 시작한다.
    이미 준비된 세션은 CTA를 누르면 바로 09(발견) 또는 10(미발견) 결과를 조회한다.
  - "직접 연결 0명이면 지인 링크 공유로 안내 후 자동 재확인" 같은 정교한
    로직은 만들지 않는다(YAGNI) — 화면 10의 기존 문구·"다시 확인하기"
    버튼으로 충분하다고 판단.
  - `/api/r/{token}` 응답의 `ownerDisplayName`을 화면 08 문구에 반영한다
    ("OO님과 나는 몇 다리 건너 아는 사이일까?" 형태 — 없으면 "우리, 몇 다리
    건너 아는 사이일까?").
  - 화면 09는 크림 톤이 아니라 어두운 배경으로 전환한다(카피 원칙/화면 09
    설명 참고). 점 개수와 "거치는 사람 수" 문구가 항상 일치해야 한다.
  - "그래프", "인맥", "네트워크", "데이터" 단어를 화면 카피에 쓰지 않는다.
    관계를 묻는 화면 08과 CTA에는 "몇 다리"를 쓰되, 화면 09의 계산 결과는 실제
    중간 사람 수에 맞춰 "몇 사람을 거치면"류로 표현한다.
  - 화면 11: `apps/web/app/r/[token]/page.tsx`의 `metadata`(title/description)만
    새 카피("생각보다 가까웠어요" 계열, 옛 "우리, 몇 다리 건너..." 제거)로
    갱신한다. 실제 카드 이미지 생성(동적 OG 이미지 등)은 이번 범위 밖 —
    기존 정적 `gamgyul-wave.png` 재사용.
  - `ImportOnboarding`/`UploadFlow`/`ig-parser`는 삭제하지 않는다(다른 곳에서
    참조 안 되면 이 컴포넌트에서 import만 제거).
  - 새 npm 의존성을 추가하지 않는다.
- Context Receipt:
  - Status: PASS
  - Required References Read: Coordinator가 `02_INVITE_GRAPH_CONCEPT.md` 화면
    08·09·10·11, 미리보기 HTML 08~11번 카드, `03_INVITE_GRAPH_V2_SPEC.md` §3.3,
    `ReferralLanding.tsx` 전체, `apps/web/app/r/[token]/page.tsx`(metadata),
    `apps/web/lib/graph-service.ts`(`computePairResult`가 이미 새 edge
    소스를 씀을 확인)를 읽었다. Screen 08 개정 재작업에서는
    [2026-09-13 user-journey captures](../05_QA_Validation/user-journey-2026-09-13/README.md)의
    기존 화면 08 캡처 상태도 추가로 확인했다.
  - Constraints: 위 Implementation Preconditions 전체.
  - Conflicts: 없음 — 필요한 API/로직이 이미 있어 프론트 카피·라우팅만
    다시 짜면 된다.
- Acceptance Criteria:
  - 세션 없이 `/r/{token}`에 접속해도 화면 08이 먼저 보이고, CTA를 누른 뒤에만
    로그인·이름 설정으로 이동한다. 완료 후 원래 링크로 복귀해 결과를 한 번 자동 조회한다.
  - 준비된 세션으로 화면 08 CTA를 눌렀을 때 결과가 있으면(연결됨) 어두운 톤의 화면 09가,
    없으면(미발견) 화면 10이 확정 카피대로 보인다.
  - 화면 08 문구에 링크 소유자 표시 이름이 반영되고, 이름이 없을 때도 확정 fallback을 쓴다.
  - 화면 08은 로고 전용 헤더와 이 화면에서만 약 12.5% 줄인 일러스트를 사용한다.
  - `/r/{token}` 페이지의 OG 메타 title/description이 새 카피로 바뀐다.
  - 금지 단어가 화면 텍스트에 없다.
  - `pnpm typecheck` PASS.
- Document Sync Check: 02_INVITE_GRAPH_CONCEPT.md "다음 단계"에서 화면
  08·09·10을 "구현 완료" 목록으로 옮기고, 11은 "OG 메타만 갱신, 카드 이미지
  생성은 후순위"로 기록한다. Screen 08 개정 후에는 사용자 여정 문서의 전체 흐름과
  기존 화면 캡처의 개정 전 상태도 QA README에 명시한다.
- Internal CLI: 이전 태스크들과 동일 — 독립 Receipt로 대체.
- Change Receipt:
  - Files Changed: `apps/web/components/ReferralLanding.tsx`(전면 재작성),
    `apps/web/app/r/[token]/page.tsx`(OG 메타), `apps/web/lib/distance-copy.ts`
    (`formatIntermediaryPhrase` 추가), `apps/web/app/globals.css`
    (`.duo-dots`, `.referral-dark-page`), `docs/02_UI_Screens/02_INVITE_GRAPH_CONCEPT.md`.
  - Requirements Covered: 위 Acceptance Criteria 전체.
  - Excluded Scope: `ImportOnboarding`/`UploadFlow`/`ig-parser` 파일 자체,
    `packages/graph`/`graph-service.ts`, 새 npm 의존성, 동적 OG 이미지 생성,
    "0명 연결 시 자동 재확인" 로직 — 전부 손대지 않음.
  - Basic Checks: `pnpm typecheck`(워크스페이스 전체) - PASS. `git diff --check` -
    PASS. 금지 단어 grep - PASS.
  - Remaining Risks: 로그인은 했지만 표시 이름 미설정인 방문자도 거리 조회
    자체는 그대로 통과함(표시 이름 여부를 따로 검사하지 않음) — 크래시는
    안 나지만 명시적 gate는 아님. 로그인 후 원래 링크로 자동 복귀하지 않는
    기존 한계 유지.
- Verification Receipt:
  - Status: PASS
  - Commands and Results: `pnpm typecheck`(워크스페이스 전체) - PASS.
    `git diff --stat`/개별 파일 diff 대조 - PASS. 금지 단어 grep - PASS.
  - Unrun Checks: 이 화면의 실제 브라우저 렌더링은 Coordinator가 이미
    curl/브라우저로 로그인 리다이렉트·OG 제목·거리 계산(unreachable·
    connected distance=1)을 직접 확인했으므로 중복 실행하지 않음.
    DB 연동 자동 테스트는 이 프로젝트에 애초에 없음(기존 제약).
  - Detailed Evidence: 점 개수(`ConnectionDiagram`)와 "N 사람을 거치면"
    문구가 동일한 `distance - 1` 계산을 공유해 항상 일치함을 코드로 확인.
    화면 09 다크 테마(`referral-dark-page`) CSS 실제 적용 확인. 화면 08
    개인화 분기(표시 이름 있음/없음) 코드로 확인. 미리보기 HTML의 08번
    카드가 구버전 문구를 담고 있던 걸 발견해 확정 카피로 동기화했다(위
    Related HTML Preview 갱신).
- 2026-09-13 Screen 08 Revision:
  - 화면 08 헤드라인은 링크 소유자 이름이 있으면 "{표시 이름}님과 나는 몇 다리
    건너 아는 사이일까?", 없으면 "우리, 몇 다리 건너 아는 사이일까?"로 확정했다.
    이전 헤드라인 전제와 화면 카피의 "몇 다리" 금지는 이 개정으로 대체한다.
    결과 화면 09의 정확한 중간 사람 수 표현은 유지한다.
  - 부제와 CTA는 각각 "서로 모르는 사이여도 생각보다 가까울 수 있어요.", "몇
    다리인지 확인하기"를 유지한다. 화면 08 헤더에서는 `처음으로`를 숨기고, 궁금해하는
    감귤 이미지는 이 화면에서만 약 12.5% 작게 표시한다.
  - `/invite/{token}`과 같은 `loginPathFor(returnTo)` 구조를 쓰는 기존 흐름을 유지한다.
    `/r/{token}` CTA 확인 의도는 token별 `sessionStorage`에 보존되고 로그인·이름 설정
    뒤 원래 경로로 복귀할 때 한 번만 소비된다. route/token/edge 동작은 변경하지 않는다.
- Change Receipt (2026-09-13 Screen 08 Revision):
  - Files Changed: `apps/web/components/ReferralLanding.tsx`,
    `apps/web/app/globals.css`, `docs/02_UI_Screens/02_INVITE_GRAPH_CONCEPT.md`,
    `docs/02_UI_Screens/previews/02_INVITE_GRAPH_PREVIEW.html`,
    `docs/03_Technical_Specs/03_INVITE_GRAPH_V2_SPEC.md`,
    `docs/user_journey_flow.md`,
    `docs/05_QA_Validation/user-journey-2026-09-13/README.md`, 이 백로그 항목.
  - Requirements Covered: 개인화 헤드라인과 이름 없는 fallback, 정확한 부제·CTA,
    화면 08 전용 이미지 축소와 로고 전용 헤더, 로그인 전 화면 08 선노출 및 공통
    `returnTo` 복귀 구조 보존, 관련 문서와 HTML 시안 동기화.
  - Excluded Scope: 화면 09·10의 헤더/결과 디자인, API·DB·route/token·edge 로직,
    로그인·이름 설정의 기존 공통 구현, 새 의존성.
  - Basic Checks: `pnpm typecheck`(워크스페이스 전체) - PASS. `git diff --check` - PASS.
  - Remaining Risks: 독립 재검증 전이며, 실제 카카오 OAuth 왕복과 390×844 시각 크기는
    브라우저·실계정 QA가 필요하다.

## TASK-006 — `/connections` 실제 구현: 리스트 대신 거리 기반 방사형 미니 그래프
- Work Type: code
- Scope: `apps/web/components/ConnectionsList.tsx`(`/connections`)를 리스트
  UI에서 "나"를 중심으로 거리를 공간(반지름)으로 표현하는 작은 가지형
  시각화로 바꾼다. 결과 하나당 `나 ─ ○ ─ ○ ─ ●`처럼 (거리-1)개의 빈 점 +
  마지막 실제 노드로 된 가지 하나를 그린다. 제목을 "건너건너 만난 사람들"로,
  빈 상태 문구를 새로 바꾼다. `apps/web/components/ResultScreen.tsx`는
  TASK-005가 진행 중이므로 건드리지 않는다(그 파일이 이미 만들어둔
  `/connections` 링크 텍스트만 필요하면 다음 라운드에서 맞춘다).
- Related Concept Docs: [Product decisions](../01_Concept_Design/00_PRODUCT_DECISION_LOG.md) 2026-09-13 항목
- Related UI Docs: [Invite-graph concept](../02_UI_Screens/02_INVITE_GRAPH_CONCEPT.md) "제품 용어" 섹션(카피 원칙 준용 — 화면 목록에 별도 번호는 아직 없음, 이 문서에 이번 작업으로 추가한다)
- Related HTML Preview: N/A - 이번 레이아웃(거리=반지름, 가지형 spoke)은 기존
  미리보기에 없는 새 시안이라 별도 승인 없이 진행한다 — 사용자가 직접 텍스트
  스케치로 상세히 지정했고("나 ─ ○ ─ ○ ─ ●" 등), 화면이 완성되면 스크린샷으로
  확인받는다(별도 요청됨).
- Related Technical Docs: [개발 원칙](../03_Technical_Specs/00_DEVELOPMENT_PRINCIPLES.md) §3
- Related QA Docs: N/A - 구현 후 작성
- Implementation Preconditions:
  - 데이터 소스는 `/api/referral-link`의 `visits`만 쓴다. `/api/me/pairs`
    (옛 1:1 `pair_invites` 요약)는 이 화면에서 제거한다 — `ResultScreen.tsx`가
    이미 "1:1 링크 UI는 의도적으로 다시 안 보여준다"고 정한 결정과 같은
    이유다.
  - `status === "connected"`인 visit만 가지(spoke)로 그린다. 미발견
    (unreachable)/대기 중인 시도는 그래프에 넣지 않고, 있으면 그래프 아래
    작은 텍스트로만("아직 못 찾은 시도 N건") 덧붙인다.
  - 제목: "건너건너 만난 사람들". 부제: "지금까지 발견된 사이예요."
  - 빈 상태: "아직 발견한 사이가 없어요. / 링크를 공유하면 여기서 하나씩
    나타나요."
  - "그래프", "인맥", "네트워크", "데이터" 단어를 화면 텍스트에 쓰지 않는다.
  - 노드에 방문자 표시 이름(nickname)을 라벨로 쓰되, 중간 점(○)에는 아무
    라벨도 붙이지 않는다(중간 연결자 비공개 원칙 유지 — 애초에 이 화면도
    중간자 신원을 알지 못한다).
  - 새 npm 의존성을 추가하지 않는다. 순수 CSS/SVG로 반지름 배치와 선을
    그린다.
- Context Receipt:
  - Status: PASS
  - Required References Read: Coordinator가 `ConnectionsList.tsx` 전체,
    `ResultScreen.tsx`의 관련 주석과 `/connections` 링크,
    `apps/web/app/connections/page.tsx`, `/api/referral-link` 응답 형태
    (`ReferralVisit` 타입, `packages/shared`)를 읽었다.
  - Constraints: 위 Implementation Preconditions 전체.
  - Conflicts: 없음. `ResultScreen.tsx`는 TASK-005가 이미 작업 중이라 이번
    작업에서 제외했다(파일 충돌 방지).
- Acceptance Criteria:
  - `/connections` 접속 시 제목·부제·빈 상태 문구가 확정 카피대로 보인다.
  - `connected` 상태인 각 visit이 거리만큼 점을 거친 가지 하나로 표시된다
    (거리 1이면 점 없이 `나 ─ ●`).
  - 옛 1:1 pairInvites 요약이 이 화면에서 사라진다.
  - 금지 단어가 화면 텍스트에 없다.
  - `pnpm typecheck` PASS.
- Document Sync Check: 02_INVITE_GRAPH_CONCEPT.md에 이 화면을 새 항목으로
  추가하고(화면 목록·본문), "다음 단계"에 구현 완료로 기록한다.
- Internal CLI: 이전 태스크들과 동일 — 독립 Receipt로 대체.

## TASK-005 — 화면 06(내 연결 메인): 실제 거리 기반 미니 그래프
- Work Type: code
- Scope: `/result`에 실제 BFS 거리 기반 `MiniConnectionGraph`를 구현한다.
  `gai-ara-mini-graph.svg`의 6개 고정 방향과 색감을 참고하되 React SVG로
  동적 렌더링한다. 숫자 통계를 제거하고, 직접 연결용 CTA와 몇 다리 확인용
  공유 영역을 행동·설명으로 구분한다. focus/visibility 복귀 시 자동 갱신한다.
- Related Concept Docs: [Product decisions](../01_Concept_Design/00_PRODUCT_DECISION_LOG.md) 2026-09-13 항목
- Related UI Docs: [Invite-graph concept](../02_UI_Screens/02_INVITE_GRAPH_CONCEPT.md) 화면 06, "제품 용어" 섹션
- Related HTML Preview: [Invite-graph preview](../02_UI_Screens/previews/02_INVITE_GRAPH_PREVIEW.html) 06번 카드(`.cluster` CSS 패턴)
- Related Technical Docs: [v2 명세](../03_Technical_Specs/03_INVITE_GRAPH_V2_SPEC.md) §3.2(`GET /api/me/connections`)
- Related QA Docs: N/A - 구현 후 작성
- Implementation Preconditions:
  - `GET /api/me/result`에 신원·경로 없이 BFS 거리 1~3의 대표 표본만 최대
    6개 추가한다. 참여자 ID와 중간 연결자는 응답하지 않는다.
  - "그래프", "인맥", "네트워크", "데이터" 단어를 화면 텍스트에 쓰지 않는다.
  - CTA는 "아는 사람에게 보내기"(→ `/connect`)와 "몇 다리인지 확인할 링크
    공유하기 →"(같은 화면 안 공유 영역) 두 개다.
  - 관계가 없으면 가짜 노드나 `0명` 통계를 표시하지 않는다.
  - 기존 `/api/invites` 1:1 링크 UI를 다시 노출하지 않는다(주석에 남은
    의도적 결정, 유지).
  - 새 npm 의존성을 추가하지 않는다.
- Context Receipt:
  - Status: PASS
  - Required References Read: Coordinator가 `02_INVITE_GRAPH_CONCEPT.md` 화면
    06, 미리보기 HTML 06번 카드, `03_INVITE_GRAPH_V2_SPEC.md` §3.2,
    `apps/web/components/ResultScreen.tsx`(전체), `apps/web/lib/graph-service.ts`
    (`computeMeResult`가 이미 `getAllEdges()`를 씀을 확인), `apps/web/components/ConnectionsList.tsx`
    (옛 리스트 UI 확인용, 이번 스코프 아님)를 읽었다.
  - Constraints: 위 Implementation Preconditions 전체.
  - Conflicts: 기존 응답은 집계만 제공해 거리별 가지를 정직하게 그릴 수 없었다.
    개인정보 원칙을 지키며 익명 거리 배열만 API에 추가하는 것으로 해결했다.
- Acceptance Criteria:
  - `/result` 접속 시 실제 관계 데이터 기반 대표 가지가 최대 6개 보인다.
  - 관계가 없으면 중앙 감귤과 `나`만 보인다.
  - "아는 사람에게 보내기"가 `/connect`로 연결된다.
  - 두 번째 행동을 누르면 공유 버튼과 말줄임 URL·복사 피드백이 펼쳐진다.
  - 화면 진입 및 focus/visible 복귀 시 결과가 갱신되고 수동 새로고침은 없다.
  - 금지 단어가 화면 텍스트에 없다.
  - `pnpm typecheck` PASS.
- Document Sync Check: 구현 후 02_INVITE_GRAPH_CONCEPT.md "다음 단계"에서
  화면 06을 "구현 완료" 목록으로 옮긴다.
- Internal CLI: 이전 태스크들과 동일 — 독립 Receipt로 대체.
- 2026-09-13 Screen 07 Revision:
  - 화면 07은 별도 페이지가 아니라 화면 06의 `MiniConnectionGraph`와 본문을 유지하는
    인라인 펼침 상태로 확정했다. 두 번째 행동은 동적 화살표와 `aria-expanded`/
    `aria-controls`를 제공하며 같은 버튼으로 접을 수 있다.
  - 펼침 영역은 Web Share API 기반 `공유하기`를 Primary로, 말줄임 `/r/{token}` URL과
    전체 URL clipboard 복사를 Secondary로 둔다. `이어진 사람 보기`는 이 영역에서
    제거했다.
  - `/connect` → `/invite/{token}` 직접 관계 흐름과 `/r/{token}` 거리 확인 흐름은
    기존처럼 별도 API/token/route를 유지한다. `/r` 방문은 edge를 만들지 않는다.
  - `/r/{token}` 비로그인 방문자도 먼저 화면 08을 보고, `몇 다리인지 확인하기`를
    누른 뒤에만 `returnTo`가 있는 로그인으로 이동한다. CTA의 확인 의도를 token별
    `sessionStorage`에 잠시 보존하고, 로그인·이름 설정 뒤 복귀하면 한 번 소비해 거리
    계산을 자동 시작한다. CTA 없이 직접 방문한 로그인 사용자에게는 자동 계산하지 않는다.
- Change Receipt (2026-09-13 Screen 07 Revision):
  - Files Changed: `apps/web/components/ResultScreen.tsx`,
    `apps/web/components/ReferralLanding.tsx`, `apps/web/components/LoginScreen.tsx`,
    `apps/web/app/globals.css`,
    `docs/02_UI_Screens/02_INVITE_GRAPH_CONCEPT.md`,
    `docs/02_UI_Screens/previews/02_INVITE_GRAPH_PREVIEW.html`, 이 백로그 항목.
  - Requirements Covered: 06/07 인라인 펼침·접힘과 미니 그래프 유지, Web Share
    Primary, URL 복사 Secondary와 시간 제한 피드백, 약한 하단 로그아웃, 07의 추가
    목록 링크 제거, 화면 08 선노출과 명시적 CTA 뒤 로그인·복귀 시 자동 거리 계산.
    카카오 OAuth
    콜백도 `returnTo`가 있는 로그인 화면으로 돌아오게 해 표시 이름 설정을 한 번의
    인증 왕복 안에서 마친다.
  - Excluded Scope: API/DB/schema 변경, 새 route/token, 새 의존성, edge 생성 로직,
    화면 09·10 결과 디자인 재작업.
  - Basic Checks: `pnpm typecheck`(워크스페이스 전체) - PASS. `git diff --check` -
    PASS. `ResultScreen.tsx` 펼침 영역의 불필요한 `이어진 사람 보기` grep - PASS.
  - Remaining Risks: 재검증 전이며, 실제 Web Share sheet와 Kakao OAuth 왕복은
    브라우저/실계정 QA가 필요하다.
- Verification Receipt (2026-09-13 Screen 07 Revision):
  - Status: PASS
  - Commands and Results: `pnpm typecheck` - PASS. `git diff --check` - PASS.
    `pnpm --filter @gai-ara/web test` - PASS(`no tests yet`).
    `pnpm --filter @gai-ara/web exec next build --webpack` - PASS(24 pages).
  - Unrun Checks: 실제 Kakao OAuth 왕복, 모바일 Web Share/clipboard 권한, 최신
    390×844 시각 캡처는 브라우저·실계정이 필요해 미실행. 기본 Turbopack build는
    sandbox 포트 바인딩 제약으로 미실행하고 webpack production build로 대체했다.
  - Detailed Evidence: [Screen 07 inline sharing verification](../05_QA_Validation/02_SCREEN_07_INLINE_QA.md)

## TASK-004 — 화면 01(첫 화면) 실제 구현: Instagram 랜딩 제거, 새 홈 카피
- Work Type: code
- Scope: `apps/web/app/page.tsx`를 02_INVITE_GRAPH_CONCEPT.md 화면 01·01-1 확정
  카피로 다시 만든다. Instagram 중심 랜딩(히어로 문구, "네트워크"/인스타 피처
  아이콘, `ImportReturnGate`/`ResumeImport`, `/upload/guide` 링크)을 홈에서
  제거한다. `/upload` 경로 자체와 그 안의 컴포넌트는 삭제하지 않는다(후순위
  보류, 라우팅만 안 함 — TASK-002/003과 같은 원칙). 화면 06~11 재작업은
  이번 스코프 밖.
- Related Concept Docs: [Product decisions](../01_Concept_Design/00_PRODUCT_DECISION_LOG.md) 2026-09-13 항목
- Related UI Docs: [Invite-graph concept](../02_UI_Screens/02_INVITE_GRAPH_CONCEPT.md) 화면 01·01-1, "제품 용어" 섹션
- Related HTML Preview: [Invite-graph preview](../02_UI_Screens/previews/02_INVITE_GRAPH_PREVIEW.html) 01번 카드(확정 카피)
- Related Technical Docs: [개발 원칙](../03_Technical_Specs/00_DEVELOPMENT_PRINCIPLES.md) §3
- Related QA Docs: N/A - 구현 후 작성
- Implementation Preconditions:
  - "그래프", "인맥", "네트워크", "데이터", "Instagram/인스타" 단어를 이 페이지
    어디에도 쓰지 않는다.
  - "Six Degrees of Separation" 영어 표기나 각주(`[1]` 등)를 쓰지 않는다.
  - "몇 다리"는 01-1 근거 설명 문장("...몇 다리 건너 아는 사이일까요?") 한
    군데에만 예외로 허용한다. 그 외에는 쓰지 않는다.
  - 홈 CTA는 "시작해보기" 하나로, `/login`으로 연결한다.
  - 이미 로그인+표시 이름까지 마친 세션으로 `/`를 열면 랜딩을 보여주지 않고
    `/result`로 보낸다(서버 컴포넌트에서 `getSessionParticipantId`/
    `getDisplayName`으로 판단 — `BrandHeader`가 이미 하는 것과 같은 원리를
    서버 사이드에서 적용, 깜빡임 없이).
  - `/privacy` 링크(개인정보처리방침)는 유지한다.
  - 새 npm 의존성을 추가하지 않는다. `Icon`/`Character`/`BrandHeader` 등 기존
    Brand.tsx 컴포넌트를 재사용한다.
- Context Receipt:
  - Status: PASS
  - Required References Read: Coordinator가 이번 세션에서 직접 작성한
    `02_INVITE_GRAPH_CONCEPT.md`(화면 01·01-1, 제품 용어 섹션), 결정 로그
    2026-09-13 항목, 미리보기 HTML 01번 카드, 현재 `apps/web/app/page.tsx`,
    `apps/web/components/Brand.tsx`(BrandHeader의 세션 기반 로고 분기 로직),
    `apps/web/lib/session.ts`/`participants.ts`(getSessionParticipantId,
    getDisplayName)를 모두 읽었다.
  - Constraints: 위 Implementation Preconditions 전체.
  - Conflicts: 없음 — 카피와 라우팅 목적지 모두 이미 확정돼 있어 새로 결정할
    것이 없다.
- Acceptance Criteria:
  - `/` 접속 시(세션 없음) 화면 01·01-1 확정 카피가 정확히 보인다.
  - "시작해보기" 클릭 시 `/login`으로 이동한다.
  - 로그인+표시 이름 완료 세션으로 `/` 접속 시 `/result`로 리다이렉트된다.
  - 금지 단어(그래프/인맥/네트워크/데이터/인스타그램/Instagram/Six Degrees of
    Separation)가 렌더링된 페이지 텍스트에 없다.
  - `/privacy` 링크가 여전히 존재한다.
  - `/upload`, `/upload/guide`, `ImportOnboarding` 관련 파일은 삭제되지 않는다.
  - `pnpm typecheck` PASS.
- Document Sync Check: 구현 후 02_INVITE_GRAPH_CONCEPT.md "다음 단계"에서
  화면 01을 "구현 완료" 목록으로 옮긴다.
- Internal CLI: 이전 태스크들과 동일하게 체크박스 없는 헤딩 형식 때문에
  `solmate-skills preflight`가 인식하지 못한다 — 독립 Receipt로 대체.
- 2026-09-13 Copy/Layout Revision:
  - 사용자 피드백을 최신 UI 기준으로 삼아 헤드라인을 2줄로 줄이고, 감귤 캐릭터를
    기존 시안 대비 약 20% 축소했다.
  - 홈 CTA를 "시작해보기"로 변경했다. 다른 사람의 결과를 본 뒤 쓰는
    "나도 시작하기"와 역할을 구분한다.
  - 사람을 거쳐 이어진다는 이야기는 버튼 아래 보조 문장이 아니라 충분한 여백을 둔 별도 콘텐츠
    블록으로 분리하고, 단정적 숫자 표현 대신 "몇 사람만 거치면"으로 완곡하게 썼다.
    메인 질문과 겹치던 카드의 마지막 질문은 삭제하고 카드 패딩도 축소했다.
  - `02_INVITE_GRAPH_CONCEPT.md`와 `02_INVITE_GRAPH_PREVIEW.html`의 화면 01을 함께
    갱신했다.

## TASK-003 — Invite-graph v2: 카카오 로그인·표시 이름·재사용 지인 링크
- Work Type: code
- Scope: [03_INVITE_GRAPH_V2_SPEC.md](../03_Technical_Specs/03_INVITE_GRAPH_V2_SPEC.md) 전체를
  구현. 카카오 로그인(Auth.js)으로 동일인 판별, 표시 이름 설정(화면 02), 재사용 가능한
  지인 링크(`acquaintance_links` + `acquaintance_confirmations`; 이후 결정으로 인원
  상한·만료 제거), 화면 04 문구에 표시 이름 반영, 공개 링크(`/api/r/:token`) 응답에 소유자 표시
  이름 추가. TASK-002의 `pair_invites` 기반 edge 소스를 `acquaintance_confirmations`
  기반으로 교체(`follows`와 동일하게 코드는 보존, 조회만 중단). 화면 01/06~11 자체의
  재작업, 도시 선택, 연결된 세상(12번), 관계 해제/삭제 기능은 스코프 밖(연결 해제는
  제품 결정으로 아예 제공하지 않기로 확정됨).
- Related Concept Docs: [Product decisions](../01_Concept_Design/00_PRODUCT_DECISION_LOG.md) 2026-09-13 항목(결정 7·8)
- Related UI Docs: [Invite-graph concept](../02_UI_Screens/02_INVITE_GRAPH_CONCEPT.md) 화면 02·03·04·05
- Related HTML Preview: [Invite-graph preview](../02_UI_Screens/previews/02_INVITE_GRAPH_PREVIEW.html) —
  화면 02(로그인·표시 이름) 추가, 03·04·05 갱신 완료. 태그 균형 확인 완료(Context
  Receipt). 상단 revnote 패널도 TASK-003 변경 내역으로 갱신했다.
- Related Technical Docs: [v2 명세](../03_Technical_Specs/03_INVITE_GRAPH_V2_SPEC.md)(정본),
  [기존 DB 스키마](../03_Technical_Specs/01_DB_SCHEMA.md)(TASK-002까지 기준, 참고),
  [기존 API 명세](../03_Technical_Specs/02_API_SPECS.md)(참고), [개발 원칙](../03_Technical_Specs/00_DEVELOPMENT_PRINCIPLES.md) §3
- Related QA Docs: N/A - 아직 QA 문서 없음, 구현 후 작성
- Implementation Preconditions:
  - OAuth는 직접 구현하지 않고 Auth.js(NextAuth)를 도입한다 — "새 의존성 최소화"
    원칙에 대한 명시적 예외로 이미 승인됨(v2 명세 §3.1).
  - 관계 해제/삭제 기능은 만들지 않는다 — 확인된 연결은 되돌릴 수 없다(제품 결정,
    v2 명세 §2.4). `DELETE` 엔드포인트를 두지 않는다.
  - 로그인 제공자는 카카오만 구현한다. Google 등 다른 제공자는 추가하지 않는다.
  - `acquaintance_confirmations`에 soft-delete 컬럼을 두지 않는다.
  - 표시 이름은 로그인 프로필에서 자동으로 채우지 않고 사용자가 직접 입력한 값만
    저장한다.
  - 카카오 로그인으로 새로 만들어지는 `participants` 행도 `identity_hash`가
    NOT NULL/UNIQUE라서 값이 필요하다 — `createBootstrapParticipant()`와 같은
    컨벤션을 재사용해 `kakao:<random hex>` opaque 값을 넣는다. 동일인 판별의
    실제 조인 키는 `identity_hash`가 아니라 `oauth_accounts(provider,
    provider_account_id)`이므로, 이 값 자체는 매칭에 쓰이지 않는 자리채움일
    뿐이다(Context Receipt Conflict 5 해결).
- Context Receipt:
  - Status: PASS
  - Required References Read: Context agent가 결정 로그·화면 스토리보드·
    v2 명세·HTML 미리보기·기존 DB 스키마/API 명세·개발 원칙·AGENTS.md·워크플로우
    문서 전부와, packages/db 스키마, participants/invites/session 관련 lib·API
    라우트, LivePairPage.tsx, ReferralLanding.tsx, distance-copy.ts,
    package.json(루트/apps/web), env.ts를 읽었다(2026-09-13).
  - Constraints: `00_DEVELOPMENT_PRINCIPLES.md` §3 원칙 1-6, `AGENTS.md` §1,
    v2 명세 전체(§2~5), 위 Implementation Preconditions.
  - Conflicts: 최초 실행 시 5가지가 열려 있었다 — (1) HTML 미리보기 백로그
    필드가 실제로는 이미 갱신된 파일을 N/A로 잘못 기록하고 있었음 → 위에서
    필드와 revnote 패널을 갱신해 해결. (2) 내부 `solmate-skills preflight`가
    이 프로젝트의 체크박스 없는 백로그 헤딩 형식(`## TASK-003 — ...`)을
    지원하지 않아 실패함(이전 태스크들에 적힌 "ENOTCACHED"는 부정확한 원인
    설명이었다) → 아래 Internal CLI에 정확한 원인으로 정정, 백로그 형식 자체는
    바꾸지 않는다(도구가 이 프로젝트 관행에 맞추는 게 맞고, 이 명령은 사람
    워크플로우가 아니라 CI 인터페이스라 독립 Receipt로 계속 대체한다). (3)
    Auth.js 의존성 승인이 여전히 유효한지 → 이미 사용자가 명시적으로
    승인함("라이브러리사용"), 재확인 완료. (4) 카카오 앱 크리덴셜
    (REST API 키/Client Secret)이 아직 발급·설정되지 않음 → 아래 참고, 코드
    작성 자체를 막지는 않지만 실제 로그인 동작은 사용자가 카카오 디벨로퍼스에서
    앱을 만들어 키를 넣어줘야 확인 가능하다. (5) Kakao 참여자의 `identity_hash`
    값 컨벤션이 명세에 없었음 → 위 Implementation Preconditions에 추가해 해결.
- Acceptance Criteria: v2 명세(§2~3)와 위 Implementation Preconditions 전체.
  화면 02·03·04·05가 확정 카피 그대로 동작하고, `getAllEdges()`가
  `acquaintance_confirmations` 소스로 바뀌고, `pnpm typecheck` PASS.
- Document Sync Check: 구현과 함께 `01_DB_SCHEMA.md`/`02_API_SPECS.md`에 v2 스키마·
  엔드포인트를 반영한다. HTML 미리보기는 이미 갱신 완료(위 참고).
- Internal CLI: `npx solmate-skills preflight`를 실제로 실행해봤고, 이 프로젝트의
  체크박스 없는 `## TASK-XXX — ...` 백로그 헤딩 형식을 도구가 인식하지 못해
  "Task not found in backlog"로 실패한다 — 네트워크/캐시 문제가 아니라 형식
  불일치다(TASK-001/002에 적힌 ENOTCACHED 설명은 부정확했던 것으로 보이며,
  이 항목이 정확한 원인이다). 독립 Receipt로 계속 대체한다.
- 남은 외부 의존: 카카오 디벨로퍼스 앱 등록 및 `KAKAO_CLIENT_ID`/`KAKAO_CLIENT_SECRET`
  발급은 사용자가 직접 해야 하는 작업이다 — 코드는 환경변수를 참조하는 형태로
  작성하고, 실제 값이 없어도 구현·타입체크는 진행할 수 있다.

## TASK-002 — Invite-graph MVP: 지인 확인 링크가 첫 번째 edge를 만드는 최소 슬라이스
- Work Type: code
- Scope: 계정을 Instagram 없이 생성하는 최소 부트스트랩 + 지인 링크(`pairInvites`) accept가
  실제로 edge를 생성하도록 변경 + 화면 04(지인 확인)·05(연결 완료) 두 화면을 이 흐름에
  연결. 화면 01/02/03/06~12, `referralLinks`(공개 링크) 쪽 화면 재작업은 이번 스코프 밖.
- Related Concept Docs: [Product decisions](../01_Concept_Design/00_PRODUCT_DECISION_LOG.md) 2026-09-13 항목
- Related UI Docs: [Invite-graph concept](../02_UI_Screens/02_INVITE_GRAPH_CONCEPT.md)
- Related HTML Preview: [Invite-graph preview](../02_UI_Screens/previews/02_INVITE_GRAPH_PREVIEW.html) — 12개 화면 확정 시안, 사용자 검토·오타 수정 완료("오타 고쳤어, 이대로 확정하자")
- Related Technical Docs: [Principles](../03_Technical_Specs/00_DEVELOPMENT_PRINCIPLES.md) §1, §3(원칙 5·6), [DB Schema](../03_Technical_Specs/01_DB_SCHEMA.md)(주의: 2026-09-12 이후 코드와 불일치 — `recoveryToken`, `referralLinks`, `referralVisits`가 문서에 없음, 이번 작업에서 같이 갱신), [API Specs](../03_Technical_Specs/02_API_SPECS.md)
- Related QA Docs: N/A - 아직 QA 문서 없음, 구현 후 작성
- Implementation Preconditions:
  - `packages/graph`는 edge 출처에 무관하게 동작하므로 수정하지 않는다(Context Receipt 확인 완료).
  - `pairInvites.status='accepted'` 행 자체를 edge 소스로 재해석한다 — 별도 edge 테이블을
    새로 만들지 않는다(YAGNI, 이미 inviter/recipient/1회성을 다 갖고 있음). 이 결정은
    Context Agent가 낸 두 옵션 중 하나를 Coordinator가 확정한 것이다.
  - `referralLinks`/`referralVisits`는 이름을 바꾸지 않는다 — 이미 edge를 만들지 않는
    "공개 링크" 개념과 1:1로 대응하므로 그대로 재사용한다(Context Receipt Q4 확인 완료).
  - `ig-parser`, `ImportOnboarding`, `UploadFlow`, 기존 `/upload` 경로는 삭제하지 않고
    라우팅만 하지 않는다 — `page.tsx`/`upload/page.tsx`/`ReferralLanding.tsx`가 여전히
    참조하므로 삭제 시 4곳이 깨진다(Context Receipt Q5 확인 완료).
  - 이름·닉네임·프로필 사진 입력 필드는 어디에도 추가하지 않는다.
- Context Receipt:
  - Status: PASS
  - Required References Read: Context agent가 위 Concept/UI/Technical 문서 전부와
    `packages/db`, `packages/graph`, `packages/ig-parser`, `packages/shared`,
    `apps/web`의 invites/pairs/referral 관련 API 라우트 및 lib, 관련 컴포넌트 전체를
    읽었다(2026-09-13). 최초 실행 시 백로그 항목과 HTML 미리보기가 없어 BLOCKED로
    보고됐으나, 이후 이 TASK-002 항목과 위 HTML 미리보기 파일을 만들어 두 조건을
    충족했다.
  - Constraints: `docs/03_Technical_Specs/00_DEVELOPMENT_PRINCIPLES.md` §3 원칙 1-6,
    `AGENTS.md` §1, `02_INVITE_GRAPH_CONCEPT.md`의 카피 원칙과 위치 데이터 원칙.
  - Conflicts: 스키마 접근 방식(새 edge 테이블 vs `pairInvites` 재해석)과 `referralLinks`
    네이밍 유지 여부가 미확정 상태였다 — 위 Implementation Preconditions에서 Coordinator가
    확정했다(둘 다 기존 테이블 재사용, 신규 테이블/리네이밍 없음). 그 외 미해결 충돌 없음.
- Acceptance Criteria:
  - Instagram 업로드 없이 참여자+세션을 생성하는 최소 부트스트랩 경로가 존재한다.
  - 지인 링크(`pairInvites`) accept 시 실제로 edge가 생긴다 — 별도 edge 테이블 없이
    `status='accepted'` 행 자체가 edge 소스가 된다.
  - 그래프 edge 조회(`getAllEdges` 등)가 새 소스를 사용한다. Instagram 맞팔(`follows`)
    기반 로직은 삭제하지 않되 새 그래프 계산에는 관여하지 않는다.
  - 화면 04·05가 [02_INVITE_GRAPH_PREVIEW.html](../02_UI_Screens/previews/02_INVITE_GRAPH_PREVIEW.html)의
    확정 카피와 동일하게 동작한다("이 사람을 알고 있나요?" / "네, 알고 있어요"를
    누르면 즉시 edge 생성 및 연결 완료 화면, 상대 재확인 없음).
  - 이름·닉네임·프로필 사진 입력 필드가 어디에도 없다.
  - 거리 표기는 기존 `distance-copy.ts`의 `distance - 1` = 사람 수 규칙을 그대로 따른다.
  - 기존 `/upload`, `ImportOnboarding`, `ig-parser` 경로는 삭제·변경 없이 그대로 남는다.
  - `01_DB_SCHEMA.md`가 새 edge 소스를 반영해 갱신된다.
  - `pnpm typecheck`(또는 프로젝트의 동등한 명령)가 PASS한다.
- Document Sync Check: `01_DB_SCHEMA.md` §4 갱신 완료. `00_DEVELOPMENT_PRINCIPLES.md` §3.5의
  "재설계 필요" 문구와 깨진 앵커도 갱신 완료된 상태를 가리키도록 함께 고쳤다.
- Internal CLI: 이 환경에서 `npx solmate-skills preflight`가 레지스트리 접근 불가로
  실행되지 않는다(TASK-001과 동일한 기존 제약, ENOTCACHED) — 독립 Receipt로 대체한다.
- Change Receipt:
  - Files Changed: `apps/web/app/api/participants/route.ts`(신규), `apps/web/lib/participants.ts`,
    `apps/web/components/LivePairPage.tsx`, `packages/db/src/schema.ts`(doc-comment만),
    `docs/03_Technical_Specs/01_DB_SCHEMA.md`.
  - Requirements Covered: 위 Acceptance Criteria 전체.
  - Excluded Scope: 화면 01/02/03/06~12, `referralLinks`/`referralVisits`, 이름/닉네임/
    프로필 사진 필드, 새 edge 테이블, 새 npm 의존성 — 전부 손대지 않음.
  - Basic Checks: `pnpm typecheck`(워크스페이스 전체) - PASS. `packages/graph` `vitest run` -
    PASS(7/7, 무관 확인용). `git diff --check` - PASS.
  - Remaining Risks: 화면 05의 "나도 내 연결 시작하기"가 신규 화면이 아니라 기존 `/result`로
    연결됨(범위 밖 화면이라 의도된 것). `02_API_SPECS.md`에 `POST /api/participants` 미기재
    (Document Sync Check가 `01_DB_SCHEMA.md`만 지정해서 범위 밖으로 남겨둠 — 후속 문서
    작업 필요). 동시 더블클릭 시 참여자 중복 생성 가능한 이론적 race는 기존 `acceptInvite`와
    같은 수준으로 남아있음(신규 리스크 아님).
- Verification Receipt:
  - Status: PASS
  - Commands and Results: `pnpm typecheck`(워크스페이스 전체) - PASS. `pnpm --filter
    @gai-ara/graph test` - PASS(7/7). `git diff --stat` 전체 대조 - PASS(아래 참고).
  - Unrun Checks: DB 연동 통합 테스트 - 이 프로젝트에 DB 테스트 하네스가 없어 미실행(기존
    제약, 이번 작업이 만든 gap 아님). `npx solmate-skills verify` - 오프라인 환경 제약으로
    미실행(ENOTCACHED, TASK-001과 동일).
  - Detailed Evidence: 독립 검증에서 최초에 `Brand.tsx`/`ConnectionsList.tsx`/
    `ImportOnboarding.tsx`/`ReferralLanding.tsx`/`ResultScreen.tsx`/`UploadFlow.tsx`/
    `distance-copy.ts`/`globals.css` 변경을 이 작업의 범위 이탈로 지적해 FAIL로
    보고했으나, 재조사 결과 이 8개 파일은 이 세션 시작 시점 git status 스냅샷(첫
    system-reminder, Coordinator의 첫 작업 이전)에 이미 수정 상태였고, Implementation
    Agent의 두 Change Receipt 어디에도 등장하지 않으며, Implementation Agent 본인이
    각 파일별 Read/Edit 호출 이력을 근거로 편집한 적 없다고 확인했다 — 즉 이 세션
    시작 전부터 워킹트리에 있던 별개의 미커밋 변경(TASK-002와 무관)이며, 검증이 "마지막
    커밋 대비 전체 diff"를 이 작업의 diff로 잘못 취급한 방법론적 오류였다. 이 8개 파일은
    건드리지 않고 그대로 남겨뒀다 — 사용자의 이전 별도 작업이므로 Coordinator가 임의로
    되돌리거나 커밋하지 않는다. 나머지 7개 확인 항목(edge 소스, 부트스트랩 API, 화면
    04/05 카피, accept 안전장치, 신규 입력 필드 없음, 문서-코드 일치)은 모두 PASS로
    확인됐다.

## TASK-001 — Referral curious illustration
- Work Type: code
- Scope: approved curious.png teaser image, remove teaser graph, approved heading and CTA.
- Related Concept Docs: [Product decisions](../01_Concept_Design/00_PRODUCT_DECISION_LOG.md)
- Related UI Docs: [Flow](../02_UI_Screens/00_SCREEN_FLOW.md), [Design](../02_UI_Screens/01_UI_DESIGN.md)
- Related HTML Preview: N/A - user reviewed supplied curious.png and explicitly approved narrow image/layout change; full import preview remains pending.
- Related Technical Docs: [Principles](../03_Technical_Specs/00_DEVELOPMENT_PRINCIPLES.md), [API](../03_Technical_Specs/02_API_SPECS.md)
- Related QA Docs: [Verification](../05_QA_Validation/01_REFERRAL_ART_QA.md)
- Implementation Preconditions: preserve unrelated dirty changes, reuse next/image and original PNG, no new dependencies/API/state changes.
- Context Receipt:
  - Status: PASS
  - Required References Read: Context agent read all Concept/UI/Technical links above, AGENTS, README, ReferralLanding and harness; coordinator read local Next image guide. QA report created after verification.
  - Constraints: teaser only; preserve actual results and post-start flow.
  - Conflicts: None
- Acceptance Criteria: initial referral shows two curious characters; no sample graph; responsive 300px illustration; existing results keep actual diagram.
- Document Sync Check: UI documents record only narrow user approval.
- Internal CLI: unavailable offline (solmate-skills ENOTCACHED); independent receipts used, CLI PASS not claimed.
- Change Receipt:
  - Files Changed: ReferralLanding.tsx, globals.css, public/assets/curious.png, narrow UI approval documentation.
  - Requirements Covered: approved illustration/title/CTA; teaser graph removed; later screens preserved.
  - Excluded Scope: broader onboarding redesign.
  - Basic Checks: web typecheck PASS; source/public PNG byte equality PASS.
  - Remaining Risks: browser layout not observed; localhost unavailable.
- Verification Receipt:
  - Status: PASS
  - Commands and Results: web typecheck PASS; git diff --check PASS; PNG equality PASS.
  - Unrun Checks: browser unavailable; offline harness CLI unavailable.
  - Detailed Evidence: [Independent verification](../05_QA_Validation/01_REFERRAL_ART_QA.md)
