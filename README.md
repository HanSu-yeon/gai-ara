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
  ig-parser/      Instagram ZIP/JSON 파싱 + following 목록 추출 (브라우저/Node 겸용, 순수 함수)
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
- **제품 결정 로그**: 진입 비용, 데이터 가져오기와 퍼널에 관한 결정은
  [`docs/01_Concept_Design/00_PRODUCT_DECISION_LOG.md`](./docs/01_Concept_Design/00_PRODUCT_DECISION_LOG.md)에 기록한다.

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
   열어보고, 서버로는 following username 목록만 전송한다. 원본 ZIP/JSON,
   followers 데이터는 서버 어디에도 저장하지 않는다.
5. **Participant-only 그래프.** followers는 아예 수집하지 않는다. 참여자가
   신고한 following(방향성 있는 주장)을 양방향으로 대조해서, 상대도 참여해서
   되팔로우를 신고했을 때만 edge로 인정한다 — 참여하지 않은 사람은 그래프에
   전혀 등장하지 않는다("고스트 노드" 없음).

### 아직 해결되지 않았고, 운영 전에 반드시 결정해야 하는 것

1. **레이트 리밋이 전혀 없다.** `/api/upload`에 아이디 목록을 대량으로
   반복 호출하면, 특정 아이디가 이미 참여자로 존재하는지 관찰 공격을 시도할
   여지가 이론적으로 남는다. 응답에서 존재 여부를 직접 알려주지는 않지만,
   타이밍 차이 등 부채널까지 막으려면 세션당/‌IP당 rate limit과 요청당
   following 개수 상한(현재 zod 스키마상 2만 개) 조정이 필요하다.
2. **삭제(잊혀질 권리) 플로우가 없다.** 해시가 가명 식별자인 이상 개인정보에
   해당한다. "내 정보 삭제" 요청이 오면 해당 `identityHash`를 가진
   participant와 관련 `follows` 행을 지우는 API가 필요하다 (MVP 이후 단계로
   미룸).
3. **가짜 계정으로 그래프를 조작하는 문제는 이번 스코프 밖.** Instagram
   계정 진위 확인은 하지 않는다 — accepted risk로 남겨둔다.
4. **`IDENTITY_PEPPER`/`SESSION_SECRET` 회전 절차 없음.** pepper를 바꾸면
   기존 해시가 전부 무효화되므로, 최초 설정 후 되도록 바꾸지 않거나
   재해싱 마이그레이션 절차를 별도로 설계해야 한다.

## MVP 단계 (지금 리포는 Phase 0까지 완료)

- **Phase 0 — 프로젝트 골격 (완료)**: 모노레포, TS/Tailwind/Drizzle 설정,
  패키지 스켈레톤.
- **Phase 1 — `ig-parser` (완료)**: ZIP 열기, following.json 다중 파일 병합,
  정규화/중복 제거, 유닛 테스트.
- **Phase 2 — `graph` (완료)**: 그래프 빌드, BFS, 통계 함수, 유닛 테스트.
- **Phase 3 — 아이덴티티/DB (완료)**: HMAC 해싱, Drizzle 스키마
  (participants/follows/sessions/pair_invites/pair_results).
- **Phase 4 — 업로드 플로우 (완료, 시각 디자인은 아직 최소 수준)**: 랜딩 →
  업로드 → `/api/upload`.
- **Phase 5 — 개인 결과 (완료, 시각 디자인은 아직 최소 수준)**: `/result` +
  `/api/me/result`.
- **Phase 6 — 페어 공유 (완료)**: 초대 생성/조회/수락 + `/pair/[token]` +
  `/api/pairs/[token]/result`, 실제 컴포넌트로 라우팅 연결 완료.
- **Phase 7 — 브랜드/캐릭터 적용 (완료)**: 감귤 캐릭터 일러스트, 상태별
  마이크로카피, 실제 비주얼 디자인 — `/upload`, `/result`, `/pair/[token]`
  전부 실제 컴포넌트(UploadFlow/ResultScreen/LivePairPage)로 동작.
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

검증한 것 (2026-09-12 기준):

- ✅ `pnpm test` (ig-parser 13개, graph 7개 테스트) 통과
- ✅ `pnpm -r typecheck` 전체 통과
- ✅ 로컬 Postgres(docker-compose)에 실제로 연결해서 업로드 → 참여자 맞팔 확인
  → 초대 생성/수락 → 페어 결과(BFS 거리) → 재업로드 시 관계 동기화까지
  end-to-end로 검증 완료(브라우저 실제 조작 + API 직접 호출 둘 다).
- ✅ 브라우저에서 랜딩/업로드/결과/페어 화면 전부 실제 컴포넌트로 렌더링 확인.

`IDENTITY_PEPPER`는 반드시 무작위 값으로 바꿔야 한다:

```bash
openssl rand -hex 32
```
