# DESIGN.md — 바람대로 디자인 규칙 v3 (teal-rebrand)

모든 UI 작업은 이 문서를 먼저 읽고 시작한다. 위반 스타일은 커밋 금지 (CLAUDE.md 절대 규칙 ③).
커밋 전 셀프 체크: 아래 규칙 위반 여부를 확인한 뒤에만 커밋한다.
v1(웜우드·에디토리얼·Noto Serif) 체계는 폐기 — 산출물은 src/legacy/ 보존.
v2(그린 듀오톤 canopy/lime) 체계는 폐기 — 본 v3 틸 토큰이 대체 (산출물은 git 히스토리 보존).

## 1. 색 — 틸 토큰 (전면 교체)
```
--br-teal:      #004E64   주색: 헤드라인, CTA(라이트 구간), 딥섹션 배경
--br-teal-deep: #00293A   다크 구간 배경 (푸터·마퀴·서브 히어로·스크럽)
--br-ice:       #BFE9F2   액센트: 눈썹 칩, 다크 구간 강조·CTA, hover
--br-base:      #F7F9FA   기본 배경
--br-mist:      #E0E5E9   교차 섹션 배경 (--br-line 별칭 = 1px 라인·보더 겸용)
--br-ink:       #0B2027   본문 텍스트
--br-ink-sub:   #465D68   서브 텍스트 (ink 계열 명도 상승 파생 — 위계·AA 확보용)
```
- 규칙: CTA=teal(라이트 구간)·ice(다크 구간) / 본문=ink /
  섹션 교차 배경=base↔mist / 다크 구간 배경=teal-deep
- ice 넓은 면 위 텍스트는 teal·ink 계열만 (흰 글자 금지)
- 라이트 배경 위 ice 본문 금지 (ice는 칩 배경·다크 구간 강조 전용)
- CTA(라이트 구간) = teal 채움 + 흰 글자, hover = ice 채움 + teal 글자.
  다크 구간 CTA(`--deep` 변형) = ice 채움 + teal 글자, hover 흰 채움

### WCAG AA 대비표 (2026-08-07 계산 — 전 조합 4.5:1 이상, 명도 조정 불요)
| 전경 | 배경 | 대비 | 판정 | 용도 |
|---|---|---|---|---|
| ink #0B2027 | base #F7F9FA | 15.91 | AA | 본문 |
| ink #0B2027 | mist #E0E5E9 | 13.24 | AA | 교차 섹션 본문 |
| ink-sub #465D68 | base #F7F9FA | 6.57 | AA | 서브 텍스트 |
| ink-sub #465D68 | mist #E0E5E9 | 5.47 | AA | 교차 섹션 서브 텍스트 |
| teal #004E64 | base #F7F9FA | 8.75 | AA | 헤드라인·링크 |
| teal #004E64 | mist #E0E5E9 | 7.28 | AA | 교차 섹션 헤드라인 |
| 흰 #FFFFFF | teal #004E64 | 9.24 | AA | CTA 텍스트(라이트 구간) |
| base #F7F9FA | teal-deep #00293A | 14.43 | AA | 다크 구간 본문 |
| 흰 #FFFFFF | teal-deep #00293A | 15.24 | AA | 다크 구간 헤드라인 |
| ice #BFE9F2 | teal-deep #00293A | 11.72 | AA | 다크 구간 강조 `<em>` |
| ice #BFE9F2 | teal #004E64 | 7.10 | AA | teal 섹션 위 강조 |
| teal #004E64 | ice #BFE9F2 | 7.10 | AA | 눈썹 칩·다크 CTA 텍스트 |
| ink #0B2027 | ice #BFE9F2 | 12.92 | AA | ice 면 위 본문 |

- 구 토큰(--bg·--ink·--copper·--silver·--serif)은 **레거시 별칭**으로만 존재
  (global.css 하단, v1 컴포넌트·챗봇 호환). 신규 코드에서 사용 금지

## 2. 타이포그래피 — Pretendard 단일 (세리프 폐기)
- 전 텍스트: **Pretendard Variable** (CDN 1회, Base.astro). Noto Serif KR 로드 금지
- 눈썹 라벨 `.br-eyebrow`: 13px 600, ice 칩 + teal 텍스트, letter-spacing 0.02em
- 섹션 헤드라인 `.br-h`: `clamp(32px, 6vw, 64px)`, 800, line-height 1.15,
  letter-spacing -0.02em, **의도적 줄바꿈(`<br>`)으로 2~3줄 리듬**, 색은 teal
  (다크 구간 위는 흰색, 강조 단어 1개만 `<em>`=ice 허용)
- 본문 `.br-body`: 16px(데스크톱 17px), line-height 1.7, ink-sub. 헤드라인 아래 최대 3줄
- 숫자(카운터·가격): `font-variant-numeric: tabular-nums`, 700
- `word-break: keep-all` 기본, 헤드라인 `text-wrap: balance`, 본문 `text-wrap: pretty`

## 3. 레이아웃 — 스크롤 스토리텔링, 1뷰포트 1메시지
- 콘텐츠 max-width **1120px** (`--maxw`), 섹션 수직 여백 **데스크톱 120px / 모바일 72px**
  (`.bd-section`)
- 홈 구조 고정: S1 풀블리드 히어로(92vh, 영상+teal-deep 60% 오버레이) → S2 다크 스크럽(teal-deep 풀블리드)
  → S3~S5 서비스 지그재그 → S6 시공 마퀴(teal-deep 풀폭) → S7 신뢰 지표 카운트업
  → S8 진행 절차(mist) → (S9 후기 — 실후기 확보 전 미노출) → S10 CTA 밴드(teal) → 푸터(teal-deep)
- 서브페이지(/care/ /install/ /cases/ /faq/): 짧은 히어로(teal-deep, 40vh) + 콘텐츠 + CTA 밴드
- 섹션 배경은 base ↔ mist ↔ 딥(teal·teal-deep) 교차로 리듬
- 슬로건: **"당신의 바람대로."**

## 4. 모션 — 공용 1벌 (src/scripts/motion.ts), 외부 라이브러리 금지
- **스크롤 리빌** `.br-reveal`: IntersectionObserver threshold 0.15, 1회.
  opacity 0→1 + translateY(24px→0), 0.6s `cubic-bezier(.16,1,.3,1)`, 형제 60ms stagger.
  **no-JS 안전장치**: 숨김은 `html.br-js` 하위에서만 — JS 실패 시 전 콘텐츠 노출.
  이 게이트 밖에 `opacity: 0` 초기 숨김 금지
- **마퀴**: CSS keyframes 무한, 트랙 = 동일 세트 2벌 → translateX(-50%) 루프,
  hover 시 pause. 카드는 cases 컬렉션에서만 (더미 생성 금지)
- **카운트업** `[data-countup]`: 진입 시 0→목표값 1.2s. 마크업 기본값 = 최종값
- `prefers-reduced-motion`: 리빌·마퀴·카운트업·히어로 영상 정지
- UI 모션 300ms 이하, `transform`·`opacity`만, 상태 전환은 transition,
  `:active { scale(0.96) }`, `transition: all` 금지, hover는 `(hover:hover)` 게이트
- 금지: 패럴랙스, 3D, 커서 이펙트, GSAP 등 외부 라이브러리 (전부 바닐라)
- 히어로 영상: 사전 렌더 mp4 루프 (canvas 프레임 캡처 금지)
- **다크 스크럽(S2)**: 스크롤 진행도→프레임 시퀀스 캔버스(바닐라), 프레임은 `/public/scrub/`,
  poster 1장 폴백 필수. 모바일=프레임 절반 로드, reduced-motion=스크럽 비활성+정지컷

## 5. 표면·디테일
- radius 기본 12px(`--radius`), 중첩 radius는 동심원
- 구조 표현은 1px `--br-line`, 터치 히트영역 최소 44×44px
- 아이콘은 `currentColor` 라인 SVG 단일
- 오버레이 헤더는 히어로 구간을 벗어나면 솔리드(흰 92% + blur) 전환

## 6. 금지
- 이모지 / 장식 그라디언트 (영상 가독성 스크림은 예외) / 스톡 일러스트
- 제3색 (틸 토큰 팔레트 외 색상)
- 세리프 폰트 로드
- 지표·가격·FAQ 하드코딩 — trust/pricing/faq.json에서만 읽는다
- 문의 폼 신설 — 접수 진입점은 챗봇 단일, 모든 CTA는 `data-chat-tree`로 챗봇 호출

## 7. 콘텐츠 톤 (사이트 문안 공통)
- 이모지·감탄사·수사적 질문 금지, AI 상투구 금지
- 근거 없는 수치 금지 — 실측값이 없으면 그 문장을 쓰지 않는다
- 형용사 대신 구체 명사. 문단 2~3문장, 모바일 360px 기준
