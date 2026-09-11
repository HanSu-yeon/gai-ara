# API Specs: ZIP 파싱 계약 및 초대/Consent 플로우
> Created: 2026-09-10 22:30
> Last Updated: 2026-09-12 02:00

이 문서는 두 가지를 다룬다: (1) Instagram ZIP을 브라우저에서 안전하게 파싱하는 방법과
서버가 실제로 받는 데이터의 계약, (2) "우리 몇다리?" 초대 링크와 consent 플로우의
엔드포인트 명세.

## 1. 서버가 절대 받지 않는 것

아래는 API 설계 이전에 먼저 정하는 제약이다. 엔드포인트 하나하나보다 이 목록이
우선한다.

- 원본 ZIP 파일. 어떤 엔드포인트도 `multipart/form-data` 파일 업로드를 받지 않는다.
- followers 데이터 자체. 이 서비스는 following만 요청한다 — 맞팔 여부는
  서버가 두 참여자의 following을 대조해서 판정하므로 "누가 나를 팔로우하는가"는
  애초에 필요 없다([01_DB_SCHEMA.md §4](./01_DB_SCHEMA.md#4-mutual-follow-그래프-저장-구조)).
- following 원본 전체 목록의 서버 측 가공. 클라이언트가 정규화·중복 제거한
  following 목록을 그대로 받되, 맞팔(mutual) 판정 자체는 클라이언트가 하지
  않는다 — 서버가 참여자들의 following을 대조해서 판정한다.
- 임의의 username에 대한 해시값이나 "이 사람이 참여자인지"를 알려주는 조회 API.
  이런 API가 있으면 사실상 계정 검색 기능이 되어 기획서 6장의 원칙을 API 레벨에서
  깨뜨린다.
- 두 참여자 사이의 중간 연결자. 어떤 응답 스키마에도 존재할 수 없다.

## 2. Instagram ZIP 브라우저 파싱 설계

### 2.1 원칙

ZIP은 전부 브라우저에서 열어보고, following username 목록만 서버로 보낸다.
서버는 이 세션에서 이 사람의 ZIP을 본 적이 없다.

### 2.2 안전하게 파싱하기 위한 구체 규칙

| 위험 | 대응 |
| :--- | :--- |
| Zip bomb (압축 해제 시 비정상적으로 큰 크기) | 대상 파일(`following.json`)의 압축 해제 전 크기를 확인하고, 임계치(예: 100MB)를 넘으면 해제를 거부하고 안내 메시지를 표시한다. |
| 무관한 대용량 콘텐츠(사진/영상/DM) 압축 해제 | 파일명 패턴(`following.json`)에 매칭되는 항목만 압축 해제한다. ZIP 라이브러리는 항목 목록을 먼저 읽고 개별 항목 단위로 지연 압축 해제하므로, 매칭되지 않는 파일은 애초에 해제되지 않는다. |
| 손상되었거나 형식이 다른 JSON | `JSON.parse` 실패 시 해당 파일만 건너뛰고 나머지는 계속 처리한다. 전체 실패로 처리하지 않는다. |
| ZIP 내부 HTML/미디어 파일을 통한 콘텐츠 주입 | Instagram export에는 메시지 스레드 등 HTML 파일도 포함될 수 있다. 이런 파일은 애초에 매칭 패턴에 걸리지 않으므로 열어보지 않으며, 그 어떤 파일 내용도 `innerHTML`이나 스크립트 실행 경로로 넘기지 않는다 — 오직 `JSON.parse`만 호출한다. |
| Export 구조 변경(파일명, JSON 스키마) | 특정 JSON 스키마 하나에 고정하지 않고, JSON 트리를 재귀 탐색해 `string_list_data[].value` 형태의 문자열을 모두 수집하는 방식으로 구조 변화에 견고하게 만든다. |
| 메인 스레드 블로킹(대용량 계정) | MVP 범위 밖의 개선 사항으로 기록: 파싱을 Web Worker로 옮겨 UI 프리징을 방지한다. 일반적인 팔로워 수 규모(수만 이하)에서는 필수는 아니다. |
| 파일 형식 오검증 | `.zip` 확장자 확인은 UX 힌트일 뿐 보안 경계가 아니다. 실제 검증은 ZIP 라이브러리가 유효하지 않은 아카이브를 열려고 할 때 발생하는 예외를 처리하는 것으로 이루어진다. |

### 2.3 클라이언트 → 서버 데이터 계약

브라우저에서 파싱이 끝난 뒤 서버로 넘어오는 값은 다음 하나뿐이다.

```ts
type UploadFollowingRequest = {
  selfUsername: string;         // 사용자가 직접 입력 (§ DB_SCHEMA 3.5)
  followingUsernames: string[]; // following.json에서 추출, 정규화·중복 제거·자기 자신 제외 완료
};
```

맞팔(mutual) 여부는 여기 담기지 않는다 — 서버가 이 following 목록을 다른
참여자들의 following과 대조해서 판정한다([01_DB_SCHEMA.md §4](./01_DB_SCHEMA.md#4-mutual-follow-그래프-저장-구조)).
followers 원본, ZIP 파일, 업로드 시각 외의 메타데이터는 포함하지 않는다.

## 3. 초대/Consent 플로우

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
  };
  ```
- 그래프 노드/엣지, 중간 연결자는 포함하지 않는다.

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

- **[해결됨]** ~~`GET /api/pairs/{token}/result`를 인증 없이 열어두는 것이 맞는지~~
  — §3.3에서 세션 기반 제한(inviter/recipient만 조회 가능, 403 otherwise)으로
  결정했다.
- **[TODO][Medium]** 레이트 리밋 정책 없음: `/api/upload`(following 목록 대량
  반복 전송), `/api/invites`(초대 대량 생성 후 무차별 배포) 모두 현재 제한이
  없다. 세션당/‌IP당 요청 빈도와 `/api/upload`의 `followingUsernames` 최대
  개수(현재 2만) 조정이 필요하다.
- **[TODO][Low]** 만료된 초대 재발급 UX: 현재는 새 `POST /api/invites`로 새
  토큰을 발급받는 것 외 별도 처리가 없다.

## 5. Related Documents

- **Concept_Design**: N/A - [00_DEVELOPMENT_PRINCIPLES.md §6](./00_DEVELOPMENT_PRINCIPLES.md#6-related-documents)와
  동일한 사유.
- **Technical_Specs**: [Development Principles](./00_DEVELOPMENT_PRINCIPLES.md) -
  Privacy-by-Design 원칙 및 전체 아키텍처 근거
- **Technical_Specs**: [DB Schema](./01_DB_SCHEMA.md) - 이 엔드포인트들이 읽고
  쓰는 테이블 정의 및 식별자 해싱 설계
