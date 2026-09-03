# 글래스 시스템 1차 검증 (2026-08-27)

- 브랜치 `feat/glass-system` · 1440×900 / 390×844 · Chrome headless
- 대비: 실제 합성 픽셀(패딩 띠 5점 중앙값, 트랜지션·smooth 스크롤 정지) vs 텍스트 computed color
- 샘플러 검증: 불투명 base 지점 → rgb(247,249,250) 정확 일치

## 대비 실측 — AA 4.5 미달 0건

| AA | 대비 | 표면 | 실측 표면색 |
|---|---:|---|---|
| ✓ | 15.77 | 서비스 Medium #1 본문 | rgb(246,248,249) |
| ✓ | 8.67 | 서비스 Medium #1 제목 | rgb(246,248,249) |
| ✓ | 15.91 | 서비스 Medium #2 본문 | rgb(247,249,250) |
| ✓ | 8.75 | 서비스 Medium #2 제목 | rgb(247,249,250) |
| ✓ | 15.77 | 서비스 Medium #3 본문 | rgb(246,248,249) |
| ✓ | 8.67 | 서비스 Medium #3 제목 | rgb(246,248,249) |
| ✓ | 8.53 | 고객유형 Medium #1 본문 (딥 위) | rgb(173,187,194) |
| ✓ | 4.69 | 고객유형 Medium #1 제목 (딥 위) | rgb(173,187,194) |
| ✓ | 8.53 | 고객유형 Medium #2 본문 (딥 위) | rgb(173,187,194) |
| ✓ | 4.69 | 고객유형 Medium #2 제목 (딥 위) | rgb(173,187,194) |
| ✓ | 8.53 | 고객유형 Medium #3 본문 (딥 위) | rgb(173,187,194) |
| ✓ | 4.69 | 고객유형 Medium #3 제목 (딥 위) | rgb(173,187,194) |
| ✓ | 7.41 | CTA Dark 제목 | rgb(57,90,103) |
| ✓ | 7.02 | CTA Dark 서브 | rgb(57,90,103) |
| ✓ | 11.02 | 헤더 Heavy · 히어로 영상 위 | rgb(205,210,213) |
| ✓ | 15.81 | 헤더 Heavy · 서비스 섹션 위 | rgb(247,248,250) |

해석적 하한(등급 알파 × 최악 배경): Medium over 딥틸·teal **4.67**(실측 4.69), Light over 딥틸·teal **3.21** → Light는 라벨 전용.

## 폴백
`prefers-reduced-transparency: reduce`(CDP 에뮬레이션, 미디어쿼리 매치 true): header/svc/card = base 불투명, cta = teal-deep 불투명, backdrop-filter none. `@supports not (backdrop-filter)` 블록 dist 포함.

## 성능 (390px)
스크롤 248프레임 평균 16.6ms · p95 17.3 · 최대 17.8 — 60fps 유지, 드롭 0. blur 레이어 **8**(헤더1·서비스 패널3·고객유형3·CTA1) · **중첩 0**.

## 앰비언트
서비스 섹션 거터 6점: base 대비 최대 채널 편차 **16/255**.

## 회귀
챗봇 진입점 5·패널 열림 ✓ · 4xx/5xx 0 · overflow 0 · dist 규칙(사진0·무상0·기간0·최상급0·공포0·보증1 기존) · 카피 JSON diff 0.

캡처: gl-home-1440 · gl-home-390 · gl-header-scrolled(히어로 영상 위 Heavy) · gl-fallback(투명도 최소화)
