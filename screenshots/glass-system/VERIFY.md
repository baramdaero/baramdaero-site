# 글래스 시스템 1차 검증 (2026-08-27 · 조정 3건 반영)

조정: 딥틸 위 고객유형 카드 Medium→Heavy / 앰비언트 ice 42→30% / Dark 테두리 white 10% 유지(사유 주석)

- 브랜치 `feat/glass-system` · 1440×900 / 390×844 · Chrome headless
- 대비: 실제 합성 픽셀(패딩 띠 5점 중앙값, 트랜지션·smooth 스크롤 정지) vs 텍스트 computed color
- 샘플러 검증: 불투명 base 지점 → rgb(247,249,250) 정확 일치

## 대비 실측 — AA 4.5 미달 0건 · 최저 6.13 (2차 조정 후)

| AA | 대비 | 표면 | 실측 표면색 |
|---|---:|---|---|
| ✓ | 15.77 | 서비스 Medium #1 본문 | rgb(246,248,249) |
| ✓ | 8.67 | 서비스 Medium #1 제목 | rgb(246,248,249) |
| ✓ | 15.91 | 서비스 Medium #2 본문 | rgb(247,249,250) |
| ✓ | 8.75 | 서비스 Medium #2 제목 | rgb(247,249,250) |
| ✓ | 15.77 | 서비스 Medium #3 본문 | rgb(246,248,249) |
| ✓ | 8.67 | 서비스 Medium #3 제목 | rgb(246,248,249) |
| ✓ | 11.16 | 고객유형 Heavy #1 본문 (딥 위) | rgb(203,212,216) |
| ✓ | 6.13 | 고객유형 Heavy #1 제목 (딥 위) | rgb(203,212,216) |
| ✓ | 11.16 | 고객유형 Heavy #2 본문 (딥 위) | rgb(203,212,216) |
| ✓ | 6.13 | 고객유형 Heavy #2 제목 (딥 위) | rgb(203,212,216) |
| ✓ | 11.16 | 고객유형 Heavy #3 본문 (딥 위) | rgb(203,212,216) |
| ✓ | 6.13 | 고객유형 Heavy #3 제목 (딥 위) | rgb(203,212,216) |
| ✓ | 7.40 | CTA Dark 제목 | rgb(57,90,104) |
| ✓ | 7.01 | CTA Dark 서브 | rgb(57,90,104) |
| ✓ | 11.01 | 헤더 Heavy · 히어로 영상 위 | rgb(205,210,212) |
| ✓ | 15.91 | 헤더 Heavy · 서비스 섹션 위 | rgb(247,249,250) |

해석적 하한(등급 알파 × 최악 배경): Medium over 딥틸·teal **4.67**(실측 4.69), Light over 딥틸·teal **3.21** → Light는 라벨 전용.

## 폴백
`prefers-reduced-transparency: reduce`(CDP 에뮬레이션, 미디어쿼리 매치 true): header/svc/card = base 불투명, cta = teal-deep 불투명, backdrop-filter none. `@supports not (backdrop-filter)` 블록 dist 포함.

## 성능 (390px)
스크롤 248프레임 · 평균 16.6ms · p95 17.5ms · 최대 19.7ms · >20ms 0개 · 레이어 7 중첩 0

## 앰비언트
서비스 섹션 거터 6점: base 대비 최대 채널 편차 **10/255**.

## 회귀
챗봇 진입점 5·패널 열림 ✓ · 4xx/5xx 0 · overflow 0 · dist 규칙(사진0·무상0·기간0·최상급0·공포0·보증1 기존) · 카피 JSON diff 0.

캡처: gl-home-1440 · gl-home-390 · gl-header-hero(히어로 영상 위 Heavy) · gl-header-section(섹션 위 Heavy) · gl-fallback(투명도 최소화)
