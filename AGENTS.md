# AGENTS.md — 가이 알아? (Gai Ara)

> 이 파일은 이 저장소에서 작업하는 모든 AI 코딩 툴(Claude Code, Cursor, Codex, Copilot 등)이
> 코드를 건드리기 전에 **무조건 먼저 읽어야 하는 최상위 준칙**이다. 아래 내용은
> `.agent/skills/`(solmate-skills)의 각 SKILL.md가 이미 이 파일을 전제로 참조하고 있으므로,
> 이 파일 없이는 해당 스킬들의 게이트(Context Receipt, Verification Receipt 등)가 정상 동작하지 않는다.

## 0. 프로젝트 배경

"가이 알아?" — 제주에서 우리는 몇 다리 건너 연결되어 있을까? Instagram 맞팔 데이터를
이용한 소셜 그래프 실험 서비스. 전체 소개와 아키텍처 요약은 [README.md](./README.md)를,
기술 스택 선택 이유와 트레이드오프는
[docs/03_Technical_Specs/00_DEVELOPMENT_PRINCIPLES.md](./docs/03_Technical_Specs/00_DEVELOPMENT_PRINCIPLES.md)를 먼저 읽는다.

```
apps/web/       Next.js (App Router) — UI + API Route
packages/ig-parser/  Instagram ZIP/JSON 파싱 (순수 함수, 브라우저/Node 겸용)
packages/graph/      그래프 빌드 + BFS + 통계 (프레임워크/DB 의존성 없음)
packages/db/         Drizzle ORM 스키마 + PostgreSQL(postgres-js) 클라이언트
packages/shared/     Zod 스키마 (API 요청/응답 타입)
```

## 1. Privacy-by-Design — 다른 모든 결정보다 우선

이 프로젝트는 개인정보(Instagram 관계 데이터)를 다룬다. 아래 원칙은 다른 어떤 기술적
편의보다 우선하며, 상세 근거는 `00_DEVELOPMENT_PRINCIPLES.md` §3 참고.

1. 원본 ZIP 파일은 서버로 전송하지 않는다 — 파싱은 브라우저에서 끝낸다.
2. 평문 username을 저장하지 않는다 — 서버 전용 pepper가 섞인 해시만 저장한다.
3. 특정 계정을 검색/조회할 수 있는 범용 엔드포인트를 만들지 않는다.
4. 두 사람 사이의 "거리"만 반환하고, 중간 경로(연결자)는 어떤 응답에도 노출하지 않는다.
5. 참여자가 상호 신고한 맞팔만 그래프의 edge로 인정한다(participant-only). followers는 수집하지 않는다.

## 2. 문서 구조 (5-Layer)

| 계층 | 폴더 | 현재 상태 |
| :-- | :-- | :-- |
| 1 Concept_Design | `docs/01_Concept_Design/` | `00_PRODUCT_DECISION_LOG.md` |
| 2 UI_Screens | `docs/02_UI_Screens/` | 화면 에셋만 존재, 문서화 진행 중 |
| 3 Technical_Specs | `docs/03_Technical_Specs/` | 개발 원칙 / DB 스키마 / API 명세 |
| 4 Logic_Progress | `docs/04_Logic_Progress/` | 미생성 |
| 5 QA_Validation | `docs/05_QA_Validation/` | 미생성 |

코드/설계를 바꾸기 전에 관련 계층 문서(특히 3장 기술 문서)를 먼저 확인하고, 결정이 바뀌면
해당 문서를 함께 갱신한다. 문서 규칙 상세는 `.agent/skills/rules-docs/SKILL.md` 참고.

## 3. 코딩 컨벤션

- **검증**: 입력값 검증은 Zod (`packages/shared`의 스키마 우선 재사용).
- **날짜/시간**: Luxon 사용.
- **타입**: `any` 지양, strict 타입 유지.
- **최소 구현**: YAGNI/KISS/DRY — 현재 요구사항에 없는 추상화·의존성·설정을 미리 추가하지 않는다
  (정본: `.agent/skills/rules-dev/SKILL.md`).
- **DB**: 파괴적 마이그레이션/스키마 변경 전 반드시 백업. `DROP TABLE`, `migrate reset` 등은
  백업 확인 없이 실행하지 않는다.
- **커밋 메시지**: 영어, 명령형 짧은 제목(예: `Add reusable referral link`, `Fix confusing unreachable-result flow`).
  자명하지 않은 변경은 본문에 "왜"를 설명한다(`git log`가 정본 — `type(scope):` 접두사나
  한글 커밋 메시지는 이 프로젝트 관행이 아니다).
- **소통 톤**: 이모지 금지. 전문적이고 명확한 텍스트로만 소통한다.

## 4. 작업 워크플로우

기능 구현이나 PR 준비는 `.agent/skills/rules-workflow/SKILL.md`의 18단계 워크플로우를 따른다.
어디서 시작할지 모르겠으면 `rules-product`가 진입점이다. 전체 스킬 목록과 사용법은
[USAGE.md](./USAGE.md) 참고. `code`/`deploy` 작업은 Context Receipt 없이 구현을 시작하지
않고, Verification Receipt(PASS) 없이 Done/PR/merge/deploy로 넘어가지 않는다
(`.agent/skills/rules-workflow/resources/agent-harness-contract.md` 정본).

## 5. 다른 문서와의 우선순위

이 파일과 `docs/03_Technical_Specs/00_DEVELOPMENT_PRINCIPLES.md`가 충돌하면 프로젝트
고유 결정이 담긴 `00_DEVELOPMENT_PRINCIPLES.md`가 우선한다. `.agent/skills/*/SKILL.md`는
범용 기본값이며, 이 파일이나 `docs/`에 프로젝트별 규칙이 있으면 그쪽이 우선한다.
