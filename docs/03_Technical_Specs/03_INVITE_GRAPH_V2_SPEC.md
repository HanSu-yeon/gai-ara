# 지인 확인 그래프 v2: 카카오 로그인 · 표시 이름 · 재사용 링크 명세
> Created: 2026-09-13
> Last Updated: 2026-09-13

## 범위와 상태

초안. TASK-002(1회용 `pair_invites` 토큰 기반 최소 슬라이스)는 구현·검증 완료
상태다. 이 문서는 그 다음 라운드(TASK-003 예정)의 스키마/API 설계를 다룬다 —
[02_INVITE_GRAPH_CONCEPT.md](../02_UI_Screens/02_INVITE_GRAPH_CONCEPT.md)와
[00_PRODUCT_DECISION_LOG.md](../01_Concept_Design/00_PRODUCT_DECISION_LOG.md)
2026-09-13 항목에서 확정한 사용자 여정(로그인·표시 이름·재사용 지인 링크)을 구현
가능한 스키마/엔드포인트로 옮긴 것이다. 아직 코드에는 반영되지 않았다 — 이 문서가
다음 Context Receipt의 근거 문서가 된다.

기존 [01_DB_SCHEMA.md](./01_DB_SCHEMA.md)/[02_API_SPECS.md](./02_API_SPECS.md)는
Instagram 기반 흐름과 TASK-002의 1회용 토큰 모델을 다루며, 참고용으로 남긴다.
`pair_invites`/`pair_results`는 폐기하지 않되 이 v2가 도입되면 `follows`와
같은 취급(코드는 남지만 새 edge 계산에는 관여하지 않음)을 받는다.

## 1. 이번 라운드가 바꾸는 것

| 항목 | TASK-002(현재) | v2(이 문서) |
| :-- | :-- | :-- |
| 참여자 식별 | 부트스트랩 시 매번 새 opaque participant 생성 | 카카오 로그인으로 동일인 판별, 표시 이름 보유 |
| 지인 링크 | 1회용 토큰, 링크당 정확히 1명만 accept 가능 | 재사용 가능, 인원 상한·만료 없음 |
| edge 소스 | `pair_invites.status='accepted'` 행 자체 | `acquaintance_confirmations`(신규) 행 |
| 확인 화면 문구 | "이 사람을 알고 있나요?" (익명) | "{표시 이름}님을 알고 있나요?" |
| 연결 되돌리기 | 없음 | 없음(변경 없음, §2.4 참고) |

## 2. 스키마 변경

### 2.1 `participants`에 표시 이름 추가

```sql
ALTER TABLE participants ADD COLUMN display_name text;  -- NULL 허용(과거 행, 미설정 상태)
```

- 로그인 프로필(카카오 닉네임/프로필 사진)에서 자동으로 채우지 않는다. 화면 02에서
  사용자가 직접 입력한 값만 저장한다(결정 로그 2026-09-13 항목 8).
- `display_name`은 직접 연결된 상대의 화면, 본인 화면, 본인이 만든 공개 링크
  결과에서만 노출한다. 검색이나 임의 조회에는 쓰지 않는다(원칙 3 유지).

### 2.2 `oauth_accounts`(신규) — 동일인 판별

```sql
oauth_accounts
  id                    uuid PK default gen_random_uuid()
  participant_id        uuid NOT NULL REFERENCES participants(id) ON DELETE CASCADE
  provider              text NOT NULL              -- 'kakao' 고정값(§4 참고)
  provider_account_id   text NOT NULL              -- 카카오 고유 회원번호
  created_at            timestamptz NOT NULL default now()
  UNIQUE (provider, provider_account_id)
```

- 로그인 시 `(provider, provider_account_id)`로 조회 → 있으면 그 `participant_id`로
  세션 발급, 없으면 새 `participants` 행 + 이 행을 함께 만든다.
- 이메일 일치만으로 서로 다른 `participants` 행을 자동 병합하지 않는다(결정 로그
  항목 7) — 계정 탈취/오인 연결을 피하기 위함이다.
- 한 participant가 여러 provider 계정을 나중에 추가로 연결할 수 있는 구조지만,
  지금은 provider가 카카오 하나뿐이라 실질적으로는 1:1이다.

### 2.3 `acquaintance_links`(신규) — 재사용 가능한 지인 링크

```sql
acquaintance_links
  id                     uuid PK default gen_random_uuid()
  token                  text UNIQUE NOT NULL        -- 128bit CSPRNG
  owner_participant_id   uuid NOT NULL REFERENCES participants(id) ON DELETE CASCADE
  max_uses               integer NOT NULL default 50 -- 레거시, 현재 판정에 미사용
  expires_at             timestamptz NOT NULL        -- 레거시, 현재 판정에 미사용
  revoked_at             timestamptz                 -- NULL이면 유효
  created_at             timestamptz NOT NULL default now()
```

- 한 participant는 폐기되지 않은 링크를 동시에 하나만 가진다 — 화면
  03이 "재발급"을 누르면 기존 링크를 `revoked_at = now()`로 폐기하고 새로
  만든다. 여러 개를 동시에 발급하는 UI는 이번 범위에 없다.
- `max_uses`/`expires_at`은 기존 DB와의 호환을 위해 남아 있는 레거시 컬럼이며
  유효성 판정에는 사용하지 않는다. 제거를 위한 파괴적 마이그레이션은 별도 백업 후 진행한다.

### 2.4 `acquaintance_confirmations`(신규) — 확인 = edge

```sql
acquaintance_confirmations
  id                          uuid PK default gen_random_uuid()
  link_id                     uuid NOT NULL REFERENCES acquaintance_links(id) ON DELETE CASCADE
  confirmer_participant_id    uuid NOT NULL REFERENCES participants(id) ON DELETE CASCADE
  confirmed_at                timestamptz NOT NULL default now()
  UNIQUE (link_id, confirmer_participant_id)
```

- 한 사람은 같은 링크를 두 번 "확인"할 수 없다(유니크 제약) — 두 번째 확인 요청은
  에러 없이 기존 행 그대로 성공으로 처리한다(멱등).
- 연결을 되돌리는 기능은 두지 않는다. "확인"은 신중하게 눌러야 하는 행동으로
  취급하고, 관계가 나빠졌다는 이유로 edge를 지우면 이 그래프가 재는 "실제로 아는
  사이인가"라는 사실 자체를 왜곡하게 된다(친밀도가 아니라 관계의 존재 여부를
  기록하는 것이 이 그래프의 목적이다). 삭제/soft-delete 컬럼을 두지 않는다.
- edge 소스는 이 테이블의 모든 행이다:

```sql
SELECT DISTINCT
  LEAST(al.owner_participant_id, ac.confirmer_participant_id) AS a,
  GREATEST(al.owner_participant_id, ac.confirmer_participant_id) AS b
FROM acquaintance_confirmations ac
JOIN acquaintance_links al ON al.id = ac.link_id
```

- `getAllEdges()`는 이 쿼리로 바뀌고, TASK-002가 만든 `pair_invites` 기반 쿼리는
  `follows`와 같은 취급(코드 보존, 조회 안 함)을 받는다.

### 2.5 마이그레이션 메모

- 기존 `pair_invites`/`pair_results` 행은 그대로 둔다 — 삭제·이관하지 않는다.
  이미 accepted된 1회용 토큰이 만든 edge를 새 스키마로 옮기고 싶다면(연속성을
  원할 경우) 별도 백필 스크립트로 `pair_invites(status='accepted')` 각 행마다
  `acquaintance_links`(만료 이미 지난 상태로) + `acquaintance_confirmations`
  1건을 생성할 수 있다 — 이번 문서 범위 밖, 필요 시 별도 결정.
- `packages/db/src/schema.ts`에 위 세 테이블/컬럼을 Drizzle `pgTable`로 추가하고
  마이그레이션 파일을 생성한다.

## 3. API 엔드포인트

### 3.1 인증 (카카오 로그인)

**결정**: OAuth는 직접 구현하지 않고 Auth.js(NextAuth)를 도입한다. 이 프로젝트는
지금까지 새 의존성 추가를 최대한 피해왔지만(YAGNI), OAuth는 `state`/PKCE/토큰
검증을 손으로 구현했을 때의 실수가 실제 보안 사고로 이어지는 영역이라 다른
경우와 성격이 다르다고 판단해 명시적 예외로 승인했다(2026-09-13).

- Auth.js의 Kakao 프로바이더를 사용해 `state`/CSRF/토큰 교환을 라이브러리에
  맡긴다. `/api/auth/[...nextauth]` 라우트 하나로 시작/콜백을 모두 처리한다
  (개별 `GET /api/auth/kakao/start`/`callback` 엔드포인트를 직접 만들지 않는다
  — Auth.js가 그 역할을 대신한다).
- Auth.js의 세션 관리를 그대로 쓸지, 아니면 로그인 성공 콜백에서 기존
  `sessions` 테이블 기반 httpOnly 쿠키 발급 로직(`apps/web/lib/session.ts`)으로
  연결할지는 구현 단계에서 정한다 — 이 프로젝트는 이미 자체 세션 테이블이
  있으므로, Auth.js는 OAuth 핸드셰이크 부분만 담당하고 세션 발급은 기존 방식을
  재사용하는 쪽을 우선 검토한다(중복 세션 체계를 만들지 않기 위해).
- 로그인 콜백에서 `provider_account_id` 확보 → `oauth_accounts` 조회/생성 →
  세션 발급 → 표시 이름이 없으면 화면 02(이름 입력)로, 있으면 화면 06(내
  연결)으로 리다이렉트하는 흐름 자체는 변하지 않는다.
- `PATCH /api/me/display-name`
  - 인증: 세션 필수.
  - 요청: `{ displayName: string }` (길이 제한, 공백/빈 문자열 거부).
  - 동작: `participants.display_name` 갱신. 최초 로그인 온보딩(화면 02)과 이후
    설정 변경에 동일하게 쓴다.

### 3.2 지인 링크(재사용)

- `POST /api/links`
  - 인증: 세션 필수.
  - 동작: 호출자의 기존 링크가 있으면 `revoked_at = now()`로 폐기하고 새
    `acquaintance_links` 행 생성. 인원 상한과 만료는 적용하지 않는다.
  - 응답: `{ token }`.
- `GET /api/links/{token}`
  - 인증: 없음(수신자가 로그인 전에 먼저 여는 화면 04이므로).
  - 응답: `{ status: "valid" | "revoked" | "not-found", ownerDisplayName: string | null }`.
    소유자의 participant id·해시는 포함하지 않는다 — 표시 이름만.
- `POST /api/links/{token}/confirm`
  - 인증: 세션 필수(수신자 본인 — 세션이 없으면 먼저 카카오 로그인 화면으로
    보낸다).
  - 인증 이동: `/login?returnTo=/invite/{token}`으로 원래 경로를 보존한다. 공개 링크도
    `/login?returnTo=/r/{token}`으로 같은 구조를 쓴다. `returnTo`는 이 두 내부 경로만
    허용하며 외부 URL은 거부한다.
  - 동작: 트랜잭션 안에서 링크 폐기 여부를 확인한 후 `acquaintance_confirmations`에
    삽입한다(이미 확인한 적 있으면 멱등하게 성공 처리).
  - 에러: 존재하지 않음(404) · 폐기됨(410) · 자기 자신의 링크(400).
  - 응답(성공): `{ ok: true }`. 이후 화면 05는 별도로 `GET /api/me/connections`나
    결과 조회로 상태를 확인한다(TASK-002의 `pair_results` 같은 1:1 결과 캐시는
    이제 필요 없다 — 그래프가 바로 갱신되고 화면 06이 항상 최신 카운트를 보여준다).
- `GET /api/me/connections`
  - 인증: 세션 필수.
  - 응답: 직접 연결 목록(각 항목의 상대 `displayName`, `confirmedAt`). 삭제
    기능은 없으므로 이 목록에 제거용 id는 두지 않는다. 화면 06의 "1촌 몇 명만
    캐릭터로"가 이 응답을 쓴다.

### 3.3 공개(탐색) 링크 — 기존 유지, 표시 이름만 추가

- `referralLinks`/`referralVisits`, `/api/referral-link`, `/api/r/{token}`,
  `/api/r/{token}/result`는 그대로 재사용한다(TASK-002 Context Receipt Q4에서
  이미 확인). 유일한 변경은 `/api/r/{token}` 응답에 소유자 `displayName`을
  추가하는 것 — 화면 08에서 "OO님과 나는 몇 다리 건너 아는 사이일까?" 같은
  개인화된 문구를 쓸 수 있게 한다. 이 링크를 여는 것만으로는 여전히 어떤 edge도
  생기지 않는다.

## 4. 카카오 단일 제공자 결정

로그인 제공자는 카카오만 둔다. 카카오는 사실상 한국에서만 쓰여서, 이 하나로
좁히는 것 자체가 콜드 스타트 전략(전 세계가 아니라 한 국가·커뮤니티에서 먼저
밀도를 만드는 것)과 맞고, OAuth 연동을 하나만 구현하면 되는 이점도 있다. 해외
확장이 실제로 필요해지기 전까지는 다른 제공자를 추가하지 않는다(결정 로그
재검토 조건).

## 5. 미해결 사항

- **[TODO][Low]** 레이트 리밋: `POST /api/links`(링크 재발급 남용), `POST
  /api/links/{token}/confirm`(짧은 시간에 대량 confirm 시도) 모두 아직 제한이
  없다 — 02_API_SPECS.md §4에 이미 있던 미해결 사항과 동일한 성격이라 함께
  처리한다.

## 6. Related Documents

- [제품 결정](../01_Concept_Design/00_PRODUCT_DECISION_LOG.md) — 2026-09-13 항목
- [화면 스토리보드](../02_UI_Screens/02_INVITE_GRAPH_CONCEPT.md)
- [기존 DB 스키마](./01_DB_SCHEMA.md) — TASK-002까지의 기준, 참고용
- [기존 API 명세](./02_API_SPECS.md) — Instagram/1회용 토큰 흐름, 참고용
- [개발 원칙](./00_DEVELOPMENT_PRINCIPLES.md) §3 원칙 5·6
