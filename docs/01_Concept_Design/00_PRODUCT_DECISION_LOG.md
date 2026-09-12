# Product Decision Log

제품 가설과 변경 이유, 검증 지표, 재검토 조건을 기록한다. 구현 상태만 설명하는 문서가
아니며, 새 데이터가 쌓이면 기존 결정을 수정하거나 뒤집을 수 있다.

## 2026-09-12 — Instagram 데이터 가져오기를 기대 형성 뒤로 이동

### 상태

채택, 구현 완료. 실제 사용자 퍼널 검증 전.

### 문제

서비스의 핵심 재미는 초대한 사람과 몇 다리로 연결되는지 바로 확인하는 데 있다. 기존
흐름은 그 기대를 충분히 보여주기 전에 Instagram 데이터 ZIP을 요구했다.

```text
기존: 설명 → Instagram 데이터 요청 → 대기 → ZIP 찾기 → 업로드
변경: 초대와 연결 예시 → 내 연결 알아보기 → 받은 파일 선택 → 결과
```

Instagram 아이디만으로 일반 사용자의 전체 팔로워·팔로잉 목록을 안정적으로 가져올 수
있는 공식 API는 전제로 삼지 않는다. 비공식 스크래핑도 제품 기반으로 사용하지 않는다.
정확한 participant-only 그래프를 유지하려면 참여자가 제공한 following 데이터가 여전히
필요하다.

### 결정

1. ZIP 업로드는 유지하되 첫 화면에서 `ZIP 파일 업로드`라고 부르지 않는다.
2. 초대 화면에서는 초대한 사람과 몇 다리인지 궁금하게 만드는 예시를 먼저 보여준다.
   예시는 실제 결과가 아니라는 점을 명시하고 중간 참여자의 이름은 결과로 공개하지 않는다.
3. 사용자가 `내 연결 알아보기`를 누른 뒤 `인스타 데이터 가져오기`와 파일 선택 UI를
   보여준다. 파일은 압축을 풀지 않고 그대로 선택하게 한다.
4. `어디서 받나요?`를 누르면 같은 화면 안에 4단계 안내를 펼친다. 파일 선택 상태와
   초대 맥락을 잃지 않게 한다.
5. 공식 Accounts Center의 [정보 다운로드 화면](https://accountscenter.instagram.com/info_and_permissions/dyi?source=external&account_type=1&format=JSON&date_range=ALL_TIME)을
   새 창으로 연다. Google 검색 중간 URL은 목적지가 불투명하고 만료될 수 있어 제품 링크로
   저장하지 않는다. Instagram 계정, JSON, 전체 기간을 딥링크 파라미터로 미리 지정한다.
   Meta가 화면 구조나 URL을 바꿀 경우에 대비해 수동 안내도 유지한다.
6. 진행 중인 경로만 브라우저에 최대 7일 저장해 같은 브라우저에서 이어갈 수 있게 한다.
   ZIP, Instagram 아이디, 초대 토큰을 GA 이벤트 속성으로 보내지 않으며 파일 자체도
   브라우저 저장소에 저장하지 않는다.
7. 내보내기 링크를 연 뒤 별도 대기 화면을 만들지 않는다. 파일 생성과 완료 알림은
   Instagram이 담당하므로, 가이 알아?는 바로 ZIP 선택 화면을 보여주고 재방문 시 원래
   초대 맥락으로 돌아간다. iPhone과 Android에서는 각 운영체제의 기본 다운로드 폴더
   위치를 안내한다.
8. 준비 완료 알림만으로 ZIP이 기기에 저장되지는 않는다. 사용자는 Accounts Center에
   다시 들어가 준비된 내보내기를 내려받아야 하므로, 파일 선택 화면에
   `인스타에서 준비된 파일 받기` 링크를 항상 제공한다.
9. 복귀 UI 상태와 퍼널 측정 상태를 분리한다. `fileStepOpenedAt`은 파일 선택 단계 복귀에,
   `exportOpenedAt`은 실제 Accounts Center 링크를 연 뒤 경과 시간 측정에만 사용한다.
10. 독립 가이드 방문만으로는 복귀 상태를 만들지 않는다. 방문 시각은 페이지 메모리에만
    유지하고, 사용자가 Instagram 열기나 파일 선택을 실행했을 때 진행 상태와 함께 저장한다.

### 측정할 퍼널

```text
start_click
→ download_guide_open
→ instagram_export_open
→ instagram_export_reopen
→ import_resume_click
→ file_selected
→ upload_success
→ referral_link_create
→ invite_upload_success
```

`source`는 `direct`, `referral`, `pair`로 구분한다. `file_selected`에는 파일 형식이
유효한지, 내보내기 화면 및 가이드를 연 뒤 경과한 초만 기록한다. Instagram export는 준비에 여러 방문이
걸릴 수 있으므로 같은 세션 전환율만으로 판단하지 않는다.

### 성공 기준과 다음 결정

- `start_click → file_selected`에서 큰 이탈이 생기면 파일 선택 UI보다 Instagram export
  자체가 핵심 진입장벽이라고 판단한다.
- `file_selected → upload_success`에서 큰 이탈이 생기면 export 형식 변화, ZIP 파서 오류,
  계정 추론 UX를 먼저 고친다.
- 초대 유입의 `invite_upload_success`가 계속 낮으면 ZIP을 선택 기능으로 내리고 양쪽
  사용자가 관계를 독립적으로 확인하는 `self-confirmed edge` 실험을 검토한다.
- 수동 확인 edge를 도입하더라도 자동 검증된 관계와 동일한 신뢰도로 표시하지 않는다.
- 업로드 전 공유 링크 생성은 참여자 식별과 링크 소유권을 새로 설계해야 하므로 현재
  구현에 포함하지 않는다. 대기 구간 이탈이 크면 익명 임시 링크 방식으로 별도 실험한다.

### 유지하는 데이터 원칙

- 브라우저는 ZIP 전체에서 following 데이터만 찾아 읽는다.
- 원본 ZIP과 followers 데이터는 서버에 보내거나 저장하지 않는다.
- 참여자끼리 서로의 following에 포함된 경우에만 맞팔 edge를 만든다.
- 사용자에게 중간 연결자나 실제 경로를 공개하지 않고 거리만 보여준다.

### 관련 구현

- `apps/web/components/ImportOnboarding.tsx`
- `apps/web/components/UploadFlow.tsx`
- `apps/web/lib/import-progress.ts`
- `apps/web/lib/analytics.ts`
- `apps/web/test/README.md`
