# 바람대로 히어로 프로토타입 v1

Astro + GSAP ScrollTrigger. 히어로 한 섹션만 포함한다.

## 실행
```
npm install
npm run dev   # http://localhost:4321
```

## 히어로 영상 교체
`public/hero.mp4`로 영상 파일(밖→창 통과→실내)을 넣으면 데스크톱에서 자동으로 영상 스크럽 모드가 활성화된다 (없으면 이미지 줌 폴백, 모바일은 항상 이미지 모드).

- 플레이스홀더 이미지: `public/hero-placeholder.svg` (실제 촬영 이미지로 교체 예정)
- 카피·라벨은 전부 임시 — 소스 내 `[확정 예정]` 주석 참조
