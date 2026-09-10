# 가이 알아? (Gai Ara)

제주에서 우리는 몇 다리 건너 연결되어 있을까? — Instagram 맞팔 데이터를 이용한 소셜 그래프 실험.

## 아키텍처 요약

pnpm 워크스페이스 모노레포. 핵심 로직(ZIP 파싱, 그래프 계산)을 UI/DB에서 완전히
분리된 순수 TypeScript 패키지로 만들어서, 프레임워크 없이 유닛 테스트하고
나중에 다른 런타임(모바일 앱, 배치 잡 등)에서도 재사용할 수 있게 했다.

```
apps/
  web/            Next.js (App Router) — 랜딩/업로드/결과/공유 UI + API Route
packages/
  ig-parser/      Instagram ZIP/JSON 파싱 + mutual follow 계산 (브라우저/Node 겸용, 순수 함수)
  graph/          그래프 빌드 + BFS 최단거리 + 통계 (프레임워크/DB 의존성 없음)
  db/             Drizzle ORM 스키마 + PostgreSQL 클라이언트
  shared/         zod 스키마 / API 타입
```

- **Frontend/Backend**: Next.js 16 + React 19 + TypeScript. 모바일 웹 하나로
  프론트와 API Route(백엔드)를 같이 가져가서 초기 유지보수 비용을 최소화했다.
- **스타일**: Tailwind CSS 4 (`apps/web/app/globals.css`의 `@theme`에 브랜드
  팔레트 토큰 정의).
- **DB**: PostgreSQL + Drizzle ORM (스펙 10장 권장대로 별도 그래프 DB 없이 시작).
- **ZIP 파싱**: JSZip, 브라우저에서 실행 (서버로 원본 데이터를 보내지 않기 위해).
- **검증**: Vitest (`ig-parser`, `graph` 패키지에 핵심 로직 단위 테스트).

## 개인정보/보안 설계에서 반드시 지킬 것

기획서 9장이 요구한 "identifier matching과 privacy architecture 별도 설계"에
대한 결론이다. 아래는 스캐폴딩 단계에서 코드로 강제해 둔 것과, 아직 안 됐지만
운영 전 반드시 처리해야 하는 것을 나눈 목록이다.

### 이번 스캐폴딩에 반영한 것

1. **`SHA256(username)` 단독 사용 금지.**
   `apps/web/lib/identity.ts`는 `HMAC-SHA256(normalize(username), IDENTITY_PEPPER)`를
   쓴다. pepper 없는 단순 해시는 흔한 아이디 사전으로 오프라인 역추적이
   가능하므로 기획서가 지적한 문제를 그대로 남겨둔다. pepper는 서버 환경
   변수로만 존재하고 클라이언트에는 절대 내려가지 않는다.
   - 단, 이 방식은 "가명처리"이지 "익명화"가 아니다. **운영자 자신은**
     pepper를 알고 있으므로 후보 아이디를 넣어 역산할 수 있다. 개인정보
     처리방침에 이 사실을 명시하고, pepper 접근 권한(비밀 관리 서비스,
     로그 미노출)을 최소화해야 한다.
2. **해시 엔드포인트를 검색 기능으로 오용할 수 없게 설계.**
   `/api/upload`는 세션 기반으로만 동작하고, "임의 아이디를 넣으면 해시나
   존재 여부를 알려주는" 범용 조회 API를 두지 않는다. 이는 "특정 계정
   검색 금지"라는 제품 원칙을 코드 구조로도 강제한 것이다 — 이런 엔드포인트가
   있으면 사실상 "이 사람이 참여 중인가?" 오라클이 되어 검색 기능의 뒷문이
   된다.
3. **경로가 아니라 거리만 계산.** `packages/graph/src/shortestPath.ts`의
   `shortestDistance()`는 시그니처 자체가 숫자(또는 null)만 반환할 수 있게
   되어 있어서, 실수로 중간 연결자를 API 응답에 흘릴 수 있는 코드 경로가
   없다.
4. **원본 데이터 서버 미저장.** ZIP은 브라우저(`@gai-ara/ig-parser`)에서만
   열어보고, 서버로는 계산된 mutual username 목록만 전송한다. 원본 ZIP/JSON은
   서버 어디에도 저장하지 않는다.
5. **최소 그래프만 저장.** followers/following 전체가 아니라 mutual(맞팔)만
   edge로 저장한다.

### 아직 해결되지 않았고, 운영 전에 반드시 결정해야 하는 것

1. **`hasUploadedOwnData` 설계 가정은 확인이 필요하다.** 스펙 3~4장을
   그대로 따르면, A가 업로드하면 A의 맞팔 상대(B, C, D)도 "고스트 노드"로
   그래프에 즉시 생성된다 — B가 서비스를 켜본 적이 없어도. 개인 결과 화면의
   "2다리 안 236명" 같은 숫자가 실제로 서비스를 써본 사람 수보다 커질 수
   있다는 뜻이다. 이게 의도한 동작인지(참여자 = 그래프에 등장한 모든 사람)
   아니면 실제로 업로드를 완료한 사람만 세야 하는지(`hasUploadedOwnData = true`인
   행만) 제품 결정이 필요하다. 스키마는 두 경우를 다 지원하도록 플래그를
   분리해뒀다.
2. **레이트 리밋이 전혀 없다.** `/api/upload`에 아이디 목록을 대량으로
   반복 호출하면, 특정 아이디가 이미 그래프에 있는지(다른 사람의 mutual로
   등장했는지) 관찰 공격을 시도할 여지가 이론적으로 남는다. 응답에서
   존재 여부를 직접 알려주지는 않지만, 타이밍 차이 등 부채널까지 막으려면
   세션당/‌IP당 rate limit과 요청당 mutual 개수 상한(현재 zod 스키마상 2만 개)
   조정이 필요하다.
3. **삭제(잊혀질 권리) 플로우가 없다.** 해시가 가명 식별자인 이상 개인정보에
   해당한다. "내 정보 삭제" 요청이 오면 해당 `identityHash`를 가진
   participant/relationship을 지우는 API가 필요하다 (MVP 이후 단계로 미룸).
4. **가짜 계정으로 그래프를 조작하는 문제는 이번 스코프 밖.** Instagram
   계정 진위 확인은 하지 않는다 — accepted risk로 남겨둔다.
5. **`IDENTITY_PEPPER`/`SESSION_SECRET` 회전 절차 없음.** pepper를 바꾸면
   기존 해시가 전부 무효화되므로, 최초 설정 후 되도록 바꾸지 않거나
   재해싱 마이그레이션 절차를 별도로 설계해야 한다.

## MVP 단계 (지금 리포는 Phase 0까지 완료)

- **Phase 0 — 프로젝트 골격 (완료)**: 모노레포, TS/Tailwind/Drizzle 설정,
  패키지 스켈레톤.
- **Phase 1 — `ig-parser` (완료)**: ZIP 열기, followers/following 다중 파일
  병합, mutual 계산, 유닛 테스트.
- **Phase 2 — `graph` (완료)**: 그래프 빌드, BFS, 통계 함수, 유닛 테스트.
- **Phase 3 — 아이덴티티/DB (완료)**: HMAC 해싱, Drizzle 스키마
  (participants/relationships/sessions/pair_invites/pair_results).
- **Phase 4 — 업로드 플로우 (완료, 시각 디자인은 아직 최소 수준)**: 랜딩 →
  업로드 → `/api/upload`.
- **Phase 5 — 개인 결과 (완료, 시각 디자인은 아직 최소 수준)**: `/result` +
  `/api/me/result`.
- **Phase 6 — 페어 공유 (완료, 시각 디자인은 아직 최소 수준)**: 초대 생성/조회/
  수락 + `/pair/[token]` + `/api/pairs/[token]/result`.
- **Phase 7 — 브랜드/캐릭터 적용 (미착수)**: 감귤 캐릭터 일러스트, 상태별
  마이크로카피, 실제 비주얼 디자인.
- **Phase 8 — 운영 준비 (미착수)**: 레이트 리밋, 삭제 요청 플로우, 로깅/모니터링
  정책, 실제 배포(Vercel + 관리형 Postgres 등), 위에 나열한 미해결 개인정보
  이슈 반영.

## 로컬 개발 시작하기

```bash
cp .env.example .env.local   # DATABASE_URL, IDENTITY_PEPPER, SESSION_SECRET 채우기
docker compose up -d                 # 로컬 Postgres (docker-compose.yml)
pnpm install
pnpm --filter @gai-ara/db generate   # 최초 1회: 마이그레이션 파일 생성
pnpm --filter @gai-ara/db migrate    # 로컬 Postgres에 스키마 적용
pnpm test                            # ig-parser / graph 유닛 테스트
pnpm dev                             # http://localhost:3000
```

이번 스캐폴딩 세션에서 검증한 것 / 못한 것:

- ✅ `pnpm test` (ig-parser 11개, graph 9개 테스트) 통과
- ✅ `pnpm --filter @gai-ara/web build` 프로덕션 빌드 통과, 모든 라우트 생성 확인
- ✅ 브라우저에서 랜딩/업로드 페이지 렌더링 확인
- ⚠️ **DB 연동 전체 플로우(업로드 → 결과 → 페어 공유)는 로컬에 Postgres가
  없어서 실제로 실행해보지 못했다.** `docker compose up -d`로 Postgres를
  띄운 뒤 위 순서대로 실행하며 직접 검증해야 한다.

`IDENTITY_PEPPER`는 반드시 무작위 값으로 바꿔야 한다:

```bash
openssl rand -hex 32
```
