# Screen 07 Inline Sharing Verification
> Created: 2026-09-13 23:19
> Last Updated: 2026-09-13 23:19

Independent Verification Receipt: PASS.

- 화면 07은 별도 route나 modal이 아니라 화면 06의 인라인 펼침 상태다.
- `MiniConnectionGraph`와 화면 06 본문은 펼침 전후에 계속 유지된다.
- 공유 Primary와 복사 Secondary 모두 전체 `/r/{token}` URL을 사용한다.
- `/connect` → `/invite/{token}`만 직접 관계 확인으로 이어지고, `/r/{token}`은
  거리 계산과 방문 결과 기록만 수행한다.
- 비로그인 수신자는 화면 08을 먼저 보고, CTA 뒤 로그인·이름 설정을 마치면 원래
  `/r/{token}`으로 복귀해 요청한 거리 계산을 한 번만 자동 실행한다.

| Review dimension | Result |
| --- | --- |
| Functionality | 인라인 토글, 공유·복사, 인증 복귀 후 단일 계산 PASS |
| Impact | 두 링크 목적을 명확히 분리해 잘못된 직접 관계 생성을 방지 |
| Novelty | N/A — 기존 사용자 여정 정정 |
| UX | 부드러운 전환, 동적 화살표, 키보드 포커스 격리 PASS |
| Open-source | 새 의존성이나 프로젝트 전용 외부 서비스 추가 없음 |
| Business Plan | N/A — 화면 상태 및 사용자 여정 수정 |

## Verification Evidence

- `pnpm typecheck` — PASS, 전체 워크스페이스 타입 검사 완료.
- `git diff --check` — PASS.
- `pnpm --filter @gai-ara/web test` — PASS. 현재 스크립트는 `no tests yet`만 출력한다.
- `pnpm --filter @gai-ara/web exec next build --webpack` — PASS. 24개 페이지 생성 및
  `/result`, `/r/[token]`, `/login`, `/connect`, `/invite/[token]` 확인.
- 기본 Turbopack build — 환경 제약으로 미실행. sandbox 내부 포트 바인딩이 차단되어
  webpack production build로 대체했다.
- 실제 Kakao OAuth, 모바일 Web Share sheet, clipboard 권한, 390×844 최신 캡처 —
  브라우저·실계정이 필요한 수동 QA로 남긴다.

## Related Documents

- **UI Screens**: [Invite Graph Concept](../02_UI_Screens/02_INVITE_GRAPH_CONCEPT.md) - 화면 06·07 인라인 상태와 화면 08 복귀 흐름의 정본.
- **UI Preview**: [Invite Graph Preview](../02_UI_Screens/previews/02_INVITE_GRAPH_PREVIEW.html) - 06 안에 펼쳐진 07의 정적 미리보기.
- **Technical Specs**: [Invite Graph v2 Spec](../03_Technical_Specs/03_INVITE_GRAPH_V2_SPEC.md) - `/invite`와 `/r` 역할 분리 계약.
- **Logic Progress**: [Backlog TASK-005](../04_Logic_Progress/00_BACKLOG.md) - Context, Change, Verification Receipt.
