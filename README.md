# baramdaero-site

바람대로 본진 정적 사이트. Astro + 바닐라 JS 챗봇. 규칙은 [CLAUDE.md](CLAUDE.md)·[DESIGN.md](DESIGN.md) 참조.

## 실행
```
npm install
npm run dev     # http://localhost:4321
npm run build   # dist/ 정적 빌드
```

## 구조
- `/` 홈 — 풀스크린 영상 히어로 + 하단 글래스 패널(챗봇 진입 3행) + 최신 시공사례 3건
- `/cases/` 시공사례 (md 1건 = 사례 1건, region/type 필터)
- `/care/` 세척·유지관리 정보, `/story/` 브랜드이야기, `/blog/` 블로그
- 챗봇: 4트리(세척/AS/설치/기타) — `src/components/Chatbot.astro`
- 설정 단일 소스: `src/config.js` (연락처·채널 값은 확정 전까지 플레이스홀더)

## 콘텐츠 추가
- 시공사례: `src/content/cases/*.md` — frontmatter `region / space / brand / type(설치·세척·복원) / units / date / cover`
- 블로그: `src/content/blog/*.md` — `title / description / date / cover`
- `sample: true`인 파일은 더미 — 실제 콘텐츠로 교체 후 플래그 제거

## 히어로 영상 교체
`public/media/hero-loop.mp4`(사전 렌더 왕복 루프) 교체 후 경로는 `src/config.js`의 `HERO_VIDEO`.
canvas 프레임 캡처 방식 구현 금지 (모바일 메모리 이슈).

## 배포
GitHub Actions → GitHub Pages (`.github/workflows/deploy.yml`, main push 시).
워크플로·DNS 변경은 수동 승인 대상. 커스텀 도메인: `public/CNAME` (baramdaero.com).
