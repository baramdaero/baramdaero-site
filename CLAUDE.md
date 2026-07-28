# CLAUDE.md — baramdaero-site

바람대로(에어컨 설치·세척·AS) 본진 정적 사이트. 에인연(ain-*)과는 **별개 회사 프로젝트** — 자산·코드 혼입 금지.

## 스택
- Astro 정적 사이트 (빌드: `npm run build`). 콘텐츠는 md(Content Collections), 챗봇은 바닐라 JS 컴포넌트
- 배포: GitHub Actions → GitHub Pages. 루트 도메인 baramdaero.com (public/CNAME)
- 예약·구매는 외부 링크: shop.baramdaero.com (config 값)

## 절대 규칙
0. **공개 레포 — 커밋 메시지·주석에 내부 정보(가격 전략·거래처·협의 내용) 기재 금지**
1. **배포 워크플로(.github/workflows/)·DNS 관련 변경은 파일 출력 후 수동 승인.** 임의로 main 반영·Pages 설정 변경하지 않는다
2. **src/config.js의 연락처·채널 값(KAKAO_CHANNEL_URL, PHONE)은 임의 기입 금지** — 실값 확정 전까지 플레이스홀더("") 유지. 코드가 빈 값 폴백을 처리한다
3. **DESIGN.md 위반 스타일 금지.** 모든 UI 작업 전에 DESIGN.md를 먼저 읽고, 커밋 전 셀프 체크한다

## 구조
- `src/config.js` — 연락처·채널·샵 링크·히어로 영상 경로 (단일 소스)
- `src/content/cases/` — 시공사례 md (frontmatter: region, space, brand, type, units, date, cover)
- `src/content/blog/` — 블로그 md
- `src/components/Chatbot.astro` — 문의 챗봇 (4트리: 세척/AS/설치/기타). 진입점 2개: 플로팅 버튼 + 홈 히어로 하단 로우
- 히어로: 사전 렌더 왕복 루프 mp4 (`config.HERO_VIDEO`). canvas 프레임 캡처 방식 구현 금지

## 콘텐츠 규칙
- 샘플/더미 콘텐츠에는 `[샘플 — 실제 사례로 교체 예정]` 표시를 유지한다
- 시공 수치는 실측값만. 실측값이 없으면 수치 문장을 쓰지 않는다 (DESIGN.md §7)
