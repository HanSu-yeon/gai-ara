# Development Principles
> Created: 2026-09-10 22:30
> Last Updated: 2026-09-10 23:10

이 문서는 "가이 알아?"의 기술 스택 선택 이유와, 모든 하위 설계(DB 스키마, API 명세)가
지켜야 하는 아키텍처 원칙을 정의한다. 이 프로젝트는 개인정보(Instagram 관계 데이터)를
다루므로, Privacy-by-Design 원칙을 다른 모든 기술 결정보다 우선한다.

## 1. Tech Stack 결정

### 1.1 결론

| 영역 | 선택 | 상태 |
| :--- | :--- | :--- |
| Frontend/Backend | Next.js (App Router) + TypeScript | 확정 |
| DB | Turso (libSQL, SQLite 호환) | 확정 (2026-09-10 변경, §1.3) |
| DB 드라이버 | `@libsql/client` + `drizzle-orm/libsql` | 확정 |
| ORM | Drizzle ORM | 확정 |
| ZIP 파싱 | JSZip (브라우저 실행) | 확정 |
| 검증 | Zod | 확정 |
| 배포 | Vercel + Turso Cloud | 제안, 미확정 |

후보로 제시한 Next.js + TypeScript + PostgreSQL 중 DB는 이후 Turso(libSQL)로
변경했다(§1.3). 나머지는 그대로 채택한다. 아래는 각 선택에서 검토한 대안과
기각 이유다.

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

### 1.3 DB: Turso / libSQL (PostgreSQL에서 변경, 그래프 전용 DB는 여전히 사용하지 않음)

**변경 이력**: 최초 후보는 PostgreSQL이었다. 로컬 개발 환경에 Postgres가 없어
Docker로 띄우는 방안을 임시로 마련했으나, 이 프로젝트는 "가벼운 소셜 실험"
규모의 MVP이고 별도 DB 서버 프로세스를 로컬에 띄우는 것 자체가 불필요한 마찰이라고
판단해, 서버 프로세스 없이 파일 하나로 로컬 개발이 되는 **Turso(libSQL, SQLite
호환)**로 변경했다.

**검토한 옵션**:

| 옵션 | 방식 | 로컬 개발 | 성숙도 |
| :--- | :--- | :--- | :--- |
| PostgreSQL | 별도 서버 프로세스 필요 (Docker 등) | 서버 기동 필요 | 매우 성숙 |
| `@libsql/client` + `drizzle-orm/libsql` | 로컬은 `file:./local.db`, 배포는 Turso Cloud(`libsql://...` + authToken) | 서버 없음, 파일 하나 | 안정판, Drizzle 공식 문서 경로 |
| `@tursodatabase/database` | Turso가 Rust로 새로 만든 인프로세스 임베디드 엔진(구 코드명 Limbo) | 서버 없음, Node 프로세스 안에서 직접 구동 | 2026-09 기준 Drizzle 연동 beta |

**결론**: `@libsql/client` + `drizzle-orm/libsql`을 채택한다. 로컬 개발과 프로덕션이
같은 드라이버/스키마 코드를 쓰고, 로컬은 연결 문자열만 `file:./local.db`로 바꾸면
되므로 Docker나 별도 DB 서버가 필요 없다. `@tursodatabase/database`는 더 가볍지만
아직 beta라 MVP 기준선으로 채택하지 않는다 — 안정화되면 재검토한다.

**스키마/그래프 저장 구조에 미치는 영향**: libSQL도 관계형(SQLite 계열) 엔진이므로
[01_DB_SCHEMA.md §4](./01_DB_SCHEMA.md#4-mutual-follow-그래프-저장-구조)의 "관계형
테이블 + 요청 시 인메모리 BFS" 결론은 그대로 유지된다. 바뀐 것은 엔진뿐이고, 바뀌지
않은 것은 그래프를 다루는 방식이다. 타입 매핑 차이(UUID/timestamp/boolean 표현
방식)는 [01_DB_SCHEMA.md §2](./01_DB_SCHEMA.md#2-테이블-정의)에 반영했다.

**남은 실무 작업**: 이전에 PostgreSQL 기준으로 이미 스캐폴딩해 둔 `packages/db`
코드(`pgTable`, `drizzle-orm/postgres-js`)와 `docker-compose.yml`은 이 결정과 더 이상
맞지 않는다. 문서 정리가 끝난 뒤 실제 코드를 `drizzle-orm/sqlite-core` +
`drizzle-orm/libsql` 기준으로 옮기고 `docker-compose.yml`은 제거해야 한다 — 아직
구현 단계로 넘어가지 않았으므로 이번 문서 업데이트에서는 코드를 건드리지 않았다.

### 1.4 ORM: Drizzle (Prisma 대신)

**검토한 대안**: Prisma.

**비교**:
- Prisma: 개발 경험(Prisma Studio, 자동완성)이 좋지만 별도 쿼리 엔진 프로세스와
  런타임 오버헤드가 있고, 원시 SQL에 가까운 세밀한 제어(예: `ON CONFLICT DO UPDATE ...
  RETURNING`을 이용한 upsert-by-natural-key 패턴)가 상대적으로 번거롭다. libSQL/Turso
  지원도 Drizzle 쪽이 더 먼저 자리잡았다.
- Drizzle: SQL에 가까운 타입 우선 API, 런타임 오버헤드가 거의 없음, 마이그레이션이
  일반 SQL 파일로 나와 리뷰하기 쉬움. Identity Hash처럼 unique 제약과 조건부 upsert가
  중요한 스키마([01_DB_SCHEMA.md](./01_DB_SCHEMA.md))에 더 적합하고, libSQL/Turso를
  위한 전용 `dialect: "turso"` 설정을 `drizzle-kit`이 공식 지원한다.

**결론**: Drizzle을 사용한다. `drizzle.config.ts`는 `dialect: "turso"`,
`dbCredentials: { url, authToken }`로 구성하고, 로컬 개발은 `authToken` 없이
`url: "file:./local.db"`만 지정한다.

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
packages/ig-parser   ZIP/JSON 파싱 + mutual 계산 (순수 함수, 브라우저/Node 겸용)
packages/graph       그래프 빌드 + BFS + 통계 (순수 함수, DB/UI 의존성 없음)
packages/db          Drizzle 스키마 + libSQL(Turso) 클라이언트
packages/shared      Zod 스키마 (API 요청/응답 타입)
```

**분리 원칙**: `ig-parser`와 `graph`는 어떤 형태로든 "이 값이 Instagram username이다"
또는 "이 값이 어떤 사람이다"라는 것을 알지 못한다 — `ig-parser`는 정규화된 문자열만,
`graph`는 불투명한 노드 ID(UUID 문자열)만 다룬다. 신원과 관련된 모든 지식(정규화 규칙
적용 후 해싱, 세션-참여자 매핑)은 `apps/web`의 서버 전용 코드에만 존재한다. 이렇게
분리해두면, 이후 식별자 매칭 방식을 강화하더라도(§3.2 참고) `graph`/`ig-parser`는
전혀 손댈 필요가 없다.

## 3. Privacy-by-Design 원칙

아래 5가지는 이 프로젝트의 다른 모든 기술 결정보다 우선하는 아키텍처 원칙이다. 각
원칙이 실제로 어디에서 강제되는지는 [01_DB_SCHEMA.md](./01_DB_SCHEMA.md)와
[02_API_SPECS.md](./02_API_SPECS.md)에서 구체적으로 다룬다.

1. **원본 데이터는 브라우저를 벗어나지 않는다.** ZIP 파일과 followers/following 원본
   목록은 서버로 전송하지 않는다. 서버는 클라이언트가 계산한 mutual 목록만 받는다.
2. **평문 username을 저장하지 않는다.** 저장되는 모든 식별자는 서버 전용 비밀(pepper)이
   섞인 해시다. 이 해시가 "익명"이 아니라 "가명"이라는 점(운영자는 여전히 역추적
   가능)을 모든 설계 문서와 개인정보처리방침에 명시한다.
3. **검색 가능한 조회 API를 만들지 않는다.** "이 아이디의 해시/존재 여부"를 알려주는
   범용 엔드포인트를 두지 않는다. 특정 계정을 검색하는 기능을 만들지 않는다는 제품
   원칙(기획서 6장)을 API 설계로도 강제한다.
4. **경로가 아니라 거리만 계산하고 반환한다.** 두 참여자 사이의 중간 연결자는 어떤
   API 응답에도, 어떤 내부 함수 시그니처에도 등장할 수 없게 만든다.
5. **최소 그래프만 저장한다.** followers/following 전체가 아니라 맞팔(mutual)만
   edge로 저장한다.

## 4. 성능/UX 목표

- 개인 결과 조회(`GET /api/me/result`)와 페어 결과 조회(`GET /api/pairs/:token/result`)는
  MVP 규모(참여자 수천~수만, edge 수만~십만)에서 P95 400ms 이내 응답을 목표로 한다
  (365 Principle의 UX 루브릭 기준을 그대로 채택).
- ZIP 파싱은 전부 클라이언트에서 일어나므로 서버 응답 시간에 포함되지 않지만, 사용자
  체감 대기 시간(파싱 + 업로드)에 대한 로딩 상태 UI가 필요하다 — UI_Screens 레이어에서
  다룬다.

## 5. 미해결 사항 ([TODO])

- **[TODO][High]** 참여자 정의 확정: "그래프에 노드로 등장한 모든 사람" vs "실제로
  업로드를 완료한 사람"만 통계에 포함할지. [01_DB_SCHEMA.md §3.3](./01_DB_SCHEMA.md#33-ghost-노드와-참여자-정의-미해결)
  참고.
- **[TODO][Medium]** Turso Cloud 프로젝트/리전 확정 (배포 대상). 이 문서의 다른
  결정에 영향을 주지 않으므로 구현 착수와 별개로 진행 가능.
- **[TODO][High]** 기존에 PostgreSQL 기준으로 스캐폴딩된 `packages/db`,
  `docker-compose.yml`을 libSQL 기준으로 마이그레이션 (§1.3 "남은 실무 작업").
  구현 단계로 넘어갈 때 가장 먼저 처리한다.
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
