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

## 기준가·체크리스트 검증 (2026-08-07 후속 커밋)
- `care-ours-empty.png` / `install-ours-empty.png` — ours 전부 빈 상태: "바람대로는 —" 줄 미노출 (dist grep 0건)
- `care-ours-filled.png` — care_checklist[0].ours 임시값 기입 시 해당 항목에만 노출 확인 후 되돌림 (되돌림 후 dist grep 0건 재확인)
- FAQPage JSON-LD: 신규 6건 전부 dist/faq/index.html에 포함 (질문별 grep 각 3회 — JSON-LD·본문·챗봇 데이터)

## 로고 적용 검증 (2026-08-11, feat/logo-apply)
- `hdr-1440-overlay.png` — 히어로 위 오버레이: wide-reverse 147×36
- `hdr-1440-scrolled.png` — 스크롤 후 솔리드 전환: wide(teal) 147×36
- `hdr-1440-solid.png` — 서브페이지(/care/) 솔리드: wide(teal) 147×36
- `hdr-360-overlay.png` — **360px: mark-reverse 32×32로 강등** (가로형이면 메뉴와 충돌)
- `footer-1440.png` — wide-reverse 114×28, 슬로건·메뉴·사업자정보 블록 유지

강등 경계 실측 (로고↔메뉴 여유 / 가로스크롤 전 구간 없음):
| 폭 | 락업 | 여유 |
|---|---|---|
| 320·360·390 | mark 32×32 | 61·101·131px |
| 414·420·480 | wide 147×36 | 40·46·106px |
| 640 이상 | wide 147×36 | 266px+ |

경계 399/400px — 390px 이하는 마크, 414px(아이폰 Plus 계열)부터 가로형 노출.
