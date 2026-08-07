# feat/teal-rebrand-restructure 검증 산출물 (2026-08-07)

## 스크린샷 (데스크톱 1440px 풀페이지, dist 정적 서빙 기준)
- `home-main-1440.png` — main(e01953a, 그린 듀오톤) 홈
- `home-teal-rebrand-1440.png` — 본 브랜치(틸 v3) 홈

## Lighthouse (performance only, desktop preset, headless Chrome, 정적 dist)
| 대상 | 성능 | FCP | LCP | TBT | CLS |
|---|---|---|---|---|---|
| main | 98 | 0.8s | 1.0s | 0ms | 0 |
| 본 브랜치 | 98 | 0.8s | 1.0s | 0ms | 0 |

하락 없음.

## 그린 토큰 참조 grep (완료 조건)
`grep -rliE "canopy|lime|#2d3e2c|#1f2b1e|#e4fd97" src/ public/` → 0건
(src/legacy/는 v1 웜우드 보존분 — 그린 토큰 자체가 없음. 히스토리 주석 1건은 DESIGN.md의 "v2 폐기" 기록 문구)
