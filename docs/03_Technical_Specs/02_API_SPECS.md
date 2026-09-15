# API Specs: ZIP 파싱 계약 및 초대/Consent 플로우
> Created: 2026-09-10 22:30
> Last Updated: 2026-09-14

이 문서는 두 가지를 다룬다: (1) Instagram ZIP을 브라우저에서 안전하게 파싱하는 방법과
서버가 실제로 받는 데이터의 계약, (2) "우리 몇다리?" 초대 링크와 consent 플로우의
엔드포인트 명세.

> 2026-09-13: §3의 1회용 `pair_invites` 토큰 흐름은 TASK-002로 구현됐다가,
> TASK-003(v2)에서 §6의 재사용 지인 링크로 대체됐다. **§3이 설명하는 API
> 라우트(`/api/upload`, `/api/invites`, `/api/invites/{token}/accept`,
> `/api/pairs/{token}/result`)와 UI(`/pair/[token]`, `LivePairPage.tsx`)는
> "비활성 보존"이 아니라 실제로 코드베이스에서 삭제됐다** — DB 스키마와
> 조회 함수 하나(`getLegacyPairInviteEdges`)만 `packages/db`/
> `apps/web/lib/participants.ts`에 남아 있다. §3은 삭제된 API의 과거 설계를
> 참고용으로만 남긴 것이다.
> **2026-09-14 갱신**: Instagram 맞팔이 §6.2의 `follows` 경로로 재도입되어
> §6.1의 `acquaintance_confirmations`와 함께 두 번째 활성 edge 소스가
> 됐다(엔드포인트도 `/api/upload`가 아니라 `/api/instagram-import`로
> 바뀌었다, §2.3·§6.2 참고). 같은 날 결정으로 "검색 가능한 범용 조회 API를
> 만들지 않는다"(§1)는 원칙에 Path Check라는 좁은 예외가 추가됐다(§8, 설계
> 확정·미구현). 설계 근거는
> [03_INVITE_GRAPH_V2_SPEC.md](./03_INVITE_GRAPH_V2_SPEC.md)와
> [00_PRODUCT_DECISION_LOG.md](../01_Concept_Design/00_PRODUCT_DECISION_LOG.md)의
> 2026-09-13·2026-09-14 항목 참고.

## 1. 서버가 절대 받지 않는 것

아래는 API 설계 이전에 먼저 정하는 제약이다. 엔드포인트 하나하나보다 이 목록이
우선한다.

- 원본 ZIP 파일. 어떤 엔드포인트도 `multipart/form-data` 파일 업로드를 받지 않는다.
- followers/following 원본 전체 목록(2026-09-14 갱신 — 과거에는 following만
  받았지만, 지금은 그마저도 받지 않는다). 브라우저가 ZIP에서 followers와
  following을 모두 열어보되, 교집합(맞팔)까지 클라이언트에서 계산을 끝내고
  그 결과 username 목록만 서버로 보낸다(`packages/ig-parser`의
  `computeMutuals`, [01_DB_SCHEMA.md §4.2](./01_DB_SCHEMA.md#42-채택안-b-postgresql--요청-시-인메모리-bfs-활성-소스는-두-개)).
- 맞팔이 아닌 일방적 팔로우/팔로잉 데이터. followers ∩ following 교집합에
  없는 관계는 애초에 서버로 오지 않는다.
- 임의의 username에 대한 해시값이나 "이 사람이 참여자인지"를 알려주는 범용
  조회 API. 이런 API가 있으면 사실상 계정 검색 기능이 되어 기획서 6장의
  원칙을 API 레벨에서 깨뜨린다. **예외(2026-09-14, §8)**: 로그인 사용자가
  정확히 아는 username을 직접 입력해 자신과의 거리만 확인하는 단일 목적
  Path Check 엔드포인트 1개만 허용한다 — 응답은 `connected`/`not_connected`
  두 상태로만 합쳐, 대상의 존재·가입 여부 자체는 구분해서 노출하지 않는다.
- 두 참여자 사이의 중간 연결자. 어떤 응답 스키마에도 존재할 수 없다(Path
  Check 응답도 동일하게 적용된다, §8).

## 2. Instagram ZIP 브라우저 파싱 설계

### 2.1 원칙

ZIP은 전부 브라우저에서 열어보고, followers ∩ following 교집합(맞팔)
username 목록만 서버로 보낸다(2026-09-14 갱신 — 과거에는 following만
추출했지만, 지금은 followers까지 함께 읽어 교집합을 먼저 계산한다). 서버는
이 세션에서 이 사람의 ZIP을 본 적이 없다.

### 2.2 안전하게 파싱하기 위한 구체 규칙

| 위험 | 대응 |
| :--- | :--- |
| Zip bomb (압축 해제 시 비정상적으로 큰 크기) | 대상 파일(`followers(_숫자)?.json`, `following.json`)의 압축 해제 전 크기를 확인하고, 임계치(예: 100MB)를 넘으면 해제를 거부하고 안내 메시지를 표시한다. |
| 무관한 대용량 콘텐츠(사진/영상/DM) 압축 해제 | 파일명 패턴(`followers(_숫자)?.json`, `following.json`)에 매칭되는 항목만 압축 해제한다. ZIP 라이브러리는 항목 목록을 먼저 읽고 개별 항목 단위로 지연 압축 해제하므로, 매칭되지 않는 파일은 애초에 해제되지 않는다. |
| 손상되었거나 형식이 다른 JSON | `JSON.parse` 실패 시 해당 파일만 건너뛰고 나머지는 계속 처리한다. 전체 실패로 처리하지 않는다. |
| ZIP 내부 HTML/미디어 파일을 통한 콘텐츠 주입 | Instagram export에는 메시지 스레드 등 HTML 파일도 포함될 수 있다. 이런 파일은 애초에 매칭 패턴에 걸리지 않으므로 열어보지 않으며, 그 어떤 파일 내용도 `innerHTML`이나 스크립트 실행 경로로 넘기지 않는다 — 오직 `JSON.parse`만 호출한다. |
| Export 구조 변경(파일명, JSON 스키마) | 특정 JSON 스키마 하나에 고정하지 않고, JSON 트리를 재귀 탐색해 `string_list_data[].value` 형태의 문자열을 모두 수집하는 방식으로 구조 변화에 견고하게 만든다. |
| 메인 스레드 블로킹(대용량 계정) | MVP 범위 밖의 개선 사항으로 기록: 파싱을 Web Worker로 옮겨 UI 프리징을 방지한다. 일반적인 팔로워 수 규모(수만 이하)에서는 필수는 아니다. |
| 파일 형식 오검증 | `.zip` 확장자 확인은 UX 힌트일 뿐 보안 경계가 아니다. 실제 검증은 ZIP 라이브러리가 유효하지 않은 아카이브를 열려고 할 때 발생하는 예외를 처리하는 것으로 이루어진다. |

### 2.3 클라이언트 → 서버 데이터 계약 (2026-09-14 갱신)

`POST /api/instagram-import` — 로그인(카카오)을 이미 마친 참여자만 호출할
수 있다. 로그인/참여자 생성 수단이 아니다(§4.6·§6.2, [01_DB_SCHEMA.md §1](./01_DB_SCHEMA.md#1-엔티티-개요)).

```ts
// packages/shared/src/schemas.ts의 instagramImportSchema
type InstagramImportRequest = {
  selfUsername: string;        // 본인 계정, 사용자가 직접 입력
  mutualUsernames: string[];   // 이미 교집합(맞팔)까지 계산된 결과, 최대 20,000개
};
```

과거(§3 이전 버전)에는 following 전체 목록을 보내고 맞팔 판정을 서버가
했지만, 지금은 맞팔 판정 자체가 브라우저에서 끝난다 — 서버는
`mutualUsernames` 각각을 해싱해서 `follows`에 그대로 저장할 뿐, 다른
참여자의 목록과 대조하는 계산을 하지 않는다([01_DB_SCHEMA.md §4.2](./01_DB_SCHEMA.md#42-채택안-b-postgresql--요청-시-인메모리-bfs-활성-소스는-두-개)).
요청 바디의 두 username 필드는 해싱 직후 버려진다 — 서버 로그에 남기지
않고 응답에도 포함하지 않는다(`apps/web/app/api/instagram-import/route.ts`).
followers 원본, ZIP 파일, 업로드 시각 외의 메타데이터는 포함하지 않는다.

## 3. 초대/Consent 플로우 (역사적 참고 — 아래 API 라우트는 삭제됨, 상단 2026-09-13/09-14 노트 참고)

### 3.1 설계 목표

기획서 5~6장의 요구사항을 API 레벨에서 강제한다.

- A가 링크를 직접(카카오톡/DM) 전달해야만 B가 참여를 시작할 수 있다 — 앱이
  대신 메시지를 보내지 않는다.
- B는 자기 데이터를 업로드해야만("적극적 동의") 결과가 계산된다. 링크를 여는
  것만으로는 아무 정보도 노출되지 않는다.
- 어느 쪽 요청으로도 상대방의 신원(해시, username)은 절대 응답에 포함되지 않는다.
- 클라이언트는 비교 대상 참여자 ID를 직접 지정할 수 없다 — 비교 대상은 항상
  서버가 들고 있는 초대 레코드의 `inviter_participant_id`/`recipient_participant_id`
  뿐이다. 즉 "임의의 두 사람 사이 거리 조회" API는 구조적으로 존재하지 않는다.

### 3.2 시퀀스

```text
A (참여 완료, 세션 있음)
  │
  │ POST /api/invites
  ▼
서버: pair_invites 생성 (token=난수, status=pending, expires_at=+7일)
  │
  │ { token } 응답 — A의 클라이언트가 링크를 만들어 카카오톡/DM으로 "직접" 전달
  ▼
B, 링크(/pair/{token}) 오픈
  │
  │ GET /api/invites/{token}
  ▼
서버: { status } 만 응답 — inviter가 누구인지는 절대 포함하지 않음
  │
  │ (status가 pending이면) B가 자기 ZIP으로 동일한 업로드 플로우 진행
  │ POST /api/upload  →  B도 참여자가 됨, 세션 발급
  ▼
  │ POST /api/invites/{token}/accept  (B의 세션으로 호출)
  ▼
서버: recipient_participant_id = B, status = accepted
  │
  │ GET /api/pairs/{token}/result
  ▼
서버: 그래프에서 shortestDistance(inviter, recipient) 계산, pair_results에 저장
  │
  ▼
{ status: "connected" | "unreachable", distance: number | null }
```

### 3.3 엔드포인트 명세

#### `POST /api/upload`

- **인증**: 없음(최초 참여) 또는 기존 세션(재참여/업데이트).
- **요청**: `UploadFollowingRequest` (§2.3).
- **동작**: `selfUsername`을 해싱해 참여자 upsert. `followingUsernames`는 각각
  해싱해서 `follows`에 "이 참여자 → 그 해시" 방향 행으로 동기화(재업로드 시
  이전 목록과 diff해서 없어진 건 삭제, 새로 생긴 건 추가). 고스트 참여자나
  edge를 이 시점에 만들지 않는다 — mutual edge는 `GET /api/me/result` 등이
  조회할 때 양방향 `follows`를 대조해서 그때 판정한다([01_DB_SCHEMA.md §4.2](./01_DB_SCHEMA.md#42-채택안-b-postgresql--participant-only-mutual--요청-시-인메모리-bfs)).
- **응답**: `{ ok: true }`. 해시값, 상대방 존재 여부 등은 절대 포함하지 않는다.
- **에러**: 요청 스키마 불일치(400).

#### `GET /api/me/result`

- **인증**: 세션 필수(401 if missing).
- **응답**:
  ```ts
  type MeResult = {
    distanceCounts: { direct: number; within2: number; within3: number };
    representativeDistances: number[]; // BFS distance 1~3, 최대 6개
  };
  ```
- `representativeDistances`는 화면 06의 고정 슬롯 미니 그래프에 사용할 실제 최단 거리의
  익명 표본이다. 참여자 ID나 경로는 포함하지 않으며 최대 6개만 반환한다.
- 그래프 노드/엣지, 중간 연결자의 신원은 포함하지 않는다.

#### `POST /api/invites`

- **인증**: 세션 필수(401 if missing) — 참여를 마친 사람만 초대를 만들 수 있다.
- **응답**: `{ token: string }`. 공유 URL(`/pair/{token}`)은 클라이언트가 구성한다.

#### `GET /api/invites/{token}`

- **인증**: 없음(B가 로그인 없이 여는 링크이므로).
- **응답**: `{ status: "pending" | "accepted" | "expired" }` 뿐. inviter 신원 비공개.
- **에러**: 존재하지 않는 token(404).

#### `POST /api/invites/{token}/accept`

- **인증**: 세션 필수(recipient 본인). 401 if missing.
- **동작**: `pair_invites.status = 'pending'` 조건까지 포함한 원자적 UPDATE로
  recipient를 확정한다(동시 accept race 방지).
- **에러**: 존재하지 않는 token(404) · 만료된 링크(410) · 자기 자신의 링크로
  접속(`inviter_participant_id === recipient_participant_id`, 400) · 이미 다른
  사람이 먼저 accept한 링크(409, recipient가 호출자 자신이 아님). 이 네 경우
  모두 클라이언트가 성공으로 오해해 결과 조회로 넘어가지 않도록 2xx가 아닌
  상태 코드로 명확히 구분한다.
- **응답(성공)**: `{ status }`.

#### `GET /api/pairs/{token}/result`

- **인증**: 세션 필수 — 현재 세션의 participant가 이 초대의
  `inviter_participant_id` 또는 `recipient_participant_id`일 때만 결과를
  내려준다(403 otherwise). 토큰을 안다는 사실만으로는 결과를 볼 수 없다 —
  accepted 링크가 제3자에게 유출/재전달돼도 그 사람은 실제 다리 수를 볼 수
  없다는 뜻이다. (이전에는 §4에 "재검토 여지"로 남아 있었으나, recipient가
  세션(쿠키)을 잃으면 자기 결과를 다시 못 본다는 트레이드오프를 감수하고
  세션 기반 제한 쪽으로 결정했다.)
- **응답**:
  ```ts
  type PairResult = {
    status: "pending" | "connected" | "unreachable";
    distance: number | null;
  };
  ```
- accepted 상태일 때만 실제 계산을 수행하고 `pair_results`에 기록한다.

### 3.4 토큰/만료 설계

- `pair_invites.token`: 128bit CSPRNG, hex 인코딩. 순번 노출 없음.
- 만료: 7일. 카카오톡/DM 메시지가 바로 열리지 않을 가능성과, 오래된 초대가 계속
  유효한 채로 남는 표면적을 줄이는 것 사이의 절충값 — 확정값이 아니라 제안값이다.

## 4. 미해결 사항 ([TODO])

> 아래 항목은 §3의 삭제된 `pair_invites` 플로우 기준으로 작성됐다 — 참고용
> 기록으로 남긴다. 현재 활성 엔드포인트(`/api/instagram-import`,
> `/api/links/*`)의 레이트 리밋은 별도 미해결 항목이다(아래 새 항목 참고).

- **[해결됨]** ~~`GET /api/pairs/{token}/result`를 인증 없이 열어두는 것이 맞는지~~
  — §3.3에서 세션 기반 제한(inviter/recipient만 조회 가능, 403 otherwise)으로
  결정했다(라우트 자체는 이후 삭제됨).
- **[TODO][Medium]** ~~레이트 리밋 정책 없음: `/api/upload`, `/api/invites`~~
  — 두 라우트 모두 삭제됨(§3 상단 노트). **현재 유효한 TODO**: `/api/instagram-import`,
  `/api/links`(지인 링크 생성), `/api/links/{token}/confirm`에도 세션당/IP당
  레이트 리밋이 없다. Path Check(§8.6)에서 설계한 in-memory 고정 윈도우
  방식을 이 엔드포인트들에도 적용할지 별도로 검토한다.
- **[TODO][Low]** 만료된 초대 재발급 UX: §3의 삭제된 `pair_invites` 플로우
  기준 항목이라 지금은 해당 없음 — 현재 지인 링크(`acquaintance_links`)는
  만료 없이 소유자가 폐기/재발급하는 구조다(`01_DB_SCHEMA.md` §2).

## 6. 지인 확인 그래프 v2 엔드포인트 (TASK-003, 구현 완료)

설계 근거와 스키마는 [03_INVITE_GRAPH_V2_SPEC.md](./03_INVITE_GRAPH_V2_SPEC.md)
참고 — 여기서는 실제 구현된 엔드포인트 계약만 정리한다.

### 6.1 카카오 로그인

#### `GET|POST /api/auth/[...nextauth]`

- Auth.js(NextAuth v4)가 카카오 OAuth 시작/콜백을 모두 처리한다. 카카오 앱
  키(`KAKAO_CLIENT_ID`/`KAKAO_CLIENT_SECRET`)와 `NEXTAUTH_SECRET`이 없으면
  Auth.js에 위임하지 않고 503을 돌려준다(`isKakaoAuthConfigured()`).
- 로그인 성공 콜백(`apps/web/lib/auth.ts`의 `signIn`)이
  `(provider, providerAccountId)`로 participant를 찾거나 만들고, 기존
  `sessions` 테이블 기반 httpOnly 쿠키를 발급한다(Auth.js 자체 세션은 쓰지
  않음). 표시 이름이 없으면 `/login`으로, 있으면 `/result`로 리다이렉트한다
  — 이 분기는 로그인을 어디서 시작했는지와 무관하게 항상 고정이다(지인
  링크를 열었다가 로그인한 사람도 원래 링크로 자동 복귀하지 않는다, 알려진
  한계).

#### `PATCH /api/me/display-name`

- **인증**: 세션 필수(401).
- **요청**: `{ displayName: string }` — 트림 후 빈 문자열/공백, 30자 초과
  거부(400).
- **동작**: `participants.display_name` 갱신. 화면 02 최초 온보딩과 이후
  설정 변경에 동일하게 쓴다.
- **응답**: `{ ok: true }`.

#### `GET /api/session` (v2 확장)

- **인증**: 없음. 지금 세션의 로그인/표시 이름 설정 여부만 알려준다 —
  참여자 신원은 절대 포함하지 않는다.
- **응답**: `{ active: boolean, hasDisplayName: boolean }`. TASK-002까지는
  `{ active }`만 있었다 — `hasDisplayName`이 이번에 추가됐다(기존 소비처인
  `ReferralLanding.tsx`는 `active`만 읽으므로 하위 호환).

### 6.2 Instagram 맞팔 연동 (2026-09-14 재도입)

#### `POST /api/instagram-import`

- **인증**: 세션 필수(401) — 카카오 로그인을 마친 참여자만 호출 가능. 로그인
  수단이 아니다.
- **요청**: `InstagramImportRequest`(§2.3).
- **동작**: `selfUsername`을 해싱해 `participants.instagram_username_hash`에
  등록(`claimInstagramUsername`) — 이미 다른 참여자가 같은 해시를 쓰고
  있으면 409. `mutualUsernames`는 각각 해싱해 `follows`를 현재 상태로
  동기화한다(`syncInstagramMutuals`) — 재호출 시 이전 목록을 전부 지우고
  새로 채운다, 단순 추가가 아니다.
- **응답**: `{ mutualCount: number }` — 실제로 동기화된 맞팔 수만 돌려준다.
  해시값, 상대방 존재 여부는 절대 포함하지 않는다.
- **에러**: 로그인 없음(401) · 요청 스키마 불일치(400) · 이미 다른 참여자가
  같은 Instagram 계정을 연동함(409).

### 6.3 지인 링크(재사용)

#### `GET /api/links`

- **인증**: 세션 필수(401).
- **동작**: 호출자의 유효한(만료·폐기 안 된) 지인 링크를 그대로 돌려준다 —
  회전하지 않는다. v2 명세 §3.2에는 명시되지 않았지만, 화면 03을 다시 열
  때마다 `POST /api/links`를 부르면 이미 공유한 링크가 계속 깨지므로,
  기존 `GET/POST /api/referral-link` 패턴과 대칭을 맞춰 조회 전용으로
  추가했다.
- **응답(성공)**: `{ token }`. **에러**: 아직 만든 적 없음(404).

#### `POST /api/links`

- **인증**: 세션 필수(401).
- **동작**: 호출자의 기존 링크가 있으면 그대로 돌려주고, 없으면 새 링크를 만든다.
  확인 인원 상한이나 만료 기간은 두지 않는다.
- **응답**: `{ token }`.

#### `GET /api/links/{token}`

- **인증**: 없음(수신자가 로그인 전에 먼저 여는 화면 04이므로).
- **응답**: `{ status: "valid" | "revoked" | "not-found", ownerDisplayName: string | null }`.
  소유자의 participant id·해시는 포함하지 않는다.

#### `POST /api/links/{token}/confirm`

- **인증**: 세션 필수(수신자 본인, 401).
- **동작**: 트랜잭션 안에서 링크의 존재와 폐기 여부를 확인한 뒤
  `acquaintance_confirmations`에 삽입한다(이미 확인한
  적 있으면 멱등하게 성공 처리).
- **에러**: 없음(404) · 폐기됨(410) · 자기 자신의 링크(400).
- **응답(성공)**: `{ ok: true }`.

#### `GET /api/me/connections`

- **인증**: 세션 필수(401).
- **응답**: `{ connections: Array<{ displayName: string, confirmedAt: string }> }`.
  삭제 기능이 없으므로 제거용 id는 포함하지 않는다.

### 6.4 공개(탐색) 링크 — 표시 이름만 추가

#### `GET /api/r/{token}` (v2 확장)

- 기존 존재 확인 응답 `{}`가 `{ ownerDisplayName: string | null }`로
  바뀌었다 — 소유자 신원(해시, participant id)은 여전히 포함하지 않는다.
  이 링크를 여는 것만으로는 여전히 어떤 edge도 생기지 않는다(`referralLinks`/
  `referralVisits` 테이블 구조와 edge-미생성 로직은 그대로).

## 8. 타겟 챌린지 — 협업형 챌린지 (구현 완료)

`00_PRODUCT_DECISION_LOG.md`의 2026-09-14 항목("Path Check를 공유형
'타겟 챌린지'로 확장")과 2026-09-15 항목("협업형 챌린지")에 따른 API
계약이다. **이 문서 초판(아래 §8.2의 옛 `POST
/api/challenges/{token}/check`, 뷰어 개인 기준 `connected`/`not_connected`
응답)은 구현되지 않았고 폐기됐다 — 실제로 구현된 것은 이번 절이 설명하는
3개 엔드포인트다.** 개인용 1회성 조회가 아니라, 사용자가 지정한 타겟을
`target_challenges` 행 하나로 저장해두고 opaque token으로 여러 명이
재사용(각자 참여해서 연결을 보태는) 구조다. 결과는 뷰어 개인의 거리가
아니라 챌린지 전체의 공동 진행 상황이다.

### 8.1 기능 정의와 경계

**허용**:
- 로그인 사용자가 정확히 알고 있는 Instagram username을 직접 입력 →
  서버가 즉시 해싱 → 그 해시를 대상으로 opaque token 기반 챌린지를 만든다
  (`POST /api/challenges`).
- 누구든 그 token(`/t/{token}`)을 열어서 챌린지의 표시 이름과 공동 진행
  상황을 본다(`GET /api/challenges/{token}`). 로그인 후 "나도 연결
  보태기"(Instagram import 완료)로 자기 trusted network를 시작점에
  더할 수 있다(`POST /api/challenges/{token}/join`) — 2026-09-15 협업형
  챌린지 결정으로 "자기 기준" 개인 조회는 더 이상 이 기능의 모델이
  아니다.

**금지** (§1과 `AGENTS.md` §1 원칙 3 그대로 유지, 이번 확장에도 포함되지
않음):
- 사용자 디렉터리, 이름/username 자동완성, prefix 검색
- 전체 계정 목록, 인기 계정 목록 API
- challenge 전체 목록·검색·탐색 API(token을 모르면 그 챌린지에 접근할
  방법이 없어야 한다)
- 결과로 "이 계정이 가입자인지", "이 계정이 가이 알아? 어딘가에
  존재하는지" 자체를 노출
- external Instagram 계정 목록 조회
- Instagram API·profile scraping으로 `displayName`을 자동 채우거나 검증

### 8.2 요청/응답 계약 (구현됨)

```ts
// packages/shared/src/schemas.ts

// POST /api/challenges — 로그인 필요. 생성자는 같은 트랜잭션에서
// challenge_participants의 첫 참여자로도 upsert된다(apps/web/lib/challenges.ts
// createChallenge) — 단, 동일 target(아래 참고)이 이미 있으면 이 upsert
// 자체가 일어나지 않는다.
type CreateChallengeRequest = {
  displayName: string;       // 챌린지에 보여줄 표시 이름, 검증 안 함
  instagramUsername: string; // 정확한 Instagram username, 사용자가 직접 입력
};
// 2026-09-15 결정 — target_instagram_username_hash UNIQUE 제약(정규화된
// username 기준, displayName 기준이 아님)에 걸리면 "duplicate"를 돌려준다.
// 호출자를 그 challenge에 자동으로 합류시키지 않는다 — 클라이언트가 "이미
// 있어요, 합류할까요?" 화면을 보여주고, 사용자가 명시적으로 동의했을 때만
// POST /api/challenges/{token}/join을 호출한다. displayName은 최초 생성
// 시점 값을 그대로 돌려준다(이번 제출 값으로 덮어쓰지 않는다).
type CreateChallengeResponse =
  | { status: "created"; token: string }
  | { status: "duplicate"; token: string; displayName: string };

// GET /api/challenges/{token} — 로그인 불필요(공개, §8.1 "누구든" 참고).
// 대상 이름과 챌린지 전체 진행 상황을 한 번에 내려준다 — 뷰어 개인의 거리가
// 아니다. 2026-09-15 "마지막 연결자 공개" 결정으로 마지막 연결자 요약도
// 함께 내려준다 — participantId, 비동의 displayName, intermediate identity는
// 절대 포함하지 않는다(§8.4 참고).
type ChallengePublicInfo = {
  displayName: string;
  status: "searching" | "found";
  distance: number | null; // graph edge 수. searching이면 항상 null.
  lastConnectorCount: number; // 실제 distinct 마지막 연결자 수. 공개 동의 여부와 무관.
  consentedLastConnectorCount: number; // 그중 공개 동의한 사람 수(표시 여부와 무관).
  visibleLastConnectorNames: string[]; // 공개 동의 + 상한 3명 필터링까지 끝난 displayName만.
};

// POST /api/challenges/{token}/join — 로그인 필요. "나도 연결 보태기"
// 페이지뷰만으로는 호출되지 않는다. 호출 경로는 두 가지다(2026-09-15 수정):
//   1. 아직 아무 관계도 보태지 않은 사람 — `/upload`(Instagram import)를
//      실제로 완료한 시점(apps/web/components/InstagramImportFlow.tsx).
//   2. 이미 관계가 있는 사람(`viewerHasConnections`) — 챌린지 화면에서
//      버튼을 누른 즉시. 업로드를 다시 시키지 않는다. 참여의 의미가
//      "새 데이터를 낸다"가 아니라 "내가 이미 가진 trusted network를 이
//      챌린지의 시작점으로 써도 된다"이기 때문이다.
// 어느 쪽이든 호출자를 challenge_participants에 upsert(멱등)하고, 갱신된
// 진행 상황을 바로 돌려준다. 한 번의 업로드가 모든 챌린지에 자동 참여로
// 이어지지는 않는다 — 참여는 항상 챌린지 단위로 명시적이다.
type JoinChallengeResponse = { status: "searching" | "found"; distance: number | null };

// POST /api/challenges/{token}/share — 로그인 불필요(2026-09-15 추가).
// "챌린지 공유하기" 버튼이 실제로 공유/복사까지 완료됐을 때만 호출한다
// (공유 시트를 취소하면 호출되지 않는다 — apps/web/components/
// TargetChallengeScreen.tsx의 handleShareChallenge). target_challenges.
// share_count를 1 증가시킬 뿐이고, 현재 카운트는 응답에 싣지 않는다 —
// 이 숫자는 운영자 전용 지표라 화면에 보여줄 값이 아니다(01_DB_SCHEMA.md
// §4.9의 share_count 참고). 존재하지 않는 토큰이면 조용히 아무 행도
// 갱신하지 않는다.
type ShareChallengeResponse = { ok: true };
```

`instagramUsername`은 `GET`이 아니라 `POST`로만 받는다 — URL 쿼리스트링에
남으면 브라우저 히스토리·서버 접근 로그·리퍼러 헤더 등 서버가 통제할 수
없는 경로로 원문이 새어 나갈 수 있다. `GET /api/challenges/{token}`은
username을 다루지 않고 이미 발급된 opaque token만 받으므로 안전하다.

**옛 `POST /api/challenges/{token}/check`(뷰어 개인 기준, `self`/`connected`/
`not_connected` 응답)는 구현되지 않았고 폐기됐다** — 2026-09-15 협업형
챌린지 결정으로 별도 엔드포인트가 필요 없어졌다(§8.4 참고).

**다만 "나는 몇 다리인지"는 되살렸다**(2026-09-15 추가 결정). 별도
엔드포인트가 아니라 `GET /api/challenges/{token}` 응답의 `viewerDistance`
필드로 함께 내려간다 — 로그인한 뷰어에게만 채워지고(비로그인이면 항상
null), 길이 없으면 null이다. 챌린지 전체의 `status`/`distance`(start-set
기준)를 **대체하지 않고 함께** 준다: 챌린지는 아직 `searching`인데 뷰어에게는
길이 있을 수 있고(그 뷰어가 참여하면 그 순간 챌린지가 풀린다), 반대로
챌린지는 `found`인데 뷰어 본인은 닿지 않을 수도 있다. 계산은 start-set만
"뷰어 한 명"으로 바꾼 것 외에 챌린지 진행 상황과 완전히 동일하다
(`computeViewerChallengeDistance`). 값은 거리 숫자 하나뿐이고 중간 경로의
identity는 담기지 않는다.

**홈 공개 챌린지 목록에는 API 라우트를 만들지 않는다**(2026-09-15 결정).
`GET /api/challenges`(전체 목록)나 그에 준하는 탐색 엔드포인트는 존재하지
않으며 만들지 않는다 — 홈(`/`)과 `/challenges`의 서버 컴포넌트
(`apps/web/components/PublicChallengeList.tsx`)가 `listPublicChallenges`로
DB를 직접 읽어 렌더링한다. 대상은 운영자가 `target_challenges.is_public`을
직접 켠 챌린지뿐이고(기본값 false, 사용자용 설정 UI 없음), 목록을 실제로
보여주는 화면은 `/challenges` 하나다 — 홈은 그 화면으로 가는 버튼만 둔다. 렌더링되는 값은 이미 `GET /api/challenges/{token}`이 공개하는
것과 같은 범위다 — 토큰, 공개로 지정된 displayName, 참여자 수, status,
distance. 검색·필터·카테고리·랭킹·무한스크롤·target 자동완성은 만들지
않는다.

### 8.3 `searching`으로 합치는 내부 상태 (서버 내부 전용, 응답에는 노출 안 함)

| 내부 상태 | 의미 |
| :-- | :-- |
| target hash 없음 | `participants.instagram_username_hash`에도, `follows.followee_identity_hash`에도 이 챌린지의 target hash가 전혀 없음 |
| start-set 비어 있음 | 아직 아무도 "나도 연결 보태기"(Instagram import 완료)를 하지 않음 |
| 도달 불가 | target hash는 존재하지만(가입자 노드 또는 leaf 후보) 현재 start-set과 그래프상 연결되지 않음 |

서버 로직은 이 셋을 구분해 계산하지만, HTTP 응답과 UI 문구는 항상
`searching`(2026-09-14 시점 문서의 `not_connected`에 대응) 하나로 합친다 —
"이 계정이 가이 알아? 어딘가에 존재한다"는 사실 자체가 노출되지 않게 하기
위함이다(결정 로그 2026-09-14, 2026-09-15 항목).

### 8.4 처리 흐름 (구현됨)

**`POST /api/challenges`**
```
1. 세션 확인 — 없으면 401.
2. rate limit 확인(§8.6) — 초과 시 429.
3. createChallengeSchema로 body 검증(displayName, instagramUsername).
4. targetHash = hashInstagramUsername(instagramUsername)  // 원문은 여기서 버려짐
5. 트랜잭션: target_challenges에 { token: 새 opaque random, displayName,
   targetInstagramUsernameHash: targetHash, creatorParticipantId } insert 시도.
   → 성공하면 같은 트랜잭션에서 challenge_participants에
     { challengeId, creatorParticipantId } upsert(생성자는 자동으로 첫
     참여자다), { status: "created", token } 응답.
   → target_instagram_username_hash UNIQUE 위반이면(2026-09-15 결정,
     이미 같은 target의 challenge가 존재) 새 행을 만들지 않고, 기존 행을
     조회해 { status: "duplicate", token: 기존 token, displayName: 기존
     displayName } 응답 — challenge_participants는 건드리지 않는다(호출자를
     자동 합류시키지 않는다). 이번에 제출한 displayName은 버려진다.
```

**`GET /api/challenges/{token}`, `POST /api/challenges/{token}/join`(참여 등록 후
호출자에 한해 갱신된 값 반환)이 공통으로 쓰는 진행 상황 계산
(`computeChallengeProgress`, `apps/web/lib/graph-service.ts`)**
```
1. challenge_participants에서 이 챌린지의 start-set(participant id 목록) 조회.
   비어 있으면 즉시 { status: "searching", distance: null }.
2. graph = buildGraph(await getAllEdges())  // packages/graph, 변경 없음
3. targetParticipantId = participants에서 instagram_username_hash =
   challenge.targetInstagramUsernameHash 조회.
   → 있으면: distances = bfsDistances(graph, targetParticipantId) // single-source BFS 1회
     start-set 각각의 distances.get(startId) 중 최솟값 = distance.
   → 없으면(target이 아직 participant가 아님):
     leafCandidateIds = SELECT DISTINCT follower_participant_id FROM follows
       WHERE followee_identity_hash = challenge.targetInstagramUsernameHash
     leafCandidateIds가 비어 있으면 searching.
     각 leaf candidate에 대해 distances = bfsDistances(graph, leafId)를 돌려
     start-set과의 거리 + 1(leaf → target 1홉) 중 최솟값을 취한다.
4. 최솟값이 없으면 { status: "searching", distance: null },
   있으면 { status: "found", distance }.
```
target/leaf 쪽에서 BFS를 하고 start-set은 조회만 하는 이유: 무방향 그래프라
어느 방향에서 돌려도 결과가 같고, target/leaf 후보 수(보통 1~2명)가 보통
start-set 크기보다 작아 이 방향이 항상 더 싸다 — start-set마다 개별
BFS를 도는 multi-source BFS를 `packages/graph`에 새로 추가하지 않는다.
결과는 어디에도 캐시하지 않고 매 호출마다 재계산한다 — 새 참여자/새 trusted
edge가 생기면 다음 호출부터 자동 반영된다.

**`POST /api/challenges/{token}/join`**
```
1. 세션 확인 — 없으면 401.
2. target_challenges에서 token으로 조회 — 없으면 404.
3. challenge_participants에 { challengeId, participantId } upsert(ON CONFLICT
   DO NOTHING — 멱등).
4. 위 진행 상황 계산을 다시 실행해 { status, distance }로 응답.
```

원문 username, targetHash, leaf candidate 목록, start-set 참여자 목록, 대상이
participant인지 leaf인지 여부 중 어느 것도 어떤 응답에도 포함하지 않는다 —
`distance` 숫자와 `status`만 내려간다. 그래프 자체(`packages/graph`)는
건드리지 않는다 — leaf는 노드로 추가되지 않고, 3번 단계에서만 "+1홉"으로
계산에 얹힌다([01_DB_SCHEMA.md §4.2](./01_DB_SCHEMA.md#42-채택안-b-postgresql--요청-시-인메모리-bfs-활성-소스는-두-개)와
동일한 그래프를 그대로 재사용).

### 8.5 로깅/원문 비저장 (필수 조건)

- 요청 바디의 `instagramUsername`은 `hashInstagramUsername()` 호출 한 줄
  안에서만 살아 있다 — 그 함수를 통과한 뒤에는 변수 참조 자체를 남기지
  않는다.
- 애플리케이션 로그: 요청 시작/종료를 로그로 남기더라도 바디 필드는
  마스킹하거나 아예 로그 라인에 포함하지 않는다.
- 에러 트래킹(예: Sentry류) breadcrumb/message에 요청 바디를 자동으로
  붙이는 기본 통합을 쓰지 않는다 — 이런 도구는 기본값이 요청 바디를 통째로
  캡처하는 경우가 많으므로, 도입 시 이 라우트만 별도로 스크러빙 규칙을
  두거나 breadcrumb 자체를 끈다.
- analytics(GA 등) 이벤트에 검색어를 속성으로 보내지 않는다 — 이벤트를
  보낸다면 `status`(connected/not_connected)만, username 없이.
- DB에는 해시만 저장한다(`target_challenges.target_instagram_username_hash`) —
  원문 저장 컬럼은 어디에도 없다.

### 8.6 Rate Limit / 남용 방지 (구현됨 — `POST /api/challenges`만 해당, `check` 엔드포인트는 폐기됨)

로그인이 필수이므로 IP가 아니라 `participantId`를 키로 쓴다. **챌린지
"생성"이 곧 "이 username에 대해 조회를 하나 연다"는 뜻이므로, 개인용
설계 때보다 이 경로를 더 신경 써야 한다** — 한 계정이 서로 다른
username으로 챌린지를 빠르게 반복 생성하면 사실상 무제한 조회 오라클이
된다(결정 로그 2026-09-14 항목 6).

**구현(`apps/web/lib/rate-limit.ts`, 신규 스키마 없음)**: API 라우트 모듈에
프로세스 메모리 `Map<string, { windowStart: number; count: number }>`를 두고,
고정 윈도우로 제한한다.
- **`POST /api/challenges`(생성)**: 분당 5회, 시간당 30회(둘 다 걸어 순간
  버스트와 장시간 스캔을 함께 억제) — 두 윈도우를 먼저 모두 확인한 뒤에만
  함께 커밋한다(하나의 윈도우만 소모되고 다른 윈도우에서 막히는 것을 방지).
- 개인 조회 엔드포인트(`check`)는 이제 없다 — 2026-09-15 협업형 챌린지
  결정으로 `POST /api/challenges/{token}/check`가 폐기됐으므로(§8.2),
  그 엔드포인트용으로 설계했던 분당 20회 한도는 적용 대상이 없다. 공개
  진행상황 조회(`GET /api/challenges/{token}`)와 참여 등록(`POST
  .../{token}/join`)에는 아직 별도 rate limit이 없다 — 필요성이 확인되면
  추가한다.

초과 시 `429` + `Retry-After` 헤더, 본문은 `{ error: "잠시 후 다시
시도해주세요." }`처럼 한도 초과라는 사실이나 target 존재 여부를 드러내지
않는 일반적인 문구만 담는다.

**알려진 한계**: Next.js가 서버리스/멀티 인스턴스로 배포되면(예: Vercel)
인스턴스마다 메모리가 분리돼 있어 실질 상한이 인스턴스 수만큼 느슨해지고,
콜드스타트마다 리셋된다 — "대량 스캔을 어렵게 한다"는 목표를 엄격하게
만족시키려면 결국 영속 저장소(참여자별 카운터)가 필요하다. 이번 라운드는
`target_challenges` 테이블 자체가 이미 새 스키마이므로, "DB 변경 최소화"
제약은 그 테이블 하나로 충분히 쓴 것으로 보고 별도 rate-limit 테이블은
추가하지 않는다 — 인메모리로 시작한다.

**재검토 조건**: 실제 배포 환경이 멀티 인스턴스로 확정되거나, 대량 스캔
시도가 관찰되면 영속 카운터(신규 테이블 또는 기존 인프라)로 전환하는 걸
재검토한다.

### 8.7 필요한 스키마 변경

- `target_challenges` 신규 테이블(`id`, `token`, `displayName`,
  `targetInstagramUsernameHash`, `creatorParticipantId`, `createdAt`) —
  상세는 [01_DB_SCHEMA.md §4.9](./01_DB_SCHEMA.md#49-타겟-챌린지-target_challenges--2026-09-14)
  참고.
- `follows.followee_identity_hash` 단일 컬럼 인덱스 — 챌린지의 대상이
  아직 참여자가 아닐 때 후보를 찾는 조회(§8.4 3번 분기)에 필요하다. 상세는
  [01_DB_SCHEMA.md §4.10](./01_DB_SCHEMA.md#410-follows에-필요한-인덱스--2026-09-14-적용됨)
  참고. 이미 마이그레이션 적용됨(`0010_uneven_aaron_stack.sql`).

## 9. Related Documents

- **Concept_Design**: N/A - [00_DEVELOPMENT_PRINCIPLES.md §6](./00_DEVELOPMENT_PRINCIPLES.md#6-related-documents)와
  동일한 사유.
- **Technical_Specs**: [Development Principles](./00_DEVELOPMENT_PRINCIPLES.md) -
  Privacy-by-Design 원칙 및 전체 아키텍처 근거
- **Technical_Specs**: [DB Schema](./01_DB_SCHEMA.md) - 이 엔드포인트들이 읽고
  쓰는 테이블 정의 및 식별자 해싱 설계
- **Technical_Specs**: [Invite Graph v2 Spec](./03_INVITE_GRAPH_V2_SPEC.md) -
  §6 엔드포인트들의 설계 근거(TASK-003)
- **Concept_Design**: [Product Decision Log](../01_Concept_Design/00_PRODUCT_DECISION_LOG.md) -
  §8 Path Check의 제품 결정 근거(2026-09-14 항목)
