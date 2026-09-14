# AGENTS.md — 가이 알아? (Gai Ara)

> 이 파일은 이 저장소에서 작업하는 모든 AI 코딩 툴(Claude Code, Cursor, Codex, Copilot 등)이
> 코드를 건드리기 전에 **무조건 먼저 읽어야 하는 최상위 준칙**이다. 아래 내용은
> `.agent/skills/`(solmate-skills)의 각 SKILL.md가 이미 이 파일을 전제로 참조하고 있으므로,
> 이 파일 없이는 해당 스킬들의 게이트(Context Receipt, Verification Receipt 등)가 정상 동작하지 않는다.

## 0. 프로젝트 배경

"가이 알아?" — 제주에서 우리는 몇 다리 건너 연결되어 있을까? 카카오 로그인으로
사용자를 식별하고, 지인 전용 초대 링크로 직접 확인된 관계(`invite_confirmed`)와
Instagram 맞팔(`instagram_mutual`, followers ∩ following만 인정) 두 source를
그래프의 edge로 인정하는 소셜 그래프 실험 서비스다. Instagram 맞팔은 2026-09-13
결정으로 한 차례 MVP에서 제외됐다가 2026-09-14 결정으로 재도입되어, 지인 확인
edge와 함께 하나의 그래프에서 쓰인다 — 근거는
[docs/01_Concept_Design/00_PRODUCT_DECISION_LOG.md](./docs/01_Concept_Design/00_PRODUCT_DECISION_LOG.md)의
2026-09-14 항목 참고.

**2026-09-15 핵심 제품 모델 — 협업형 챌린지(최종, 이전의 개인 Path Check 설계를
대체함).** 이 서비스의 핵심은 "나는 특정 대상까지 몇 다리인지 개인적으로 조회하는
것"이 아니라 "여러 사람이 각자 아는 관계를 조금씩 보태서, 궁금한 대상까지 실제로
이어지는 길을 함께 찾아가는 챌린지"다. 사용자가 `/create`에서 이름 + Instagram
아이디로 대상을 지정해 챌린지(`target_challenges`)를 만들면, 그 대상은 반드시
연예인일 필요 없이 "궁금한 사람"이면 누구든 될 수 있다(유명인 DB를 운영하지
않는다). 공유 가능한 `/t/{token}` 화면은 뷰어 개인의 결과가 아니라 챌린지 전체의
공동 진행 상황("아직 찾는 중" / "N다리의 길 발견")을 보여준다. "나도 연결
보태기" 버튼을 눌러 명시적으로 참여한 participant(`challenge_participants`
start-set, page view만으로는 참여로 세지 않는다)에서 출발해, 이미 존재하는 전역
trusted graph(`getAllEdges()` — 아래 두 edge source, 다른 규칙 추가 없음) 전체를
거쳐 대상까지 닿는 최단 경로를 발견할 수 있는지 계산한다(`computeChallengeProgress`,
`apps/web/lib/graph-service.ts`). 중간 노드가 이 챌린지에 참여했을 필요는 없다 —
이미 검증된 관계를 인위적으로 막지 않는다. 특정 대상에게 닿기 위해 edge 판정
규칙을 느슨하게 만들지 않는다: 대상에 따라 쉽게 발견되거나, 많이 참여해야
발견되거나, 끝내 발견되지 않을 수도 있다는 난이도 차이 자체가 챌린지의 재미다.
공개 결과 화면에서는 전체 그래프를 시각화하지 않고, 중간 경로의 identity(시작점
포함)도 전부 익명화한다 — 근거는
[docs/01_Concept_Design/00_PRODUCT_DECISION_LOG.md](./docs/01_Concept_Design/00_PRODUCT_DECISION_LOG.md)의
2026-09-15 "협업형 챌린지" 항목 참고. 기존 `/result`(자기중심 미니 그래프)·`/r`(개인
거리 확인 공유 링크)은 삭제하지 않고 보존하되, 메인 사용자 여정에서는 `/create` →
`/t/{token}`이 대신한다.

전체 소개와
아키텍처 요약은 [README.md](./README.md)를, 기술 스택 선택 이유와 트레이드오프는
[docs/03_Technical_Specs/00_DEVELOPMENT_PRINCIPLES.md](./docs/03_Technical_Specs/00_DEVELOPMENT_PRINCIPLES.md)를 먼저 읽는다.

```
apps/web/       Next.js (App Router) — UI + API Route
packages/graph/      그래프 빌드 + BFS + 통계 (프레임워크/DB 의존성 없음)
packages/db/         Drizzle ORM 스키마 + PostgreSQL(postgres-js) 클라이언트
packages/shared/     Zod 스키마 (API 요청/응답 타입)
packages/ig-parser/  Instagram export(ZIP) 파싱 + 맞팔(followers ∩ following) 계산
                     (브라우저 전용, 프레임워크/DB 의존성 없음. 2026-09-14 재도입)
```

## 1. Privacy-by-Design — 다른 모든 결정보다 우선

이 프로젝트는 개인정보(Instagram 관계 데이터)를 다룬다. 아래 원칙은 다른 어떤 기술적
편의보다 우선하며, 상세 근거는 `00_DEVELOPMENT_PRINCIPLES.md` §3 참고.

1. 원본 ZIP 파일은 서버로 전송하지 않는다 — 파싱은 브라우저에서 끝낸다.
2. 평문 username을 저장하지 않는다 — 서버 전용 pepper가 섞인 해시만 저장한다.
3. 외부 Instagram 계정을 탐색·검색·열거할 수 있는 API는 만들지 않는다.
   단, 사용자가 정확한 username을 직접 알고 입력한 경우에 한해 그
   username을 즉시 비가역 HMAC identity로 변환하고, 그 identity를 대상으로
   opaque token 기반의 공유 가능한 "타겟 챌린지"(`target_challenges`)를
   만드는 것은 허용한다(2026-09-14 결정으로 도입, 2026-09-15 결정으로
   "뷰어 개인 기준 경로 확인"이 아니라 "챌린지 전체의 공동 진행 상황" 모델로
   최종 확정 — `docs/01_Concept_Design/00_PRODUCT_DECISION_LOG.md`의
   "Path Check를 공유형 '타겟 챌린지'로 확장", "협업형 챌린지" 항목 참고).
   뷰어 한 명의 개인 경로를 확인하는 엔드포인트(`POST
   /api/challenges/{token}/check`, `connected`/`not_connected` 응답)는
   설계 단계에 머물렀고 구현하지 않는다 — 실제로 구현된 것은 챌린지
   생성(`POST /api/challenges`)·공개 조회+진행상황(`GET
   /api/challenges/{token}`, `searching`/`found` 두 상태)·참여
   등록(`POST /api/challenges/{token}/join`) 세 엔드포인트뿐이다. 이 과정에서
   계정 존재 여부·가입 여부·외부 계정 목록·challenge start-set 참여자
   목록은 어떤 응답에도 노출하지 않는다. 사람을 찾아내는 디렉터리·자동완성·
   prefix 검색·전체/인기 계정 목록·challenge 전체 목록/탐색 API는 이
   허용 범위에 포함되지 않으며 여전히 금지한다.
   **단 하나의 예외**(2026-09-15 "홈 공개 챌린지 목록" 결정): 운영자가
   `target_challenges.is_public`을 직접 켠 챌린지만 `/challenges` 한
   화면에서 보여준다. 홈과 헤더(`BrandHeader`의 "챌린지 구경")에는 그
   화면으로 들어가는 버튼만 두고 목록을 직접 그리지 않으며, `/create`에는
   목록을 노출하지 않는다. 기본값은
   false이고 사용자용 공개 설정 UI는 만들지 않으므로, 사용자가 만든
   일반인 대상 챌린지가 자동으로 목록에 오를 경로는 없다. 이 목록을
   내보내는 공개 API 라우트도 만들지 않는다 — 서버 컴포넌트가 DB를 직접
   읽는다. 검색·필터·카테고리·랭킹·무한스크롤·target 자동완성은 이
   예외에 포함되지 않으며 여전히 금지한다.
4. 두 사람 사이의 "거리"만 반환하고, 중간 경로(연결자)는 어떤 응답에도 노출하지 않는다.
5. 그래프의 edge는 두 source만 인정한다: (a) 지인 전용 초대 링크를 통해 상대가
   직접 "아는 사이"라고 확인한 관계(`acquaintance_confirmations`), (b) 본인이
   Instagram export에서 계산한 맞팔(followers ∩ following, `follows` 테이블) 중
   상대도 자기 계정을 연동한 실제 참여자인 관계. Instagram의 following 전체나
   일방적 팔로우는 절대 edge로 쓰지 않는다 — 반드시 교집합(맞팔)까지 계산한
   결과만 쓴다(2026-09-13 결정으로 한 차례 제외됐다가 2026-09-14 이 조건으로
   재도입). 공개(탐색) 링크 방문은 몇 명이 방문하든 edge를 만들지 않는다 —
   방문 그래프와 인맥 그래프를 섞지 않는다. MVP에서는 두 edge source를 shortest
   path 계산에서 구분하지 않는다(`apps/web/lib/participants.ts`의 `getAllEdges`
   참고). 상세 근거는 `docs/01_Concept_Design/00_PRODUCT_DECISION_LOG.md`의
   2026-09-13 항목(edge 정의 최초 전환)과 2026-09-14 항목(두 source 통합 재도입,
   "섞지 않는다" 조항 폐기) 참고.
6. 정확한 위치(GPS, 주소)는 수집·저장하지 않는다. "연결된 세상" 시각화용으로는
   국가+도시 단위까지만 선택적으로 받고, 첫 진입이나 가입 과정에는 절대 끼워
   넣지 않는다(관계 하나가 생긴 직후에만 한 번 제안). 관계 데이터와 정밀 위치
   데이터의 결합은 다른 원칙과 동급으로 민감하게 다룬다. 상세는
   `docs/02_UI_Screens/02_INVITE_GRAPH_CONCEPT.md`의 "위치 데이터 원칙" 참고.

## 2. 문서 구조 (5-Layer)

| 계층 | 폴더 | 현재 상태 |
| :-- | :-- | :-- |
| 1 Concept_Design | `docs/01_Concept_Design/` | `00_PRODUCT_DECISION_LOG.md` |
| 2 UI_Screens | `docs/02_UI_Screens/` | 화면 에셋만 존재, 문서화 진행 중 |
| 3 Technical_Specs | `docs/03_Technical_Specs/` | 개발 원칙 / DB 스키마 / API 명세 |
| 4 Logic_Progress | `docs/04_Logic_Progress/` | 미생성 |
| 5 QA_Validation | `docs/05_QA_Validation/` | 미생성 |

코드/설계를 바꾸기 전에 관련 계층 문서(특히 3장 기술 문서)를 먼저 확인하고, 결정이 바뀌면
해당 문서를 함께 갱신한다. 문서 규칙 상세는 `.agent/skills/rules-docs/SKILL.md` 참고.

## 3. 코딩 컨벤션

- **검증**: 입력값 검증은 Zod (`packages/shared`의 스키마 우선 재사용).
- **날짜/시간**: Luxon 사용.
- **타입**: `any` 지양, strict 타입 유지.
- **최소 구현**: YAGNI/KISS/DRY — 현재 요구사항에 없는 추상화·의존성·설정을 미리 추가하지 않는다
  (정본: `.agent/skills/rules-dev/SKILL.md`).
- **DB**: 파괴적 마이그레이션/스키마 변경 전 반드시 백업. `DROP TABLE`, `migrate reset` 등은
  백업 확인 없이 실행하지 않는다.
- **커밋 메시지**: 영어, 명령형 짧은 제목(예: `Add reusable referral link`, `Fix confusing unreachable-result flow`).
  자명하지 않은 변경은 본문에 "왜"를 설명한다(`git log`가 정본 — `type(scope):` 접두사나
  한글 커밋 메시지는 이 프로젝트 관행이 아니다).
- **소통 톤**: 이모지 금지. 전문적이고 명확한 텍스트로만 소통한다.

## 4. 작업 워크플로우

기능 구현이나 PR 준비는 `.agent/skills/rules-workflow/SKILL.md`의 18단계 워크플로우를 따른다.
어디서 시작할지 모르겠으면 `rules-product`가 진입점이다. 전체 스킬 목록과 사용법은
[USAGE.md](./USAGE.md) 참고. `code`/`deploy` 작업은 Context Receipt 없이 구현을 시작하지
않고, Verification Receipt(PASS) 없이 Done/PR/merge/deploy로 넘어가지 않는다
(`.agent/skills/rules-workflow/resources/agent-harness-contract.md` 정본).

## 5. 다른 문서와의 우선순위

이 파일과 `docs/03_Technical_Specs/00_DEVELOPMENT_PRINCIPLES.md`가 충돌하면 프로젝트
고유 결정이 담긴 `00_DEVELOPMENT_PRINCIPLES.md`가 우선한다. `.agent/skills/*/SKILL.md`는
범용 기본값이며, 이 파일이나 `docs/`에 프로젝트별 규칙이 있으면 그쪽이 우선한다.
