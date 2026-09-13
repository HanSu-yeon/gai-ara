# 파일 가져오기 UI 설계
> Created: 2026-09-13 00:00
> Last Updated: 2026-09-13 00:00

## 미리보기와 확인 상태
[HTML 미리보기](./previews/01_IMPORT_PREVIEW.html). 사용자 확인 대기이며 앱 적용 완료가 아니다.
사용자의 이번 제안이 카피와 흐름의 기준이다. Consumer UX는 읽기와 기억 부담 감소,
Functionality는 기존 파일 처리와 복귀 상태 보존을 기준으로 검토한다.

> 2026-09-13: 이 Instagram 파일 가져오기 흐름은 MVP 기본 경로에서 제외됐다(제품 결정
> [00_PRODUCT_DECISION_LOG.md](../01_Concept_Design/00_PRODUCT_DECISION_LOG.md) 2026-09-13
> 항목, 새 화면 스토리보드는 [02_INVITE_GRAPH_CONCEPT.md](./02_INVITE_GRAPH_CONCEPT.md)
> 참고). 후순위 기능으로 재검토할 때까지 이 문서는 참고용으로 남긴다.

## 화면 구성
모바일 단일 열을 데스크톱에서도 중앙 정렬한다. 기존 브랜드 색·버튼·캐릭터를 재사용한다.
초대는 제목, 이름 없는 연결 예시, 연결 확인하기, 파일이 필요하다는 짧은 설명 순서다.
가이드는 준비 순서, 지연 안내, 세 선택값, 외부 이동 버튼, 완료 알림 설명 순서다.
복귀는 파일 선택을 주 행동으로 하고 Instagram에서 파일 받기를 보조 행동으로 둔다.
시간 소요를 보장하지 않는다. 필수 개인정보 고지는 기존처럼 유지한다.

## Component & Library Plan
ImportOnboarding, UploadGuide/GuideChecklist, UploadFlow, ImportReturnGate, ResumeImport와
기존 랜딩/초대 화면의 문구 및 배치를 조정한다. 기존 BrandHeader, Character, Icon과 스타일을 재사용한다.
새 라이브러리와 shadcn init/apply는 필요하지 않다. 기존 React 상태 및 URL 경로를 재사용한다.
미리보기는 외부 호출·저장·파싱이 없는 HTML이며 실제 앱 기능 검증을 대신하지 않는다.

## Related Documents
- [화면 흐름](./00_SCREEN_FLOW.md) - 전환과 상태, 수용 기준
- [제품 결정](../01_Concept_Design/00_PRODUCT_DECISION_LOG.md) - 제품 근거
- [개발 원칙](../03_Technical_Specs/00_DEVELOPMENT_PRINCIPLES.md) - 유지할 기술 제약

## 2026-09-13 초대 티저 부분 승인
사용자가 curious.png와 curious2.png를 비교한 뒤 첫 번째 이미지 적용에 동의했다(“ㅇㅋ”).
초대 첫 화면의 상단 이미지를 curious.png로 교체하고 예시 동그라미/연결선은 제거한다.
제목은 “우리, 몇 다리 건너 아는 사이일까?”, 버튼은 “우리 연결 확인하기”로 표시한다.
이미지는 기존 PNG를 그대로 사용하고 CSS로 외곽 여백을 줄인다. 시작 후와 실제 결과 화면은 유지한다.
이 승인은 초대 티저에 한정하며, 위의 전체 파일 가져오기 미리보기는 별도 확인 대기다.
