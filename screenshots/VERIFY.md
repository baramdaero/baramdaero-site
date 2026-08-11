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

## 소형 화면 강등 경계 재조정 (2026-08-11, feat/logo-small-header)
가설: 가로형 높이를 36→28px로 낮추면 폭이 147→114px가 되어 소형에서도 워드마크 유지 가능. **성립.**

| 폭 | 락업 | 로고 크기 | 로고↔메뉴 여유 | 가로스크롤 |
|---|---|---|---|---|
| 320 · 344 · 359 | mark | 32×32 | 61 · 85 · 100px | 없음 |
| **360** | **wide** | **114×28** | **18px** | 없음 |
| **375** | **wide** | **114×28** | **33px** | 없음 |
| **390 · 393** | **wide** | **114×28** | **48 · 51px** | 없음 |
| 399 | wide | 114×28 | 57px | 없음 |
| 400 · 414 | wide | 147×36 | 26 · 40px | 없음 |
| 640 · 1440 | wide | 147×36 | 266 · 641px | 없음 |

적용: 강등 경계 **399 → 359**. 아이폰 14·15(390~393px)에서 워드마크가 나온다.
- `hdr-360-before-after.png` — 실제 크기 비교 (마크 단독 → 가로형)
- `hdr-360/375/390-wide28.png` — 각 폭 실제 렌더

부수 수정: `.bd-header__logo img`에 `flex-shrink: 0` 추가.
없으면 협소 폭에서 flex가 로고를 가로로 눌러 **비율이 깨진다**(320px에서 114→83px 실측).
락업 선택 근거: horizontal(2.61)·inline(1.44)·vertical(0.53)은 세로가 커서 같은 높이에서 워드마크가 더 작아진다.
wide(4.07)가 짧은 헤더에 최적이며 README도 wide를 헤더 기본형으로 지정한다.
한계: 28px에서 워드마크 획이 36px보다 두껍게 뭉친다(rect 적층 구조). 실제 크기에서는 판독 가능.
