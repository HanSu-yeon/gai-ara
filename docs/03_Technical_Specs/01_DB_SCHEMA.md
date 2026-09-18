# DB Schema & Identity/Graph Design
> Created: 2026-09-10 22:30
> Last Updated: 2026-09-14

**DB 엔진**: PostgreSQL. Turso(libSQL)로 바꾸는 걸 검토했다가, 이 워크로드가
SQLite 계열의 장점을 살릴 수 없고 마이그레이션 비용 대비 얻는 게 없어 다시
PostgreSQL로 확정했다 — 경위는
[00_DEVELOPMENT_PRINCIPLES.md §1.3](./00_DEVELOPMENT_PRINCIPLES.md#13-db-postgresql-tursolibsql-검토했다가-되돌림-그래프-전용-db는-여전히-사용하지-않음)
참고. 아래 스키마는 실제 코드(`packages/db/src/schema.ts`, `pgTable`)와 동일한
PostgreSQL 타입으로 표기한다.

이 문서는 두 가지 핵심 결정을 다룬다: (1) Instagram username을 서버에서 어떻게
식별/매칭할지, (2) 참여자 사이의 관계(edge)를 어떤 데이터 구조로 저장할지. 두
결정은 서로 얽혀 있으므로(식별자가 곧 그래프 노드 키) 하나의 문서로 다룬다.
2026-09-13에 (2)의 1차 소스가 mutual-follow에서 지인 확인 링크로 바뀌었다가,
2026-09-14 결정으로 Instagram 맞팔(followers ∩ following)이 두 번째 활성
edge 소스로 다시 합류했다 — 지금은 두 source를 함께 쓴다(§4).
**TASK-003(v2, 구현 완료) 갱신**: 지인 확인 링크가 1회용 `pair_invites`에서
재사용 가능한 `acquaintance_links`/`acquaintance_confirmations`로 바뀌었고,
카카오 로그인(`oauth_accounts`)과 사용자 표시 이름(`participants.display_name`)이
추가됐다. 상세 설계 근거는 [03_INVITE_GRAPH_V2_SPEC.md](./03_INVITE_GRAPH_V2_SPEC.md)
참고. **2026-09-14 갱신**: 이 문서 전체를 실제 스키마(`packages/db/src/schema.ts`)와
코드(`apps/web/lib/participants.ts`)에 맞춰 다시 검증했다 — 아래 §1·§4는
그동안 2026-09-13 이전 모델(일방향 following 신고 + 자기조인 mutual 판정,
`/api/upload`·`/api/invites`·`/pair/[token]` 라우트가 "비활성이지만 그대로
동작") 기준으로 서술돼 있었는데, 실제로는 해당 API 라우트/페이지 자체가
코드베이스에서 삭제됐고(스키마·조회 함수 하나만 코드에 남음), `follows`의
의미도 완전히 바뀌었다(§4.2).

## 1. 엔티티 개요

```text
participants (1) ──< follows >── identity_hash(참여 여부 무관)
participants (1) ──< sessions
participants (1) ──< oauth_accounts                      -- 카카오 로그인 동일인 판별
participants (1) ──< pair_invites (inviter) >── pair_invites (recipient) >── (1) participants   -- 비활성 보존
pair_invites (1) ── pair_results (1)                      -- 비활성 보존
participants (1) ──< acquaintance_links (owner)
acquaintance_links (1) ──< acquaintance_confirmations >── (1) participants (confirmer)
participants (1) ──< target_challenges (creator)          -- 2026-09-14 신규, §4.9
```

- `participants`: 그래프의 노드. **오직 최소 부트스트랩(지인 링크만으로
  참여) 또는 카카오 로그인으로 참여를 확정한 사람만** 담는다 — "고스트"
  노드는 없다(participant-only 그래프, §4 참고). Instagram 없는 최소
  부트스트랩(`createBootstrapParticipant`)과 카카오 로그인
  (`findOrCreateKakaoParticipant`, 둘 다 `apps/web/lib/participants.ts`) 두
  경로만 참여자 행을 만든다 — Instagram username은 더 이상 참여자 생성
  수단이 아니다(`upsertParticipant`는 코드에 남아 있지만 현재 어디서도
  호출되지 않는 사문화된 함수다). `display_name`은 TASK-003(v2)부터 추가된
  nullable 컬럼으로, 사용자가 화면 02에서 직접 입력한 값만 담는다 —
  로그인 프로필에서 자동으로 채우지 않는다(§4.6).
- `oauth_accounts`: TASK-003(v2) 신규. 카카오 `(provider, providerAccountId)`로
  동일 사용자를 판별해 `participants`에 연결한다(§4.6).
- `follows`: 한 참여자가 자기 Instagram export에서 브라우저로 계산한
  맞팔(followers ∩ following) 상대 한 명당 한 행(2026-09-14 재도입 — 의미가
  바뀌었다, §4.2). 상대도 실제 참여자이고 자기 계정을 연동했을 때만
  edge로 인정된다.
- `sessions`: 로그인 없이 "내 결과 다시 보기"를 지원하기 위한 최소 세션 —
  카카오 로그인도 이 테이블의 httpOnly 쿠키 세션을 그대로 재사용한다(Auth.js
  자체 세션은 OAuth 핸드셰이크 동안만 쓰이고 저장되지 않는다, §4.6).
- `pair_invites` / `pair_results`: TASK-002가 도입했던 1회용 "우리 몇다리?"
  consent 플로우의 상태 저장소였다. TASK-003(v2) 이후 `getAllEdges()`가
  더 이상 이 테이블을 조회하지 않을 뿐 아니라, 이 플로우가 쓰던 API 라우트
  (`/api/upload`, `/api/invites`, `/api/invites/{token}/accept`,
  `/api/pairs/{token}/result`)와 UI(`/pair/[token]`, `LivePairPage.tsx`)
  자체가 코드베이스에서 삭제됐다 — 지금은 테이블 스키마와
  `getLegacyPairInviteEdges()` 조회 함수(호출하는 곳 없음)만 남아 있다(§4.7).
- `acquaintance_links` / `acquaintance_confirmations`: TASK-003(v2) 신규,
  edge 소스 중 하나(§4.2). 재사용 가능한 지인 링크와 그 확인 기록이다.

## 2. 테이블 정의

```sql
participants
  id                  uuid PK default gen_random_uuid()
  identity_hash       text UNIQUE NOT NULL       -- §3 참고, 평문 username 아님
  recovery_token      text UNIQUE NOT NULL
  display_name        text                       -- nullable, TASK-003(v2) 신규. §4.6 참고
  instagram_username_hash          text          -- nullable, UNIQUE. 2026-09-14 신규. §4.2 참고
  public_connector_name_consent_at timestamptz   -- nullable. 2026-09-15 신규 "마지막 연결자 공개" 동의 시각.
                                                  -- display_name을 최초로 설정할 때만 채워진다(§4.9 참고).
  created_at          timestamptz NOT NULL default now()

oauth_accounts        -- TASK-003(v2) 신규
  id                   uuid PK default gen_random_uuid()
  participant_id       uuid NOT NULL REFERENCES participants(id) ON DELETE CASCADE
  provider             text NOT NULL              -- 'kakao' 고정값(§4.6)
  provider_account_id  text NOT NULL
  created_at           timestamptz NOT NULL default now()
  UNIQUE (provider, provider_account_id)

sessions
  token               text PK                    -- 무작위 256bit, httpOnly 쿠키 값
  participant_id      uuid NOT NULL REFERENCES participants(id) ON DELETE CASCADE
  created_at          timestamptz NOT NULL default now()
  expires_at          timestamptz NOT NULL

follows
  id                        uuid PK default gen_random_uuid()
  follower_participant_id   uuid NOT NULL REFERENCES participants(id) ON DELETE CASCADE
  followee_identity_hash    text NOT NULL        -- FK 아님 — 아직 참여 안 한 사람의 해시도 담을 수 있어야 함
  created_at                timestamptz NOT NULL default now()
  UNIQUE (follower_participant_id, followee_identity_hash)

pair_invites           -- 비활성 보존(§4.7), TASK-002 기준 그대로
  id                       uuid PK default gen_random_uuid()
  token                    text UNIQUE NOT NULL   -- 무작위 128bit, URL에 노출됨
  inviter_participant_id   uuid NOT NULL REFERENCES participants(id) ON DELETE CASCADE
  recipient_participant_id uuid REFERENCES participants(id) ON DELETE CASCADE  -- accept 전 NULL
  status                   text NOT NULL default 'pending'  -- pending | accepted | expired
  label                    text                   -- inviter 전용 메모
  inviter_nickname         text                   -- recipient에게 공개되는 이름
  created_at               timestamptz NOT NULL default now()
  expires_at               timestamptz NOT NULL

pair_results            -- 비활성 보존(§4.7), TASK-002 기준 그대로
  id             uuid PK default gen_random_uuid()
  pair_invite_id uuid UNIQUE NOT NULL REFERENCES pair_invites(id) ON DELETE CASCADE
  distance       integer                          -- NULL이면 도달 불가
  computed_at    timestamptz NOT NULL default now()

acquaintance_links      -- TASK-003(v2) 신규, 재사용 가능한 지인 링크
  id                     uuid PK default gen_random_uuid()
  token                  text UNIQUE NOT NULL     -- 무작위 128bit
  owner_participant_id   uuid NOT NULL REFERENCES participants(id) ON DELETE CASCADE
  max_uses               integer NOT NULL default 50
  expires_at             timestamptz NOT NULL     -- created_at + 30일
  revoked_at             timestamptz              -- NULL이면 유효
  created_at             timestamptz NOT NULL default now()

acquaintance_confirmations  -- TASK-003(v2) 신규, 지금 유일한 edge 소스(§4.2)
  id                          uuid PK default gen_random_uuid()
  link_id                     uuid NOT NULL REFERENCES acquaintance_links(id) ON DELETE CASCADE
  confirmer_participant_id    uuid NOT NULL REFERENCES participants(id) ON DELETE CASCADE
  confirmed_at                timestamptz NOT NULL default now()
  UNIQUE (link_id, confirmer_participant_id)
  -- soft-delete 컬럼 없음: 확인된 관계를 되돌리는 기능은 제품 결정으로 제공하지 않는다(§4.2).
```

실제 정의는 `packages/db/src/schema.ts`(Drizzle `pgTable`)가 정본이며, 위 표는
그것을 그대로 옮긴 것이다. `ON CONFLICT (identity_hash) DO UPDATE ... RETURNING`
(upsert-by-natural-key 패턴, §3.3에서 상세)은 PostgreSQL의 `excluded.*` 문법을
그대로 쓴다.

**id 선택**: 순번 정수 대신 UUID를 쓴다. `pair_invites.token`이 이미 참여자를 직접
가리키지 않는 별도 난수이므로 보안상 필수는 아니지만, `participants.id`가 URL 등에
실수로 노출되더라도 전체 참여자 수(성장 곡선)를 순번으로 추정할 수 없게 하는
방어적 선택이다.

## 3. Instagram Username 식별/매칭 설계

### 3.1 요구사항

두 가지가 동시에 성립해야 한다:

1. **매칭 가능해야 한다**: A가 자신의 맞팔 목록에 "b_user"를 올렸을 때, 나중에
   실제 "b_user"가 자기 계정으로 참여하면 같은 그래프 노드로 연결되어야 한다 —
   즉 같은 username은 항상 같은 식별자로 귀결되어야 한다(결정론적).
2. **역추적 불가능해야 한다**: 저장된 식별자만 보고 제3자가(이상적으로는 운영자도)
   원래 username을 알아낼 수 없어야 한다.

이 두 요구사항은 일반적인 "비밀번호 해싱" 문제와 다르다. 비밀번호는 레코드마다
다른 salt를 써야 안전하지만(salt가 다르면 같은 비밀번호도 다른 해시가 나옴), 여기서는
**서로 다른 사람이 같은 username을 넣었을 때 반드시 같은 해시가 나와야** 매칭이
성립한다. 따라서 레코드별 salt는 애초에 쓸 수 없다 — 이 문서에서 검토하는 옵션은
모두 "레코드별 salt가 아니라 전역 비밀을 쓸 것"이라는 전제 위에 있다.

### 3.2 검토한 옵션

| 옵션 | 방식 | 매칭 가능? | 역추적 저항성 | 채택 |
| :--- | :--- | :---: | :--- | :---: |
| A | 평문 저장 | O | 없음 | 기각 |
| B | `SHA256(username)` | O | 없음 — 흔한 아이디 사전으로 오프라인 rainbow table 공격 가능 | 기각 |
| C | `SHA256(username + 레코드별 랜덤 salt)` | **X** | 높음이지만 무의미 | 기각 (§3.1 이유로 매칭 자체가 깨짐) |
| D | `HMAC-SHA256(normalize(username), PEPPER)` — PEPPER는 서버만 아는 전역 비밀 | O | PEPPER 없이는 오프라인 대입 불가. 단 **운영자 자신은 후보를 넣어 역산 가능** (가명처리이지 익명화 아님) | **채택** |
| E | Private Set Intersection(PSI) 등 암호학적 프로토콜로, 운영자도 매칭 결과 외에는 원본을 알 수 없게 함 | O | 이론상 최고 수준 | 보류 (아래 §3.4) |

### 3.3 채택안: HMAC-SHA256 + 서버 전역 pepper

```text
identity_hash = HMAC-SHA256(normalize(username), IDENTITY_PEPPER)
normalize(username) = username.trim().replace(/^@/, "").toLowerCase()
```

- `IDENTITY_PEPPER`는 서버 환경 변수로만 존재하고 클라이언트에는 절대 내려가지
  않는다. 노출되는 순간 D는 사실상 B(무방비 해시)로 격하된다.
- `normalize()`는 클라이언트(following 목록 정규화 시)와 서버(해싱 직전)에서
  동일한 규칙으로 적용해야 한다 — 규칙이 어긋나면 같은 사람이 다른 해시로 갈라진다.
- **가명처리 고지 의무**: 운영자는 PEPPER를 알고 있으므로 후보 username을 넣어
  역산할 수 있다. 개인정보처리방침에 "이 식별자는 익명이 아니라 가명이며, 운영자는
  기술적으로 역산이 가능하다"는 점을 명시하고, PEPPER 접근 권한을 최소화한다
  (비밀 관리 서비스, 로그 미노출, 접근 감사).
- **오용 방지**: D 방식 자체는 안전해도, "임의 username을 넣으면 해시나 매칭
  존재 여부를 알려주는" API가 있으면 사실상 검색 기능이 부활한다. 이 문제는
  원칙적으로 API 설계로 막는다 — [02_API_SPECS.md §1](./02_API_SPECS.md#1-서버가-절대-받지-않는-것)
  참고. 2026-09-14 결정으로 이 원칙에 좁은 예외 하나(Path Check)가 추가됐다
  — 대상이 존재하는지 자체는 응답에서 구분하지 않는 방식으로 원칙의 취지를
  지킨다. 상세는 [02_API_SPECS.md §8](./02_API_SPECS.md#8-path-check--username을-정확히-아는-경우에만-거리-확인-설계-확정-미구현)
  참고.

### 3.4 검토했지만 지금은 채택하지 않는 옵션: PSI

이 문제는 사실 "서로 다른 두 집합의 교집합만 알고 싶고, 그 외 원소는 서로에게도
운영자에게도 드러나면 안 된다"는 Private Set Intersection의 교과서적인 사례다.
이론적으로는 가장 강력한 답이지만:

- 2자 간 PSI 프로토콜은 성숙해 있지만, 이 서비스는 N명의 참여자가 계속 늘어나며
  전역 그래프를 구성해야 하는 다자간 문제라 프로토콜 설계 난이도가 크게 올라간다.
- 초기 실험 서비스(기획서 2장 "가벼운 소셜 실험") 단계에서 들이기엔 과한 엔지니어링
  비용이다.

**결론**: MVP는 D(HMAC+pepper)를 기준선으로 채택하고, 가명처리 한계를 정책 문서에
명시적으로 공개한다. 실사용자 규모가 커지거나 더 민감한 데이터를 다루게 되면 PSI
기반 재설계를 별도 과제로 진행한다.

### 3.5 본인 username 입력 방식

ZIP export의 필드 구조만으로 "이 계정의 주인이 누구인지"를 안정적으로 판별하기
어렵고(export 버전마다 위치가 다름), 이를 파싱하도록 만들면 파서가 특정 구조에
과의존하게 된다(기획서 8장이 명시적으로 경고하는 문제). 대신 사용자가 자신의
Instagram 아이디를 폼에 직접 입력한다. 트레이드오프로 오타 시 자기 자신이 두 개의
서로 다른 노드로 나뉠 수 있는데, 이는 사용자 실수의 영향 범위가 작아 MVP에서는
허용한다.

### 3.6 Ghost 노드와 참여자 정의 (해결됨 — 애초에 고스트 노드를 만들지 않기로 함)

**이전 결정(2026-09-11)**: A가 업로드하면 A의 맞팔 상대(B, C, D)도
`has_uploaded_own_data = false`인 "고스트" 노드로 그래프에 즉시 생성했다 — B가
서비스를 열어본 적이 없어도. "참여자의 N%" 같은 백분율의 분모를 어떻게
정의할지(전체 노드 vs 실제 업로더만)가 미해결로 남아 있었고, 한 차례는 "분모가
필요한 지표(퍼센트) 자체를 노출하지 않는다"로 봉합했었다.

**최종 결정(2026-09-12, 재검토)**: 그래프 생성 모델 자체를 participant-only로
바꿨다(§4.2) — followers는 아예 수집하지 않고, 각 참여자는 자기 following만
올린다. A가 X를 팔로우한다고 신고해도, X가 직접 참여해서 반대 방향(X가 A를
팔로우한다)을 신고하기 전까지는 edge가 생기지 않는다. 그 결과:

- **고스트 노드가 원천적으로 없다.** `participants` 테이블에는 실제로 업로드한
  사람만 존재한다. `has_uploaded_own_data` 플래그 자체가 필요 없어져 스키마에서
  제거했다.
- **분모 문제가 저절로 해소됐다.** "참여자"라는 단어가 이제 모호하지 않다 —
  그래프에 노드로 존재하는 사람 = 실제로 참여한 사람이 항상 성립한다.
- **트레이드오프**: 참여자가 적을 때는 "내 결과" 화면의 직접 연결 수가 실제
  인스타 맞팔 수보다 작게(대개 0) 나온다 — 상대도 참여해야 확인되므로. 이건
  버그가 아니라 의도된 동작이다: [ResultScreen.tsx](../../apps/web/components/ResultScreen.tsx)는
  `direct === 0`일 때 "친구를 초대하면 첫 연결이 생겨요" 안내를 보여줘서, 빈
  상태를 초대 유도로 전환한다.

**2026-09-14 갱신**: 위 "followers는 아예 수집하지 않고"는 2026-09-12 시점
서술이다. 지금은 맞팔(교집합)을 계산하려면 followers도 필요해서 브라우저가
둘 다 읽는다 — 다만 서버로 전송하는 건 여전히 교집합 결과뿐이고
(followers/following 원본은 여전히 서버로 오지 않는다), "고스트 노드가
없다"는 이 절의 핵심 결론과 participant-only 원칙은 그대로 유지된다(§4.2).

## 4. 그래프 저장 구조 (지인 확인 + Instagram 맞팔 — 1회용 링크만 비활성)

> **TASK-003(v2) → 2026-09-14 갱신**: 활성 edge 소스는 두 개다 —
> `acquaintance_confirmations`(지인 링크 확인)와 `follows`(Instagram 맞팔,
> 상대도 참여자로 확인된 경우만, §4.2). 2026-09-13에는 `follows`가 비활성
> 보존 상태였지만, 2026-09-14 결정으로 다시 활성화됐다 — 두 source는 신뢰
> 수준 구분 없이 `UNION`으로 합쳐진다. TASK-002가 유일한 소스로 썼던
> `pair_invites`만 여전히 비활성(코드/스키마 보존, `getAllEdges()`는 조회
> 안 함, §4.7). 카카오 로그인·표시 이름 저장 구조는 §4.6 참고. 설계 근거
> 전체는 [03_INVITE_GRAPH_V2_SPEC.md](./03_INVITE_GRAPH_V2_SPEC.md)와
> [00_PRODUCT_DECISION_LOG.md](../01_Concept_Design/00_PRODUCT_DECISION_LOG.md)의
> 2026-09-13·2026-09-14 항목 참고.

### 4.1 검토한 옵션

| 옵션 | 방식 | 장점 | 단점 |
| :--- | :--- | :--- | :--- |
| A | 전용 그래프 DB (Neo4j, Dgraph 등) | 다중 홉 순회에 최적화 | 별도 스테이트풀 시스템 운영 부담(백업/모니터링 이중화), MVP 규모에서 이점을 체감하기 어려움 |
| B | PostgreSQL 관계형 테이블 + 요청 시 인메모리 BFS | 데이터스토어 단일화, 이미 검증된 드라이버/툴링(§00_DEVELOPMENT_PRINCIPLES §1.3) | 그래프가 매우 커지면(수백만 edge) 매 요청 전체 스캔이 느려짐 |

### 4.2 채택안: B (PostgreSQL + 요청 시 인메모리 BFS), 활성 소스는 두 개

**모델(2026-09-14 확정)**: `getAllEdges()`(`apps/web/lib/participants.ts`)가
매 요청마다 두 source를 `UNION`으로 합쳐 edge 목록을 만든다. 새 edge 전용
테이블을 따로 두지 않는 원칙은 그대로 유지한다 — 확인 기록/맞팔 기록
테이블의 행 자체가 edge다.

**소스 1 — 재사용 지인 링크 확인(`acquaintance_confirmations`)**:
수신자가 화면 04 "{표시 이름}님을 알고 있나요?"에서 "네, 알고 있어요"를 눌러
`POST /api/links/{token}/confirm`을 호출하면(`confirmAcquaintanceLink`,
`apps/web/lib/acquaintance-links.ts`), 그 링크의 `owner_participant_id`와
확인한 사람(`confirmer_participant_id`) 쌍이 곧 edge가 된다. 링크 소유자
쪽 재확인은 요구하지 않는다 — 수신자의 한쪽 확인만으로 edge가 즉시
만들어진다(근거: 결정 로그 2026-09-13 항목, v2 명세 §2.4). 같은 사람이 같은
링크를 두 번 확인해도(멱등) 성공 처리되고 edge가 중복 생기지 않는다(UNIQUE
제약).

**소스 2 — Instagram 맞팔(`follows`, 2026-09-14 재도입)**: TASK-002 시절과
데이터 모델 자체가 다르다 — 더 이상 "일방향 following 신고 두 개를
자기조인해 mutual을 판정"하지 않는다. 각 참여자가 자기 Instagram export를
**브라우저에서** 열어 `followers ∩ following`(맞팔)까지 미리 계산하고
(`packages/ig-parser`의 `computeMutuals`), 그 결과 username들만 해싱해
서버로 보낸다(`POST /api/instagram-import`, [02_API_SPECS.md §2.3](./02_API_SPECS.md#23-클라이언트--서버-데이터-계약-2026-09-14-갱신)).
서버는 이걸 그대로 `follows`에 "이 참여자 → 맞팔 상대 해시" 행으로
저장한다 — `follows` 한 행 자체가 이미 "맞팔"이라는 뜻이고, 반대 방향
행을 따로 찾아 대조할 필요가 없다. 대신 **상대가 실제 참여자이고 자기
Instagram 계정도 연동했는지**를 확인해야 edge로 인정된다 —
`participants.instagram_username_hash`와 일치할 때만이다.

```sql
SELECT DISTINCT
  LEAST(f.follower_participant_id, p.id) AS a,
  GREATEST(f.follower_participant_id, p.id) AS b
FROM follows f
JOIN participants p ON p.instagram_username_hash = f.followee_identity_hash
WHERE p.id != f.follower_participant_id
```

`follows` 쪽만 확인하면 충분하다 — 맞팔은 한쪽 export만으로도 이미 양방향
사실이므로, 상대가 반대 방향 행을 올릴 때까지 기다릴 필요가 없다(TASK-002
시절 self-join 모델과 다른 점). 상대가 아직 Instagram 계정을 연동하지
않았다면(해시가 어떤 참여자와도 안 맞으면) edge가 생기지 않고, 나중에
연동하면 다음 `getAllEdges()` 호출부터 자동으로 나타난다 — 별도
백필/마이그레이션이 필요 없다. 매칭되지 않은 해시 행은 `follows`에 그대로
남아 있고, Path Check(§8, `02_API_SPECS.md`)가 조회하는 대상이 바로 이
행들이다.

**두 소스를 합치는 실제 쿼리** (`getAllEdges()`):

```sql
SELECT DISTINCT a, b FROM (
  SELECT
    LEAST(al.owner_participant_id, ac.confirmer_participant_id) AS a,
    GREATEST(al.owner_participant_id, ac.confirmer_participant_id) AS b
  FROM acquaintance_confirmations ac
  JOIN acquaintance_links al ON al.id = ac.link_id
  UNION
  SELECT
    LEAST(f.follower_participant_id, p.id) AS a,
    GREATEST(f.follower_participant_id, p.id) AS b
  FROM follows f
  JOIN participants p ON p.instagram_username_hash = f.followee_identity_hash
  WHERE p.id != f.follower_participant_id
) edges
```

두 source 사이에 신뢰 수준 구분을 두지 않는다 — 어느 쪽에서 왔는지는 이
쿼리를 호출하는 BFS(`packages/graph`)가 전혀 알지 못한다(2026-09-13
재검토 조건의 "섞지 않는다" 조항은 2026-09-14 결정으로 폐기됐다 — 근거는
[00_PRODUCT_DECISION_LOG.md](../01_Concept_Design/00_PRODUCT_DECISION_LOG.md)
2026-09-14 항목).

**비활성 보존 — 1회용 지인 링크(`pair_invites`)**: TASK-002가 유일한 소스로
썼던 쿼리다. DB 스키마와 조회 함수(`getLegacyPairInviteEdges`,
`apps/web/lib/participants.ts`)는 삭제하지 않았지만, `getAllEdges()`는 더
이상 이 쿼리를 실행하지 않는다. 이 플로우가 쓰던 API 라우트와 UI 페이지
자체는 코드베이스에서 삭제됐다(§1 참고) — "비활성 보존"은 DB 레이어에만
해당한다.

```sql
-- getAllEdges()가 더 이상 실행하지 않는 쿼리 — 참고용으로만 남긴다.
SELECT DISTINCT
  LEAST(inviter_participant_id, recipient_participant_id) AS a,
  GREATEST(inviter_participant_id, recipient_participant_id) AS b
FROM pair_invites
WHERE status = 'accepted' AND recipient_participant_id IS NOT NULL
```

- **참여자 생성 경로가 두 개다.** `createBootstrapParticipant`(Instagram
  없는 최소 부트스트랩, `identityHash`가 무작위 opaque 값 `bootstrap:<hex>`),
  `findOrCreateKakaoParticipant`(카카오 로그인, `identityHash`가 opaque 값
  `kakao:<hex>`, 동일인 판별은 `oauth_accounts`가 담당, §4.6)가
  `participants` 테이블에 행을 만든다 — 그래프 관점에서는 둘 다 동등한
  노드다(§3.6 participant-only 원칙 유지). `upsertParticipant`(Instagram
  username 기반 upsert)는 코드에 남아 있지만 현재 어디서도 호출되지 않는다
  — Instagram은 더 이상 참여자 생성 수단이 아니라, 이미 참여자인 사람이
  나중에 `claimInstagramUsername`으로 자기 계정만 연동하는 방식으로
  바뀌었다.
- **재업로드**: 참여자가 다시 Instagram을 연동하면 그 사람이 follower인
  `follows` 행을 전부 지우고 새 맞팔 목록으로 교체한다
  (`syncInstagramMutuals`) — 단순 추가가 아니라 없어진 맞팔은 그래프에서도
  사라진다. `acquaintance_links` 쪽은 재연동으로 바뀌지 않는다(둘 다
  Instagram 연동과 무관한 별도 흐름).
- **규모 추정**: MVP 단계 참여자 수천~수만, edge 후보(두 source 합산) 행
  수는 참여자 수와 비슷한 자릿수로 늘어난다. 이 규모에서 BFS 비용은 수십
  ms 이내로, [00_DEVELOPMENT_PRINCIPLES.md §4](./00_DEVELOPMENT_PRINCIPLES.md#4-성능ux-목표)의
  P95 400ms 목표에 여유 있게 들어온다. 참여자가 훨씬 늘어나 이 조회가
  느려지면 §4.3의 캐싱/델타 재계산 전략으로 넘어간다.

### 4.6 카카오 로그인과 표시 이름 (TASK-003(v2) 신규)

**동일인 판별**: `oauth_accounts(provider, provider_account_id)` UNIQUE 제약이
동일인 판별의 근거다 — 카카오 로그인 콜백(`apps/web/lib/auth.ts`의 `signIn`
콜백)이 이 쌍으로 기존 participant를 조회하고, 없으면 새 participant +
oauth_accounts 행을 만든다(`findOrCreateKakaoParticipant`,
`apps/web/lib/participants.ts`). 새로 만드는 participants 행의
`identity_hash`는 `kakao:<random hex>` opaque 값이다 — `bootstrap:<hex>`와
같은 컨벤션이며, 매칭에는 쓰이지 않는 NOT NULL/UNIQUE 제약 자리채움일
뿐이다(TASK-003 백로그 Implementation Preconditions).

**세션 체계는 하나만 유지한다**: Auth.js(NextAuth)는 카카오 OAuth
핸드셰이크(state/PKCE/토큰 교환)만 담당하고, 로그인 성공 후에는 기존
`sessions` 테이블 기반 httpOnly 쿠키(`apps/web/lib/session.ts`)를 그대로
발급한다 — Auth.js 자체 세션/JWT는 저장하지 않는다(v2 명세 §3.1). 로그인
콜백은 표시 이름 여부에 따라 화면 02(`/login`, 없음) 또는 화면 06(`/result`,
있음)으로 고정 리다이렉트한다.

**표시 이름**: `participants.display_name`은 로그인 프로필(카카오 닉네임 등)에서
자동으로 채우지 않고, 사용자가 화면 02에서 직접 입력한 값만
`PATCH /api/me/display-name`으로 저장한다(결정 로그 2026-09-13 항목 8).
직접 연결된 상대의 화면, 본인 화면, 본인이 만든 공개 링크 결과에서만
노출한다 — 검색·임의 조회에는 쓰지 않는다.

### 4.7 지인 링크의 1회용 → 재사용 전환 (TASK-003(v2))

TASK-002의 `pair_invites`(1회용, 링크당 정확히 1명만 accept)는 TASK-003(v2)의
`acquaintance_links`/`acquaintance_confirmations`(재사용 가능, 인원·기간 제한 없음)로
대체됐다. 기존 NOT NULL 컬럼에는 호환용 값만 저장하며 제한 판정에는 사용하지 않는다.
`follows`와 같은 방식으로 코드/스키마 모두
삭제하지 않고 보존한다 — `/api/invites/*`, `/pair/[token]`,
`LivePairPage.tsx`는 그대로 동작하지만, `getAllEdges()`가 더 이상
`pair_invites`를 조회하지 않으므로 이 경로로 accepted된 행은 그래프 계산에
전혀 관여하지 않는다. `acquaintance_confirmations`에는 `pair_invites`와
달리 soft-delete 컬럼이 없다 — 확인된 관계를 되돌리는 기능 자체를 제품
결정으로 제공하지 않기 때문이다(위 §2 테이블 정의, v2 명세 §2.4).

### 4.3 스케일 전환 계획 (지금 만들지 않음)

아래 조건 중 하나에 해당하면 재검토한다. 지금은 구현하지 않고 조건만 기록해둔다.

- 프로파일링 결과 `GET /api/me/result`의 P95가 400ms 목표를 지속적으로 초과할 때.
- edge 수가 대략 50만~100만을 넘어설 때(추정치, 실측으로 재조정).
- 대응 후보(우선순위 순): (1) 요청마다 전체 재조회 대신 짧은 TTL의 인메모리 그래프
  스냅샷 캐시, (2) edge 추가 시 영향받는 참여자만 델타 재계산, (3) 읽기 전용
  복제본(read replica)이나 connection pooling(PgBouncer 등)으로 읽기 지연/부하를
  줄이는 것. 그 이상으로 그래프 자체의 순회 성능이 병목이 되면(예: 임의 N-hop
  쿼리, 커뮤니티 탐지 등 복잡한 그래프 연산이 필요해지면), PostgreSQL의 Apache
  AGE 같은 인그래프 확장을 먼저 검토하고, 그것도 부족하면 전용 그래프 DB(Neo4j
  등, 옵션 A)로의 이전을 검토한다 — "관계형 DB 안에서 그래프 확장을 얹는" 중간
  단계가 있다는 게 PostgreSQL을 유지하는 이유 중 하나다.

### 4.4 reported vs verified edge (해결됨 — 상대의 참여자 연동 여부가 verified 판정 기준)

**이전 검토(2026-09-11)**: 당시 모델(followers ∩ following 자기 신고)은 A
혼자 업로드해도 A-X edge가 생겨서, X 쪽 데이터로 독립 검증하지 않는다는 한계가
있었다. `reported`(한쪽만 주장) → `verified`(양쪽 다 확인) 상태를 나중에
추가하는 방향을 고려한다고 적어뒀었다.

**2026-09-12~13 상태**: 당시 모델은 `follows`가 항상 한쪽 방향의 following
신고만 담고, `getAllEdges()`가 양방향 신고가 모두 존재할 때만 edge로
인정하는 self-join 방식이었다 — 조인 조건 자체가 verified 역할을 했다.

**2026-09-14 갱신**: `follows`의 의미가 바뀌면서 verified 판정 기준도
바뀌었다. `follows` 한 행은 이제 "일방향 following 신고"가 아니라 이미
브라우저에서 교집합까지 계산된 맞팔 그 자체다 — 그래서 반대 방향 행을 찾아
대조할 필요가 없다. 대신 **상대가 실제 참여자로 존재하고, 자기 Instagram
계정도 연동했는지**(`participants.instagram_username_hash`와 일치하는지)가
verified 판정 기준이다. 아직 참여하지 않았거나 연동 전인 상대의 해시는
`follows`에는 남아있지만(§8 Path Check가 조회하는 바로 그 해시다) BFS가
순회하는 그래프에는 등장하지 않는다 — `getAllEdges()`의
`JOIN participants p ON p.instagram_username_hash = f.followee_identity_hash`
조건이 그 역할을 한다(§4.2).

### 4.5 향후 고려사항: 분석 이벤트에는 raw distance를 그대로 사용

나중에 분석 도구(GA 등)를 붙이게 되면, BFS distance(edge 개수, 예:
`connection_distance = 2`)를 그대로 이벤트 값으로 보내고, 화면 문구("한 다리
건너 아는 사이")는 순수하게 표시용으로만 분리해서 다룬다 — 분석 데이터와
UX 카피 변환을 섞지 않는다. 관련 변환 함수는
[apps/web/lib/distance-copy.ts](../../apps/web/lib/distance-copy.ts)에 있다.

### 4.9 타겟 챌린지 (`target_challenges`) — 2026-09-14

`00_PRODUCT_DECISION_LOG.md`의 2026-09-14 "Path Check를 공유형 '타겟
챌린지'로 확장" 결정에 따른 신규 테이블이다 — 그 앞 항목("개인용 Path
Check")의 "새 테이블 금지, 인덱스 1개만" 제약은 이 결정으로 폐기됐다
(§8 참고).

```sql
CREATE TABLE target_challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token text NOT NULL,
  display_name text NOT NULL,
  target_instagram_username_hash text NOT NULL,
  creator_participant_id uuid NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  is_public boolean NOT NULL DEFAULT false,      -- 2026-09-15 신규, 홈 공개 목록
  share_count integer NOT NULL DEFAULT 0,        -- 2026-09-15 신규, 운영자 전용 지표
  target_instagram_username_masked text,         -- 2026-09-19 신규, 마스킹 표시용(아래 참고)
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX target_challenges_token_key ON target_challenges (token);
CREATE UNIQUE INDEX target_challenges_target_hash_key ON target_challenges (target_instagram_username_hash);
```

- `token`: 외부에 공유하는 opaque random 값(추측 불가능해야 함, 다른 토큰
  들과 같은 방식으로 발급 — `randomBytes(16).toString("hex")`).
- `display_name`: 챌린지를 만든 사람이 입력한 표시 이름. **검증된
  인물명이 아니다** — Instagram API·profile scraping으로 자동 채우거나
  검증하지 않는다. 오타·별명이어도 그대로 저장하고 그대로 보여준다.
  2026-09-15 추가 결정으로 동일 target이면 챌린지를 하나로 합치므로,
  최초 생성 시점 값이 계속 유지된다(이후 같은 target으로 제출된 다른
  displayName은 버려진다).
- `target_instagram_username_hash`: `hashInstagramUsername()`으로 만든
  해시만 저장한다 — Instagram username 원문은 이 테이블에도, 다른 어떤
  테이블에도 저장하지 않는다. **UNIQUE다(2026-09-15 결정)** — 같은
  target으로는 챌린지를 중복 생성하지 않는다. `POST /api/challenges`가
  이 제약 위반을 감지하면 새 행을 만들지 않고 기존 challenge의 `token`을
  돌려준다(`status: "duplicate"`) — 단, 호출자를 그 challenge에 자동으로
  합류시키지는 않는다(§8.2, §8.4).
- `creator_participant_id`: 만든 사람. 이 값은 `GET /api/challenges/{token}`
  응답에 절대 노출하지 않는다(§8.2) — 챌린지를 여는 사람에게 "누가
  만들었는지"를 알려줄 필요·의도가 없다. **user-facing 조회(예: "이 해시로
  challenge 목록 보여줘")는 여전히 만들지 않는다** — 이 UNIQUE 제약은
  "정확한 username을 다시 입력했을 때 같은 challenge로 합류시키는" 용도일
  뿐, challenge 탐색 API의 근거가 아니다.
- `is_public`: **2026-09-15 "홈 공개 챌린지 목록" 결정으로 추가**
  (`0014_loose_adam_destine.sql`). 공개 챌린지 목록 화면(`/challenges`,
  홈에는 이 화면으로 가는 버튼만 둔다)에 노출해도 되는 챌린지인지 여부다.
  **기본값은
  false이고, 사용자용 공개/비공개 설정 UI는 만들지 않는다** — 운영자가
  유명인·크리에이터처럼 공개해도 되는 대상만 직접 SQL로 켠다
  (`UPDATE target_challenges SET is_public = true WHERE token = '…';`).
  사용자가 만든 일반인 대상 챌린지가 자동으로 공개 디렉터리에 올라가는
  경로를 코드·스키마 어디에도 두지 않기 위한 설계다. 공개 대상이 소수라
  별도 인덱스는 두지 않았다. 조회는 `listPublicChallenges`
  (`apps/web/lib/challenges.ts`) 하나뿐이고, 목록을 내보내는 공개 API
  라우트는 만들지 않는다 — 홈과 `/challenges`의 서버 컴포넌트가 직접 읽는다.
- 참여 현황("312명 참여")은 `challenge_participants` 행 수를 그대로 센다
  (§4.11) — 별도 집계 테이블을 만들지 않았다. 이 숫자는 장식이 아니라 그
  챌린지 탐색의 실제 start-set 크기다.
- `share_count`: **2026-09-15 결정으로 추가**(`0015_first_psynapse.sql`).
  "챌린지 공유하기"가 실제로 공유/복사까지 완료된 횟수 — 눌렀다고 세지
  않고, `navigator.share`/클립보드 복사가 성공적으로 끝났을 때만 1
  증가한다(`incrementChallengeShareCount`, `POST /api/challenges/{token}/share`).
  **운영자 전용 지표다.** `challengePublicResultSchema`를 비롯해 어떤
  공개 API 응답에도 이 값을 싣지 않는다 — 운영자가 SQL로 직접 조회해야만
  볼 수 있다. GA4의 `challenge_share` 이벤트에 챌린지 식별자를 넣지 않는
  것과 같은 이유(비공개 챌린지의 `display_name`을 구글 같은 제3자
  서비스로 내보내지 않기 위해)로, 챌린지별 집계는 이 컬럼처럼 우리 DB
  안에서만 쌓는다. 로그인 여부와 무관하게 증가한다 — `/t/{token}`은
  비로그인 방문자도 열 수 있는 공개 화면이라 공유도 로그인 없이
  일어날 수 있다.
- `target_instagram_username_masked`: **2026-09-19 "masked Instagram
  username 공개 표시" 결정으로 추가**(nullable, unique 제약 없음,
  `0016_youthful_microchip.sql`). `target_instagram_username_hash`(HMAC)는
  복원 불가능하므로, 챌린지 생성 시점에 정규화된 raw username으로부터
  `maskInstagramUsername()`(`apps/web/lib/instagram-identity.ts`)이 별도로
  계산한 표시용 문자열(예: `@ple****os`)만 저장한다. raw username 자체는
  이 컬럼을 포함해 어떤 테이블에도 저장하지 않는다(원칙 유지, §1 원칙 2).
  `GET /api/challenges/{token}` 응답에 그대로 노출해 `/t/{token}` 참여자가
  "내가 생각하는 그 대상이 맞는지" 확인하는 용도로만 쓰며, identity
  matching·검색·lookup에는 쓰지 않는다. 과거에 생성된 챌린지는 이 값이
  NULL로 남고, 해시로부터 소급 계산하지 않는다 — `/t/{token}` 화면은 NULL
  이면 이 영역 자체를 렌더링하지 않는다.

### 4.10 `follows`에 필요한 인덱스 — 2026-09-14 (적용됨)

타겟 챌린지의 Path Check(§8, `02_API_SPECS.md`)는
`follows.followee_identity_hash`만으로 행을 찾아야 한다(어떤 참여자가
올렸는지는 모른 채 대상 해시만 갖고 시작하므로). 그런데 기존 유니크
제약은 `(follower_participant_id, followee_identity_hash)` 복합키라(§2),
선행 컬럼이 `follower_participant_id`인 탓에 `followee_identity_hash`만으로
조회하면 이 인덱스를 효율적으로 타지 못한다.

```sql
CREATE INDEX follows_followee_identity_hash_idx
  ON follows (followee_identity_hash);
```

원문 저장이나 새 테이블 없이 순수 조회 성능을 위한 단일 컬럼 인덱스
추가일 뿐이다. 마이그레이션 생성·적용 완료(`0010_uneven_aaron_stack.sql`).

### 4.11 챌린지 참여(`challenge_participants`) — 2026-09-15 협업형 챌린지

`00_PRODUCT_DECISION_LOG.md`의 2026-09-15 "협업형 챌린지" 결정에 따른 신규
테이블이다. 챌린지의 그래프 탐색 시작점(start-set) 멤버십만 기록하는 순수 join
table이다 — 새 edge를 만들지 않는다.

```sql
CREATE TABLE challenge_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id uuid NOT NULL REFERENCES target_challenges(id) ON DELETE CASCADE,
  participant_id uuid NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  joined_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (challenge_id, participant_id)
);
```

- `/t/{token}` 페이지 뷰만으로는 행이 생기지 않는다("인스타에서 연결
  가져오기"로 실제 가져오기를 완료했을 때 `InstagramImportFlow`가
  참여로 등록한다 — `apps/web/lib/challenges.ts`의 `joinChallenge`).
- 챌린지 생성자는 `createChallenge` 트랜잭션 안에서 자동으로 첫 참여자가 된다.
- `UNIQUE(challenge_id, participant_id)`의 선행 컬럼이 `challenge_id`라
  "이 챌린지의 start-set 전체 조회"(`computeChallengeProgress`가 매 요청마다
  필요로 하는 조회)가 이 유니크 인덱스를 그대로 탄다 — `follows`와 달리 별도
  단일 컬럼 인덱스가 필요 없다.
- soft-delete/탈퇴 컬럼을 두지 않는다 — `acquaintance_confirmations`와 같은
  이유로, 참여를 되돌리는 기능은 제공하지 않는다.
- 마이그레이션: `packages/db/migrations/0011_oval_invaders.sql`.

### 4.12 마지막 연결자 공개 동의(`participants.public_connector_name_consent_at`) — 2026-09-15

`00_PRODUCT_DECISION_LOG.md`의 2026-09-15 "마지막 연결자 닉네임 조건부 공개"
결정에 따른 컬럼이다. 새 테이블이 아니라 `participants`에 컬럼 하나를
추가하는 것으로 충분했다 — "이 사람이 마지막 연결자로 계산됐을 때
displayName을 공개해도 되는지"는 참여자 한 명당 값 하나로 표현되기
때문이다.

```sql
ALTER TABLE participants
  ADD COLUMN public_connector_name_consent_at timestamptz;
```

- NULL이 기본값이자 안전한 쪽이다 — NULL이면 어떤 경우에도 공개하지 않는다.
- `apps/web/lib/participants.ts`의 `setDisplayName`이 **표시 이름을 처음
  설정하는 순간에만** 이 값을 채운다(`display_name IS NULL`이었던 행만).
  이미 표시 이름이 있는 상태에서 다시 호출돼도 이 값은 건드리지 않는다 —
  현재 UI에서 이 함수의 유일한 호출부(화면 02)가 "길의 마지막 연결자가
  되면 이 이름이 챌린지에 표시될 수 있어요"라는 고지를 보여준 뒤에만
  제출을 받으므로, 최초 제출 = 동의로 본다.
- 이 컬럼이 추가되기 전에 이미 표시 이름을 설정한 기존 participant는
  이 문구를 본 적이 없으므로 값이 계속 NULL로 남는다 — 소급 공개되지
  않는다는 뜻이다.
- 마이그레이션: `packages/db/migrations/0013_true_ogun.sql`.

## 5. Related Documents

- **Concept_Design**: N/A - [00_DEVELOPMENT_PRINCIPLES.md §6](./00_DEVELOPMENT_PRINCIPLES.md#6-related-documents)와
  동일한 사유.
- **Technical_Specs**: [Development Principles](./00_DEVELOPMENT_PRINCIPLES.md) -
  Privacy-by-Design 원칙 및 전체 아키텍처 근거
- **Technical_Specs**: [API Specs](./02_API_SPECS.md) - 이 스키마를 사용하는
  엔드포인트 명세 및 초대/consent 플로우
- **Technical_Specs**: [Invite Graph v2 Spec](./03_INVITE_GRAPH_V2_SPEC.md) -
  `oauth_accounts`/`acquaintance_links`/`acquaintance_confirmations` 설계 근거(TASK-003)
