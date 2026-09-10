# public/ 에셋 규칙

Next.js가 그대로 정적으로 서빙하는 폴더. `public/foo/bar.png`는 `/foo/bar.png`로
접근된다. 여기 있는 파일은 전부 실제 서비스 화면에서 쓰는 최종 에셋이다 — 디자인
리뷰용 목업/스크린샷은 `docs/02_UI_Screens/assets/`에 넣는다.

```text
public/
  character/   감귤 캐릭터 일러스트 (기획서 13장). 상태별로 파일명 구분:
               character-guide.png    안내
               character-analyzing.png 분석 중
               character-done.png     완료
               character-empty.png    빈 상태
               character-share.png    공유 유도
  icons/       UI 아이콘 (SVG 우선). node/connection 시각화용 아이콘 등.
  images/      OG 이미지 등 그 외 이미지.
```

## 포맷 권장

- 캐릭터: PNG, 배경 투명, 실제 표시 크기의 2배 해상도(레티나 대응).
- 아이콘: 가능하면 SVG (색상은 CSS `currentColor`로 상속되게, 아니면 브랜드 팔레트
  고정값 사용).
- 파일명: kebab-case, 확장자 포함해서 목적이 드러나게 (`character-analyzing.png`,
  `icon-share.svg`).

## 파비콘 / 홈 화면 아이콘

이 폴더가 아니라 Next.js App Router의 파일 기반 메타데이터 컨벤션을 따른다 —
아래 경로에 파일을 두면 Next.js가 자동으로 `<head>` 태그를 생성한다.

```text
apps/web/app/icon.png        브라우저 탭 파비콘 (32x32 이상 정사각형 권장)
apps/web/app/apple-icon.png  iOS 홈 화면 추가 아이콘 (180x180 권장)
```
