# DESIGN.md — 바람대로 디자인 규칙 v2 (redesign-v2)

모든 UI 작업은 이 문서를 먼저 읽고 시작한다. 위반 스타일은 커밋 금지 (CLAUDE.md 절대 규칙 ③).
커밋 전 셀프 체크: 아래 규칙 위반 여부를 확인한 뒤에만 커밋한다.
v1(웜우드·에디토리얼·Noto Serif) 체계는 폐기 — 산출물은 src/legacy/ 보존.

## 1. 색 — 그린 토큰 (전면 교체)
```
--br-canopy:      #2D3E2C   주색: 헤드라인, CTA, 딥섹션·푸터 배경
--br-canopy-deep: #1F2B1E   더 깊은 면 (마퀴·푸터·서브 히어로)
--br-lime:        #E4FD97   액센트: 눈썹 칩, 딥섹션 위 강조, hover
--br-bg:          #FFFFFF
--br-bg-alt:      #F6F9EE   교차 섹션 배경
--br-line:        #E2E8DC   1px 라인·보더
--br-text:        #1E241D
--br-text-sub:    #5C665A
```
- **대비는 그린 계열 명도 차로만. 제3색 금지**
- lime 넓은 면 위 텍스트는 canopy 계열만 (흰 글자 금지)
- 흰 배경 위 lime 본문 금지 (lime은 칩 배경·딥섹션 위 강조 전용)
- CTA = canopy 채움 + 흰 글자, hover = lime 채움 + canopy 글자.
  딥 배경 위 CTA(`--deep` 변형) = lime 채움 + canopy 글자, hover 흰 채움
- 대비 AA 검증값 (2026-07-30 계산): canopy/흰 11.43 · 흰/canopy-deep 14.76 ·
  lime/canopy 10.23 · canopy/lime 10.23 · text/흰 15.85 · text-sub/흰 5.99 ·
  text-sub/bg-alt 5.62 — 전 조합 4.5:1 이상
- 구 토큰(--bg·--ink·--copper·--silver·--serif)은 **레거시 별칭**으로만 존재
  (global.css 하단, v1 컴포넌트·챗봇 호환). 신규 코드에서 사용 금지

## 2. 타이포그래피 — Pretendard 단일 (세리프 폐기)
- 전 텍스트: **Pretendard Variable** (CDN 1회, Base.astro). Noto Serif KR 로드 금지
- 눈썹 라벨 `.br-eyebrow`: 13px 600, lime 칩 + canopy 텍스트, letter-spacing 0.02em
- 섹션 헤드라인 `.br-h`: `clamp(32px, 6vw, 64px)`, 800, line-height 1.15,
  letter-spacing -0.02em, **의도적 줄바꿈(`<br>`)으로 2~3줄 리듬**, 색은 canopy
  (딥섹션 위는 흰색, 강조 단어 1개만 `<em>`=lime 허용)
- 본문 `.br-body`: 16px(데스크톱 17px), line-height 1.7, text-sub. 헤드라인 아래 최대 3줄
- 숫자(카운터·가격): `font-variant-numeric: tabular-nums`, 700
- `word-break: keep-all` 기본, 헤드라인 `text-wrap: balance`, 본문 `text-wrap: pretty`

## 3. 레이아웃 — 스크롤 스토리텔링, 1뷰포트 1메시지
- 콘텐츠 max-width **1120px** (`--maxw`), 섹션 수직 여백 **데스크톱 120px / 모바일 72px**
  (`.bd-section`)
- 홈 구조 고정: S1 풀블리드 히어로(92vh, 영상+canopy 60% 오버레이) → S2 문제 제기(bg-alt)
  → S3~S5 서비스 지그재그 → S6 시공 마퀴(canopy-deep 풀폭) → S7 신뢰 지표 카운트업
  → S8 진행 절차(bg-alt) → (S9 후기 — 실후기 확보 전 미노출) → S10 CTA 밴드(canopy) → 푸터(canopy-deep)
- 서브페이지(/care/ /cases/): 짧은 히어로(canopy-deep, 40vh) + 콘텐츠 + CTA 밴드
- 섹션 배경은 흰 ↔ bg-alt ↔ 딥(canopy·canopy-deep) 교차로 리듬
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

## 5. 표면·디테일
- radius 기본 12px(`--radius`), 중첩 radius는 동심원
- 구조 표현은 1px `--br-line`, 터치 히트영역 최소 44×44px
- 아이콘은 `currentColor` 라인 SVG 단일
- 오버레이 헤더는 히어로 구간을 벗어나면 솔리드(흰 92% + blur) 전환

## 6. 금지
- 이모지 / 장식 그라디언트 (영상 가독성 스크림은 예외) / 스톡 일러스트
- 제3색 (그린 토큰 팔레트 외 색상)
- 세리프 폰트 로드
- 지표·가격·FAQ 하드코딩 — trust/pricing/faq.json에서만 읽는다
- 문의 폼 신설 — 접수 진입점은 챗봇 단일, 모든 CTA는 `data-chat-tree`로 챗봇 호출

## 7. 콘텐츠 톤 (사이트 문안 공통)
- 이모지·감탄사·수사적 질문 금지, AI 상투구 금지
- 근거 없는 수치 금지 — 실측값이 없으면 그 문장을 쓰지 않는다
- 형용사 대신 구체 명사. 문단 2~3문장, 모바일 360px 기준
