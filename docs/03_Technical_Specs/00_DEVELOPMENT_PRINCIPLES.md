# Development Principles
> Created: 2026-09-10 22:30
> Last Updated: 2026-09-13

이 문서는 "가이 알아?"의 기술 스택 선택 이유와, 모든 하위 설계(DB 스키마, API 명세)가
지켜야 하는 아키텍처 원칙을 정의한다. 이 프로젝트는 개인정보(Instagram 관계 데이터)를
다루므로, Privacy-by-Design 원칙을 다른 모든 기술 결정보다 우선한다.

## 1. Tech Stack 결정

### 1.1 결론

| 영역 | 선택 | 상태 |
| :--- | :--- | :--- |
| Frontend/Backend | Next.js (App Router) + TypeScript | 확정 |
| DB | PostgreSQL | 확정 (2026-09-11 재확정, §1.3) |
| DB 드라이버 | `postgres` (postgres-js) + `drizzle-orm/postgres-js` | 확정 |
| ORM | Drizzle ORM | 확정 |
| ZIP 파싱 | JSZip (브라우저 실행) | 확정 |
| 검증 | Zod | 확정 |
| 배포 | Vercel + 관리형 Postgres(예: Neon) | 제안, 미확정 |

Next.js + TypeScript + PostgreSQL을 그대로 채택한다. 중간에 Turso(libSQL)로
바꾸는 걸 검토했다가 다시 PostgreSQL로 되돌린 경위는 §1.3에 남긴다. 아래는 각
선택에서 검토한 대안과 기각 이유다.

### 1.2 Frontend/Backend: Next.js (분리하지 않음)

**검토한 대안**: 별도 프론트엔드(Vite+React SPA) + 별도 백엔드(Fastify/NestJS).

**기각 이유**: 이 서비스는 세션 쿠키 기반의 단일 도메인 인증만 필요하고(로그인/회원가입
없음), 클라이언트 종류도 모바일 웹 하나뿐이다. 별도 배포하면 CORS, 쿠키 SameSite 설정,
타입 계약 동기화(OpenAPI/tRPC 등) 같은 순수 오버헤드만 늘어나고 얻는 이점이 없다.
"유지보수하기 쉬운 구조"라는 우선순위와 정면으로 배치된다. Next.js API Route로
프론트/백엔드를 한 배포 단위로 유지한다.

**재검토 조건**: 이후 네이티브 앱이나 제3자 연동이 생겨 API를 별도 클라이언트에
공개해야 할 때 재검토한다. 이번 기획서(14장)는 명시적으로 네이티브 앱을 MVP 범위에서
제외했으므로 현재는 해당하지 않는다.

### 1.3 DB: PostgreSQL (Turso/libSQL 검토했다가 되돌림, 그래프 전용 DB는 여전히 사용하지 않음)

**변경 이력**: 최초 후보는 PostgreSQL이었다. 한때 "로컬에 Postgres가 없으면
Docker로 띄워야 하는 마찰"을 이유로 서버 프로세스 없이 파일 하나로 도는
Turso(libSQL, SQLite 호환)로 바꾸는 걸 검토했었다. 하지만 실제로 `docker-compose.yml`
로 로컬 Postgres를 띄우고 업로드→초대→페어 결과 전체 플로우를 검증해보니
그 마찰은 실재하지 않았고(`docker compose up -d` 한 줄이면 끝), 아래 이유로
PostgreSQL을 그대로 유지하기로 재확정했다.

**PostgreSQL을 유지하는 이유**:

1. **이 워크로드는 SQLite/libSQL의 장점을 못 쓴다.** [01_DB_SCHEMA.md §4](./01_DB_SCHEMA.md#4-mutual-follow-그래프-저장-구조)의
   결론대로 그래프 순회는 DB 안이 아니라 요청마다 애플리케이션 메모리에서
   BFS로 처리한다. DB는 그냥 `follows` 테이블을 조인해서 읽어오는 용도라,
   Turso가 강점인 엣지 근접 저지연 읽기 같은 특성이 체감될 지점이 없다.
2. **마이그레이션 비용 대비 얻는 기능적 이득이 없다.** `schema.ts`(pg-core →
   sqlite-core), `client.ts`(postgres-js → libsql), `drizzle.config.ts`를 전부
   다시 써야 하는데, 얻는 게 없다.
3. **확장 경로가 더 넓다.** 그래프 연산이 복잡해지는 시점이 오면 PostgreSQL은
   Apache AGE 같은 인그래프 확장으로 갈 수 있지만, libSQL 계열에는 대응하는
   확장이 없어 결국 전용 그래프 DB(Neo4j 등)로 바로 건너뛰어야 한다
   ([01_DB_SCHEMA.md §4.3](./01_DB_SCHEMA.md#43-스케일-전환-계획-지금-만들지-않음)).
4. **배포 시 "서버 관리 없는 DB"라는 이점은 Turso만의 것이 아니다.** Neon 같은
   서버리스 PostgreSQL이 scale-to-zero와 넉넉한 무료 티어로 같은 이점을 엔진을
   바꾸지 않고도 준다.

**결론**: `postgres`(postgres-js) + `drizzle-orm/postgres-js`를 유지한다. 로컬
개발은 `docker-compose.yml`의 Postgres 컨테이너를 쓰고, 배포는 Vercel + 관리형
Postgres(Neon 등 후보, 미확정)를 검토한다.

**스키마/그래프 저장 구조에 미치는 영향**: 없음 — 엔진을 바꾸지 않기로 했으므로
`packages/db`의 `pgTable` 기반 스키마와 [01_DB_SCHEMA.md §2](./01_DB_SCHEMA.md#2-테이블-정의)의
PostgreSQL 타입(uuid/timestamptz/boolean)이 그대로 정본이다.

### 1.4 ORM: Drizzle (Prisma 대신)

**검토한 대안**: Prisma.

**비교**:
- Prisma: 개발 경험(Prisma Studio, 자동완성)이 좋지만 별도 쿼리 엔진 프로세스와
  런타임 오버헤드가 있고, 원시 SQL에 가까운 세밀한 제어(예: `ON CONFLICT DO UPDATE ...
  RETURNING`을 이용한 upsert-by-natural-key 패턴)가 상대적으로 번거롭다.
- Drizzle: SQL에 가까운 타입 우선 API, 런타임 오버헤드가 거의 없음, 마이그레이션이
  일반 SQL 파일로 나와 리뷰하기 쉬움. Identity Hash처럼 unique 제약과 조건부 upsert가
  중요한 스키마([01_DB_SCHEMA.md](./01_DB_SCHEMA.md))에 더 적합하다.

**결론**: Drizzle을 사용한다. `drizzle.config.ts`는 `dialect: "postgresql"`,
`dbCredentials: { url }`로 구성한다 (`DATABASE_URL`, 로컬은
`docker-compose.yml`의 Postgres 컨테이너를 가리킨다).

### 1.5 인증/세션

로그인(이메일/비밀번호, OAuth) 없이 참여 가능해야 하므로, 전통적인 인증 시스템을
두지 않는다. 대신 참여(업로드) 완료 시 서버가 발급하는 opaque 세션 토큰을 httpOnly
쿠키로 내려주고, `sessions` 테이블에서 `participant_id`로 매핑한다
([01_DB_SCHEMA.md §2](./01_DB_SCHEMA.md#2-테이블-정의)).

**트레이드오프**: 쿠키를 잃으면(기기 변경, 브라우저 데이터 삭제) "내 결과 다시 보기"에
접근할 수 없다. 이메일 등 복구 수단을 두지 않는 것은 실수가 아니라 의도된 선택이다 —
이메일을 수집하면 개인정보 최소 수집 원칙(기획서 9장)에 새로운 예외를 만들게 된다.
MVP에서는 이 한계를 받아들이고, 필요해지면 "복구 코드 다운로드" 같은 무-신원 기반
복구 수단을 별도로 설계한다.

## 2. 아키텍처 개요

pnpm 모노레포로 핵심 로직을 프레임워크에서 분리한다.

```text
apps/web        Next.js — UI + API Route (서버 전용 코드: 세션, 해싱, DB 접근)
packages/ig-parser   ZIP/JSON 파싱 + following 목록 추출 (순수 함수, 브라우저/Node 겸용)
packages/graph       그래프 빌드 + BFS + 통계 (순수 함수, DB/UI 의존성 없음)
packages/db          Drizzle 스키마 + PostgreSQL(postgres-js) 클라이언트
packages/shared      Zod 스키마 (API 요청/응답 타입)
```

**분리 원칙**: `ig-parser`와 `graph`는 어떤 형태로든 "이 값이 Instagram username이다"
또는 "이 값이 어떤 사람이다"라는 것을 알지 못한다 — `ig-parser`는 정규화된 문자열만,
`graph`는 불투명한 노드 ID(UUID 문자열)만 다룬다. 신원과 관련된 모든 지식(정규화 규칙
적용 후 해싱, 세션-참여자 매핑)은 `apps/web`의 서버 전용 코드에만 존재한다. 이렇게
분리해두면, 이후 식별자 매칭 방식을 강화하더라도(§3.2 참고) `graph`/`ig-parser`는
전혀 손댈 필요가 없다.

## 3. Privacy-by-Design 원칙

아래 6가지는 이 프로젝트의 다른 모든 기술 결정보다 우선하는 아키텍처 원칙이다. 각
원칙이 실제로 어디에서 강제되는지는 [01_DB_SCHEMA.md](./01_DB_SCHEMA.md)와
[02_API_SPECS.md](./02_API_SPECS.md)에서 구체적으로 다룬다.

1. **원본 데이터는 브라우저를 벗어나지 않는다.** ZIP 파일 자체는 서버로 전송하지
   않는다. 서버는 클라이언트가 뽑아낸 following 목록만 받는다 — followers는
   애초에 요청하지도 않는다(§ 5 참고).
2. **평문 username을 저장하지 않는다.** 저장되는 모든 식별자는 서버 전용 비밀(pepper)이
   섞인 해시다. 이 해시가 "익명"이 아니라 "가명"이라는 점(운영자는 여전히 역추적
   가능)을 모든 설계 문서와 개인정보처리방침에 명시한다.
3. **외부 계정을 탐색·검색·열거하는 API는 만들지 않는다 — 단, 정확한
   username 직접 입력 → HMAC 변환 → 본인 경로 확인/공유형 챌린지 생성은
   예외로 허용한다.** "이 아이디의 해시/존재 여부"를 알려주는 범용
   엔드포인트를 두지 않는다는 원칙은 유지한다. 2026-09-14 결정(개인용 →
   공유형 "타겟 챌린지"로 확장)으로, 로그인 사용자가 정확히 아는 Instagram
   username을 직접 입력하면 서버가 즉시 해싱해서 (a) "나와 이어지는 길이
   있는가"를 바로 확인하거나 (b) 그 대상을 opaque token 기반 공유
   challenge(`target_challenges`)로 만들 수 있다 — 어느 쪽이든 응답은
   `connected`/`not_connected` 두 상태로만 합쳐서, 대상의 존재 여부·가입
   여부 자체는 노출하지 않는다. 사람을 찾아내는 디렉터리, 자동완성, prefix
   검색, 전체 계정 목록, 인기 계정 목록, challenge 전체 목록/탐색 API는
   이 예외에 포함되지 않으며 여전히 금지한다. 상세 계약은
   [02_API_SPECS.md §8](./02_API_SPECS.md#8-path-check-타겟-챌린지--username을-정확히-아는-경우에만-거리-확인-설계-확정-미구현)
   참고.
4. **경로가 아니라 거리만 계산하고 반환한다.** 두 참여자 사이의 중간 연결자는 어떤
   API 응답에도, 어떤 내부 함수 시그니처에도 등장할 수 없게 만든다.
5. **그래프의 edge는 두 source를 함께 쓴다.** (a) 지인 전용 초대 링크로 상대가
   직접 "아는 사이"라고 확인한 관계(`acquaintance_confirmations`), (b) 본인이
   Instagram export에서 계산한 맞팔(followers ∩ following, `follows` 테이블) 중
   상대도 자기 계정을 연동한 실제 참여자인 관계. 일방적 팔로우/팔로잉은 절대 edge로
   쓰지 않는다. 공개(탐색) 링크 방문은 몇 명이 방문하든 edge를 만들지 않는다 —
   방문 그래프와 인맥 그래프를 섞지 않는다. Instagram 맞팔은 2026-09-13 결정으로
   한 차례 제외됐다가 2026-09-14 결정으로 재도입됐다 — "두 edge source를 하나의
   그래프에 섞지 않는다"는 2026-09-13 재검토 조건은 2026-09-14 결정으로 폐기·대체
   됐다(MVP에서는 두 source를 shortest path 계산에서 구분하지 않는다). 근거는
   [00_PRODUCT_DECISION_LOG.md](../01_Concept_Design/00_PRODUCT_DECISION_LOG.md)의
   2026-09-13, 2026-09-14 항목 참고. 그래프 저장 구조 문서(`01_DB_SCHEMA.md` §3-4)는
   아직 이 결정을 반영하지 못했다 — `pair_invites`를 활성 edge 소스로, `follows`를
   비활성으로 설명하는 부분이 현재 스키마와 맞지 않으며, 별도 재작성이 필요하다.
6. **정확한 위치(GPS, 주소)는 수집·저장하지 않는다.** "연결된 세상" 시각화용으로
   국가+도시 단위까지만 선택적으로 받고, 같은 도시의 사용자는 실제 좌표가 아니라
   도시 영역 안에서 시각적으로 흩뿌려 표시한다. 가입/첫 진입 과정에는 묻지 않고,
   관계 하나가 확정된 직후에만 한 번 제안한다(스킵 가능). 관계 데이터와 정밀 위치
   데이터의 결합은 다른 원칙과 동급으로 민감하게 다룬다. 상세는
   [02_INVITE_GRAPH_CONCEPT.md](../02_UI_Screens/02_INVITE_GRAPH_CONCEPT.md)의
   "위치 데이터 원칙" 참고.

## 4. 성능/UX 목표

- 개인 결과 조회(`GET /api/me/result`)와 페어 결과 조회(`GET /api/pairs/:token/result`)는
  MVP 규모(참여자 수천~수만, edge 수만~십만)에서 P95 400ms 이내 응답을 목표로 한다
  (365 Principle의 UX 루브릭 기준을 그대로 채택).
- ZIP 파싱은 전부 클라이언트에서 일어나므로 서버 응답 시간에 포함되지 않지만, 사용자
  체감 대기 시간(파싱 + 업로드)에 대한 로딩 상태 UI가 필요하다 — UI_Screens 레이어에서
  다룬다.

## 5. 미해결 사항 ([TODO])

- **[해결됨]** ~~참여자 정의 확정~~ — participant-only 그래프 모델로 전환하면서
  저절로 해결됨: 그래프에 노드로 등장하는 사람 = 실제로 업로드를 완료한 사람이
  항상 같다(고스트 노드가 없음). [01_DB_SCHEMA.md §3.6](./01_DB_SCHEMA.md#36-ghost-노드와-참여자-정의-해결됨--애초에-고스트-노드를-만들지-않기로-함)
  참고.
- **[TODO][Medium]** 배포용 관리형 PostgreSQL 프로바이더 확정(Neon 등 후보,
  §1.3). 이 문서의 다른 결정에 영향을 주지 않으므로 구현 착수와 별개로 진행 가능.
- **[TODO][Medium]** `IDENTITY_PEPPER` 회전 절차. 현재는 "최초 설정 후 바꾸지 않는다"가
  기본 가정이다.
- **[TODO][Low]** 세션 쿠키 분실 시 복구 수단 (§1.5).

## 6. Related Documents

- **Concept_Design**: N/A - Concept_Design 레이어 문서가 아직 작성되지 않음. 현재
  이 문서의 제품 근거는 사용자가 채팅으로 공유한 최초 서비스 기획서이며, `docs-plan`
  스킬로 추후 `01_Concept_Design/03_PRODUCT_SPECS.md`에 정리할 예정.
- **UI_Screens**: N/A - UI 디자인이 별도로 진행 중이며 아직 문서화되지 않음. 화면
  디자인이 나오면 `02_UI_Screens/`에 연결한다.
- **Technical_Specs**: [DB Schema](./01_DB_SCHEMA.md) - 식별자 해싱과 그래프 저장
  구조의 상세 설계
- **Technical_Specs**: [API Specs](./02_API_SPECS.md) - ZIP 파싱 계약과 초대/consent
  플로우 엔드포인트 명세
