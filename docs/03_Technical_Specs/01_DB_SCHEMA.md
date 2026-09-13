# DB Schema & Identity/Graph Design
> Created: 2026-09-10 22:30
> Last Updated: 2026-09-13

**DB 엔진**: PostgreSQL. Turso(libSQL)로 바꾸는 걸 검토했다가, 이 워크로드가
SQLite 계열의 장점을 살릴 수 없고 마이그레이션 비용 대비 얻는 게 없어 다시
PostgreSQL로 확정했다 — 경위는
[00_DEVELOPMENT_PRINCIPLES.md §1.3](./00_DEVELOPMENT_PRINCIPLES.md#13-db-postgresql-tursolibsql-검토했다가-되돌림-그래프-전용-db는-여전히-사용하지-않음)
참고. 아래 스키마는 실제 코드(`packages/db/src/schema.ts`, `pgTable`)와 동일한
PostgreSQL 타입으로 표기한다.

이 문서는 두 가지 핵심 결정을 다룬다: (1) Instagram username을 서버에서 어떻게
식별/매칭할지, (2) 참여자 사이의 관계(edge)를 어떤 데이터 구조로 저장할지. 두
결정은 서로 얽혀 있으므로(식별자가 곧 그래프 노드 키) 하나의 문서로 다룬다.
2026-09-13부터 (2)의 1차 소스는 mutual-follow가 아니라 지인 확인 링크다(§4).
**TASK-003(v2, 구현 완료) 갱신**: 지인 확인 링크가 1회용 `pair_invites`에서
재사용 가능한 `acquaintance_links`/`acquaintance_confirmations`로 바뀌었고,
카카오 로그인(`oauth_accounts`)과 사용자 표시 이름(`participants.display_name`)이
추가됐다. 상세 설계 근거는 [03_INVITE_GRAPH_V2_SPEC.md](./03_INVITE_GRAPH_V2_SPEC.md)
참고.

## 1. 엔티티 개요

```text
participants (1) ──< follows >── identity_hash(참여 여부 무관)
participants (1) ──< sessions
participants (1) ──< oauth_accounts                      -- 카카오 로그인 동일인 판별
participants (1) ──< pair_invites (inviter) >── pair_invites (recipient) >── (1) participants   -- 비활성 보존
pair_invites (1) ── pair_results (1)                      -- 비활성 보존
participants (1) ──< acquaintance_links (owner)
acquaintance_links (1) ──< acquaintance_confirmations >── (1) participants (confirmer)
```

- `participants`: 그래프의 노드. **오직 실제로 자기 데이터를 업로드했거나
  최소 부트스트랩/카카오 로그인으로 참여를 확정한 사람만** 담는다 —
  "고스트" 노드는 없다(participant-only 그래프, §4 참고). Instagram username
  기반(`upsertParticipant`), Instagram 없는 최소 부트스트랩
  (`createBootstrapParticipant`), 카카오 로그인(`findOrCreateKakaoParticipant`,
  이상 모두 `apps/web/lib/participants.ts`) 세 경로가 같은 테이블에 행을
  만든다. `display_name`은 TASK-003(v2)부터 추가된 nullable 컬럼으로,
  사용자가 화면 02에서 직접 입력한 값만 담는다 — 로그인 프로필에서 자동으로
  채우지 않는다(§4.6).
- `oauth_accounts`: TASK-003(v2) 신규. 카카오 `(provider, providerAccountId)`로
  동일 사용자를 판별해 `participants`에 연결한다(§4.6).
- `follows`: 한 참여자가 "나는 이 사람을 팔로우한다"고 신고한 방향성 있는 주장.
  이것만으로는 그래프에 edge가 생기지 않는다 — 상대도 참여해서 반대 방향을
  신고해야 mutual로 확정된다(§4.2 소스 2, 후순위 유지).
- `sessions`: 로그인 없이 "내 결과 다시 보기"를 지원하기 위한 최소 세션 —
  카카오 로그인도 이 테이블의 httpOnly 쿠키 세션을 그대로 재사용한다(Auth.js
  자체 세션은 OAuth 핸드셰이크 동안만 쓰이고 저장되지 않는다, §4.6).
- `pair_invites` / `pair_results`: TASK-002가 도입한 1회용 "우리 몇다리?"
  consent 플로우의 상태 저장소([02_API_SPECS.md §3](./02_API_SPECS.md#3-초대consent-플로우)).
  TASK-003(v2) 이후 **비활성 보존**(§4.7) — `getAllEdges()`가 더 이상 이
  테이블을 조회하지 않는다.
- `acquaintance_links` / `acquaintance_confirmations`: TASK-003(v2) 신규,
  지금 유일한 edge 소스(§4.2). 재사용 가능한 지인 링크와 그 확인 기록이다.

## 2. 테이블 정의

```sql
participants
  id                  uuid PK default gen_random_uuid()
  identity_hash       text UNIQUE NOT NULL       -- §3 참고, 평문 username 아님
  recovery_token      text UNIQUE NOT NULL
  display_name        text                       -- nullable, TASK-003(v2) 신규. §4.6 참고
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
  존재 여부를 알려주는" API가 있으면 사실상 검색 기능이 부활한다. 이 문제는 API
  설계로 막는다 — [02_API_SPECS.md §1](./02_API_SPECS.md#1-서버가-절대-받지-않는-것)
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

## 4. 그래프 저장 구조 (지인 확인 기반 edge — Instagram 맞팔·1회용 링크는 비활성 보존)

> **TASK-003(v2, 구현 완료) 갱신**: 지금 유일한 edge 소스는
> `acquaintance_confirmations`다(§4.2). TASK-002가 유일한 소스로 썼던
> `pair_invites`는 이번 라운드부터 `follows`와 같은 취급(코드/스키마 보존,
> `getAllEdges()`는 조회 안 함)을 받는다(§4.7). 카카오 로그인·표시 이름
> 저장 구조는 §4.6 참고. 설계 근거 전체는
> [03_INVITE_GRAPH_V2_SPEC.md](./03_INVITE_GRAPH_V2_SPEC.md) 참고.

### 4.1 검토한 옵션

| 옵션 | 방식 | 장점 | 단점 |
| :--- | :--- | :--- | :--- |
| A | 전용 그래프 DB (Neo4j, Dgraph 등) | 다중 홉 순회에 최적화 | 별도 스테이트풀 시스템 운영 부담(백업/모니터링 이중화), MVP 규모에서 이점을 체감하기 어려움 |
| B | PostgreSQL 관계형 테이블 + 요청 시 인메모리 BFS | 데이터스토어 단일화, 이미 검증된 드라이버/툴링(§00_DEVELOPMENT_PRINCIPLES §1.3) | 그래프가 매우 커지면(수백만 edge) 매 요청 전체 스캔이 느려짐 |

### 4.2 채택안: B (PostgreSQL + 요청 시 인메모리 BFS), 유일한 활성 소스는 `acquaintance_confirmations`

**모델(TASK-003(v2) 확정)**: `getAllEdges()`(`apps/web/lib/participants.ts`)가
매 요청마다 `acquaintance_confirmations`를 `acquaintance_links`와 조인해 edge
목록을 만든다. 새 edge 전용 테이블을 따로 두지 않는 원칙은 그대로 유지한다 —
확인 기록 테이블의 행 자체가 edge다.

**활성 소스 — 재사용 지인 링크 확인(`acquaintance_confirmations`)**:
수신자가 화면 04 "{표시 이름}님을 알고 있나요?"에서 "네, 알고 있어요"를 눌러
`POST /api/links/{token}/confirm`을 호출하면(`confirmAcquaintanceLink`,
`apps/web/lib/acquaintance-links.ts`), 그 링크의 `owner_participant_id`와
확인한 사람(`confirmer_participant_id`) 쌍이 곧 edge가 된다. 링크 소유자
쪽 재확인은 요구하지 않는다 — 수신자의 한쪽 확인만으로 edge가 즉시
만들어진다(근거: 결정 로그 2026-09-13 항목, v2 명세 §2.4). 같은 사람이 같은
링크를 두 번 확인해도(멱등) 성공 처리되고 edge가 중복 생기지 않는다(UNIQUE
제약).

```sql
SELECT DISTINCT
  LEAST(al.owner_participant_id, ac.confirmer_participant_id) AS a,
  GREATEST(al.owner_participant_id, ac.confirmer_participant_id) AS b
FROM acquaintance_confirmations ac
JOIN acquaintance_links al ON al.id = ac.link_id
```

**비활성 보존 — 1회용 지인 링크(`pair_invites`)**: TASK-002가 유일한 소스로
썼던 쿼리다. 코드(`getLegacyPairInviteEdges`, `apps/web/lib/participants.ts`)와
스키마 모두 삭제하지 않았지만, `getAllEdges()`는 더 이상 이 쿼리를 실행하지
않는다 — 상세는 §4.7.

```sql
-- getAllEdges()가 더 이상 실행하지 않는 쿼리 — 참고용으로만 남긴다.
SELECT DISTINCT
  LEAST(inviter_participant_id, recipient_participant_id) AS a,
  GREATEST(inviter_participant_id, recipient_participant_id) AS b
FROM pair_invites
WHERE status = 'accepted' AND recipient_participant_id IS NOT NULL
```

**비활성 보존 — Instagram 맞팔(`follows`)**: 각 참여자가 자기 following만
업로드한다(followers는 아예 받지 않는다). 코드는 여전히 다음 조건이 모두
성립할 때 A-B를 mutual-follow로 판정할 수 있는 자기 조인 쿼리를 갖고 있다:

1. A가 `follows`에 "A → B" 방향을 신고했다 (A의 following.json에 B가 있음).
2. B도 참여자로 존재하고, `follows`에 "B → A" 방향을 신고했다 (B의
   following.json에 A가 있음).

```sql
-- getAllEdges()가 더 이상 실행하지 않는 쿼리 — 참고용으로만 남긴다.
SELECT DISTINCT f1.follower_participant_id AS a, p2.id AS b
FROM follows f1
JOIN participants p1 ON p1.id = f1.follower_participant_id
JOIN participants p2 ON p2.identity_hash = f1.followee_identity_hash
JOIN follows f2 ON f2.follower_participant_id = p2.id
  AND f2.followee_identity_hash = p1.identity_hash
WHERE f1.follower_participant_id < p2.id
```

`/api/upload`, `ig-parser`, `ImportOnboarding`/`UploadFlow`, `follows` 테이블,
`syncFollowingBatch`는 모두 삭제하지 않고 그대로 남아 있다 — 다만
`getAllEdges()`가 이 쿼리를 실행하지 않으므로, 두 사람이 아무리 서로를
following으로 신고해도(맞팔이어도) 그 자체만으로는 그래프에 edge가 생기지
않는다. `AGENTS.md` §1 원칙 5("지인 전용 초대 링크로 상대가 직접 확인했을
때만 그래프에 edge가 생긴다... Instagram 팔로우 데이터는 edge 생성에 쓰지
않는다")를 코드 레벨에서 그대로 강제하기 위한 선택이다. 결정 로그가 명시한
"edge 확정 기준은 지인 확인 방식으로 통일한다"는 재검토 조건에 따라, 향후
Instagram 연동을 다시 붙이더라도 맞팔 자체가 edge 확정 기준이 되는 일은
없다(연결 후보 추천 등 보조 용도로만 재검토 — 그 경우도 이 섹션을 다시
갱신한다).

`pair_invites` accepted 행으로 골라낸 edge들로 `Map<NodeId, Set<NodeId>>`
인접 리스트를 구성하고, 그 위에서 BFS로 최단 거리를 계산한다
(`packages/graph`, 이 조회 로직과 완전히 분리돼 있어 전혀 손대지 않았다).

- **참여자 생성 경로가 세 개다.** `upsertParticipant`(Instagram username 기반,
  `identityHash`가 실제 해시), `createBootstrapParticipant`(Instagram 없는
  최소 부트스트랩, `identityHash`가 무작위 opaque 값 `bootstrap:<hex>`),
  `findOrCreateKakaoParticipant`(카카오 로그인, `identityHash`가 opaque 값
  `kakao:<hex>`, 동일인 판별은 `oauth_accounts`가 담당, §4.6)가 모두 같은
  `participants` 테이블에 행을 만든다 — 그래프 관점에서는 셋 다 동등한
  노드다(§3.6 participant-only 원칙 유지).
- **재업로드**: 참여자가 다시 업로드하면 그 사람이 follower인 `follows` 행을
  여전히 전부 지우고 새 목록으로 교체한다(`syncFollowingBatch`) — 하지만
  `getAllEdges()`가 `follows`를 조회하지 않으므로, 이 동기화는 지금은
  그래프 결과에 아무 영향을 주지 않는다(Instagram 연동을 다시 활성화할
  경우를 대비한 보존 로직). `pair_invites`/`acquaintance_links` 쪽은
  재업로드로 바뀌지 않는다(둘 다 Instagram 업로드와 무관한 별도 흐름).
- **규모 추정**: MVP 단계 참여자 수천~수만, `acquaintance_confirmations` 행
  수는 참여자 수와 같은 자릿수로 늘어난다. 이 테이블만 읽어 BFS를 도는
  비용은 이 규모에서 수십 ms 이내로,
  [00_DEVELOPMENT_PRINCIPLES.md §4](./00_DEVELOPMENT_PRINCIPLES.md#4-성능ux-목표)의
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

### 4.4 reported vs verified edge (해결됨 — §4.2가 사실상 verified-only 모델)

**이전 검토(2026-09-11)**: 당시 모델(followers ∩ following 자기 신고)은 A
혼자 업로드해도 A-X edge가 생겨서, X 쪽 데이터로 독립 검증하지 않는다는 한계가
있었다. `reported`(한쪽만 주장) → `verified`(양쪽 다 확인) 상태를 나중에
추가하는 방향을 고려한다고 적어뒀었다.

**현재 상태(2026-09-12)**: §4.2로 모델을 바꾸면서 이 구분이 필요 없어졌다 —
`follows`는 항상 한쪽 방향의 신고(reported)만 담고, `getAllEdges()`가 양방향이
모두 존재할 때만 edge로 인정하므로, **그래프에 나타나는 모든 edge는 이미
verified다.** `reported`이지만 아직 `verified`가 아닌 관계(상대가 참여 안 했거나
아직 맞팔이 아님)는 `follows`에는 남아있지만 BFS가 순회하는 그래프에는 전혀
등장하지 않는다 — 별도 `verified` 컬럼 없이 조인 조건 자체가 그 역할을 한다.

### 4.5 향후 고려사항: 분석 이벤트에는 raw distance를 그대로 사용

나중에 분석 도구(GA 등)를 붙이게 되면, BFS distance(edge 개수, 예:
`connection_distance = 2`)를 그대로 이벤트 값으로 보내고, 화면 문구("한 다리
건너 아는 사이")는 순수하게 표시용으로만 분리해서 다룬다 — 분석 데이터와
UX 카피 변환을 섞지 않는다. 관련 변환 함수는
[apps/web/lib/distance-copy.ts](../../apps/web/lib/distance-copy.ts)에 있다.

## 5. Related Documents

- **Concept_Design**: N/A - [00_DEVELOPMENT_PRINCIPLES.md §6](./00_DEVELOPMENT_PRINCIPLES.md#6-related-documents)와
  동일한 사유.
- **Technical_Specs**: [Development Principles](./00_DEVELOPMENT_PRINCIPLES.md) -
  Privacy-by-Design 원칙 및 전체 아키텍처 근거
- **Technical_Specs**: [API Specs](./02_API_SPECS.md) - 이 스키마를 사용하는
  엔드포인트 명세 및 초대/consent 플로우
- **Technical_Specs**: [Invite Graph v2 Spec](./03_INVITE_GRAPH_V2_SPEC.md) -
  `oauth_accounts`/`acquaintance_links`/`acquaintance_confirmations` 설계 근거(TASK-003)
