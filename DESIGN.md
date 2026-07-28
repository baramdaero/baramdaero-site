# DESIGN.md — 바람대로 디자인 규칙

모든 UI 작업은 이 문서를 먼저 읽고 시작한다. 위반 스타일은 커밋 금지 (CLAUDE.md 절대 규칙 ③).
커밋 전 셀프 체크: 아래 규칙 위반 여부를 확인한 뒤에만 커밋한다.

## 1. 타이포그래피
- 헤드라인·슬로건: **Noto Serif KR** (400·600)
- 본문: **Pretendard** — 숫자는 `font-variant-numeric: tabular-nums`
- 한글 타이포 기준: `letter-spacing: -0.01em ~ 0`, `line-height: 1.2 ~ 1.3`(헤드라인) / 1.6~1.75(본문).
  라틴 기준값(negative tracking 과다 등) 이식 금지
- `word-break: keep-all` 기본. 헤드라인 `text-wrap: balance`, 본문 `text-wrap: pretty`
- 루트에 `-webkit-font-smoothing: antialiased`

## 2. 색
- 배경: `--bg: #F4EFE7` (웜 우드 뉴트럴). 대안 `#FFFFFF` — 실물 비교 후 확정, CSS 변수 주석 병기
- 액센트: **카퍼 `#A8623C` — CTA 전용.** 링크·아이콘 등 비-CTA에 면적 사용 금지
- **실버 `#B8BCC0` — 1px 라인·아이콘·마이크로라벨 전용.** 면적(배경 등) 사용 금지
- 잉크(본문 텍스트): 웜 블랙 계열 (`#211E1A` 기준, 보조 `#6B6459`)

## 3. 레이아웃
- 에디토리얼 톤. 히어로는 좌하단 앵커 + 극단적 여백 (풀스크린 영상 히어로는 중앙 카피 + 하단 패널 구성)
- 슬로건: **"당신의 바람대로."**
- 마이크로라벨: 실버, 11px, `letter-spacing: 0.2em`, 대문자/숫자 라벨

## 4. 모션 — 절제. 목표 정서 "상쾌함"
허용 모션 (홈 히어로 기준 3종만):
1. 히어로 영상 루프 (사전 렌더 mp4, canvas 프레임 캡처 방식 금지)
2. 링크·버튼 색 전환 200ms
3. 인터랙티브 로우 hover 배경 + 화살표 nudge

공통 모션 표준 (emilkowalski/skills · make-interfaces-feel-better 검토 후 채택):
- UI 모션은 **300ms 이하**, 기본 이징 `--ease-out: cubic-bezier(0.23, 1, 0.32, 1)`
- 애니메이션 속성은 **`transform` · `opacity`만** (layout 유발 속성 금지)
- 상태 전환은 keyframes 대신 **transition** (인터럽트 가능)
- 누르는 요소는 `:active { transform: scale(0.96) }` (0.95 미만 금지)
- `transition: all` 금지 — 속성 명시
- `prefers-reduced-motion: reduce` 시 이동 모션 제거, opacity/색만 유지
- hover 모션은 `@media (hover: hover) and (pointer: fine)` 게이트
- 과한 패럴랙스·바운스 금지

## 5. 표면·디테일
- 중첩 radius는 동심원: 바깥 radius = 안쪽 radius + padding
- 깊이 표현은 저투명 layered `box-shadow`, 구조 표현은 1px 실버 라인
- 터치 히트영역 최소 44×44px (모바일)
- 아이콘은 `currentColor` 단일 SVG, 상태는 CSS 색으로. 라인(outline) 기본
- 글래스 패널: `background: rgba(255,255,255,0.9)` + `backdrop-filter: blur`

## 6. 금지
- 이모지
- 그라디언트 남용 (장식 그라디언트 금지 — 영상 위 가독성용 스크림은 예외)
- 스톡사진 느낌 일러스트
- 실버의 면적 사용, 카퍼의 비-CTA 사용
- canvas 프레임 캡처 히어로 (모바일 메모리 이슈)

## 7. 콘텐츠 톤 (사이트 문안 공통)
- 이모지·감탄사·수사적 질문 금지, AI 상투구 금지
- 근거 없는 수치 금지 — 실측값이 없으면 그 문장을 쓰지 않는다
- 형용사 대신 구체 명사. 문단 2~3문장, 모바일 360px 기준
