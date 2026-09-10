# DB Schema & Identity/Graph Design
> Created: 2026-09-10 22:30
> Last Updated: 2026-09-10 23:10

**DB 엔진**: [00_DEVELOPMENT_PRINCIPLES.md §1.3](./00_DEVELOPMENT_PRINCIPLES.md#13-db-turso--libsql-postgresql에서-변경-그래프-전용-db는-여전히-사용하지-않음)에서
PostgreSQL 대신 Turso(libSQL, SQLite 호환)로 확정했다. 아래 스키마와 §4의 그래프
저장 구조 결론은 엔진 변경과 무관하게 유지되며, 타입 표기만 SQLite 계열 기준으로
갱신했다.

이 문서는 두 가지 핵심 결정을 다룬다: (1) Instagram username을 서버에서 어떻게
식별/매칭할지, (2) 참여자 사이의 mutual-follow 관계를 어떤 데이터 구조로 저장할지.
두 결정은 서로 얽혀 있으므로(식별자가 곧 그래프 노드 키) 하나의 문서로 다룬다.

## 1. 엔티티 개요

```text
participants (1) ──< relationships >── (1) participants
participants (1) ──< sessions
participants (1) ──< pair_invites (inviter) >── pair_invites (recipient) >── (1) participants
pair_invites (1) ── pair_results (1)
```

- `participants`: 그래프의 노드. 실제로 서비스에 업로드한 사람과, 누군가의 맞팔
  목록에만 등장한 "고스트" 노드를 모두 포함한다 (§3.3).
- `relationships`: 그래프의 무방향 edge. 맞팔 관계만 저장한다.
- `sessions`: 로그인 없이 "내 결과 다시 보기"를 지원하기 위한 최소 세션.
- `pair_invites` / `pair_results`: "우리 몇다리?" consent 플로우의 상태 저장소
  ([02_API_SPECS.md §3](./02_API_SPECS.md#3-초대consent-플로우)에서 흐름을 다룬다).

## 2. 테이블 정의

```sql
participants
  id                  text PK                    -- UUID 문자열, 애플리케이션에서 생성
  identity_hash       text UNIQUE NOT NULL       -- §3 참고, 평문 username 아님
  has_uploaded_own_data integer NOT NULL default 0  -- boolean (0/1)
  created_at          integer NOT NULL           -- unix ms epoch

sessions
  token               text PK                    -- 무작위 256bit, httpOnly 쿠키 값
  participant_id      text NOT NULL REFERENCES participants(id) ON DELETE CASCADE
  created_at          integer NOT NULL
  expires_at          integer NOT NULL

relationships
  id                  text PK                    -- UUID 문자열
  participant_a_id    text NOT NULL REFERENCES participants(id) ON DELETE CASCADE
  participant_b_id    text NOT NULL REFERENCES participants(id) ON DELETE CASCADE
  created_at          integer NOT NULL
  UNIQUE (participant_a_id, participant_b_id)     -- 항상 a_id < b_id로 정규화 저장

pair_invites
  id                       text PK                -- UUID 문자열
  token                    text UNIQUE NOT NULL   -- 무작위 128bit, URL에 노출됨
  inviter_participant_id   text NOT NULL REFERENCES participants(id) ON DELETE CASCADE
  recipient_participant_id text REFERENCES participants(id) ON DELETE CASCADE  -- accept 전 NULL
  status                   text NOT NULL default 'pending'  -- pending | accepted | expired
  created_at               integer NOT NULL
  expires_at               integer NOT NULL

pair_results
  id             text PK                          -- UUID 문자열
  pair_invite_id text UNIQUE NOT NULL REFERENCES pair_invites(id) ON DELETE CASCADE
  distance       integer                          -- NULL이면 도달 불가
  computed_at    integer NOT NULL
```

**SQLite/libSQL 타입 매핑 메모** (PostgreSQL 버전 초안 대비 변경점):
- `uuid` → `text`. SQLite 계열에는 UUID 타입이나 `gen_random_uuid()` 같은 기본값
  함수가 없으므로, `crypto.randomUUID()`로 애플리케이션 코드에서 생성해 넣는다
  (Drizzle의 `$defaultFn(() => crypto.randomUUID())`).
- `timestamptz` → `integer` (unix ms epoch). Drizzle의
  `integer(col, { mode: "timestamp_ms" })`가 JS `Date` ↔ integer 변환을 투명하게
  처리한다.
- `boolean` → `integer` (0/1). Drizzle의 `integer(col, { mode: "boolean" })`가
  JS `boolean` ↔ integer 변환을 투명하게 처리한다.
- `ON CONFLICT (identity_hash) DO UPDATE ... RETURNING`(upsert-by-natural-key
  패턴, §3.3에서 상세)은 SQLite 3.35+/libSQL에서도 Postgres와 동일한 `excluded.*`
  문법으로 동작하므로 이 부분의 설계는 변경 없음.

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
- `normalize()`는 클라이언트(mutual 교집합 계산 시)와 서버(해싱 직전)에서 동일한
  규칙으로 적용해야 한다 — 규칙이 어긋나면 같은 사람이 다른 해시로 갈라진다.
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

### 3.6 Ghost 노드와 참여자 정의 (미해결)

A가 업로드하면 A의 맞팔 상대(B, C, D)도 `has_uploaded_own_data = false`인 "고스트"
노드로 그래프에 즉시 생성된다 — B가 서비스를 열어본 적이 없어도. 기획서 4장의
"2다리 안 236명" 같은 숫자가 실제 서비스 사용자 수보다 커질 수 있다는 뜻이다.

**결정 필요**: 개인 결과의 분모("현재 참여자의 71%")를 계산할 때 (a) 그래프에
노드로 등장한 모든 사람을 참여자로 셀지, (b) `has_uploaded_own_data = true`인
사람만 참여자로 셀지 제품 결정이 필요하다. 스키마는 플래그를 분리해두어 두 정의를
모두 지원하지만, 문구("참여자")가 사용자에게 무엇을 의미하는지는 결정된 바 없다.

## 4. Mutual-Follow 그래프 저장 구조

### 4.1 검토한 옵션

| 옵션 | 방식 | 장점 | 단점 |
| :--- | :--- | :--- | :--- |
| A | 전용 그래프 DB (Neo4j, Dgraph 등) | 다중 홉 순회에 최적화 | 별도 스테이트풀 시스템 운영 부담(백업/모니터링 이중화), MVP 규모에서 이점을 체감하기 어려움 |
| B | Turso(libSQL) 관계형 테이블 + 요청 시 인메모리 BFS | 데이터스토어 단일화, 서버 프로세스 없이 로컬 개발 가능(§00_DEVELOPMENT_PRINCIPLES §1.3) | 그래프가 매우 커지면(수백만 edge) 매 요청 전체 스캔이 느려짐 |

### 4.2 채택안: B (Turso/libSQL + 요청 시 인메모리 BFS)

- `relationships` 테이블에서 전체 edge를 읽어 `Map<NodeId, Set<NodeId>>` 인접
  리스트를 구성하고, 그 위에서 BFS로 최단 거리를 계산한다.
- **규모 추정**: MVP 단계 참여자 수천~수만, 1인당 맞팔 수를 넉넉히 수백 명으로
  잡아도 edge 수는 수만~십만대. 이 규모에서 인접 리스트 구성 + BFS는 수십 ms
  이내로, [00_DEVELOPMENT_PRINCIPLES.md §4](./00_DEVELOPMENT_PRINCIPLES.md#4-성능ux-목표)의
  P95 400ms 목표에 여유 있게 들어온다.
- **무방향 edge 중복 방지**: `(participant_a_id, participant_b_id)`를 항상
  `a_id < b_id` 문자열 비교 순서로 저장해서 (A,B)/(B,A) 중복 저장을 애플리케이션
  레이어에서 막는다.

### 4.3 스케일 전환 계획 (지금 만들지 않음)

아래 조건 중 하나에 해당하면 재검토한다. 지금은 구현하지 않고 조건만 기록해둔다.

- 프로파일링 결과 `GET /api/me/result`의 P95가 400ms 목표를 지속적으로 초과할 때.
- edge 수가 대략 50만~100만을 넘어설 때(추정치, 실측으로 재조정).
- 대응 후보(우선순위 순): (1) 요청마다 전체 재조회 대신 짧은 TTL의 인메모리 그래프
  스냅샷 캐시, (2) edge 추가 시 영향받는 참여자만 델타 재계산, (3) Turso의 embedded
  replica(로컬 파일에 원격 DB를 동기화해두는 기능)로 읽기 지연을 줄이는 것 — 단,
  서버리스 배포(Vercel 등)에서는 함수 인스턴스가 매번 새로 뜨므로 이 기능의 이점이
  제한적이다. 그 이상으로 그래프 자체의 순회 성능이 병목이 되면(예: 임의 N-hop 쿼리,
  커뮤니티 탐지 등 복잡한 그래프 연산이 필요해지면), libSQL 계열에는 PostgreSQL의
  Apache AGE 같은 인그래프 확장이 없으므로 전용 그래프 DB(Neo4j 등)로의 이전을
  검토한다 — 즉 "관계형 DB 안에서 그래프 확장을 얹는" 중간 단계 없이 옵션 A로 바로
  넘어가는 것이 libSQL 기준의 현실적인 스케일 경로다.

## 5. Related Documents

- **Concept_Design**: N/A - [00_DEVELOPMENT_PRINCIPLES.md §6](./00_DEVELOPMENT_PRINCIPLES.md#6-related-documents)와
  동일한 사유.
- **Technical_Specs**: [Development Principles](./00_DEVELOPMENT_PRINCIPLES.md) -
  Privacy-by-Design 원칙 및 전체 아키텍처 근거
- **Technical_Specs**: [API Specs](./02_API_SPECS.md) - 이 스키마를 사용하는
  엔드포인트 명세 및 초대/consent 플로우
