# CLAUDE.md — baramdaero-site

바람대로(에어컨 설치·세척·AS) 본진 정적 사이트. **외부 프로젝트와 자산·코드 혼입 금지.**

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

## 카피 작업 완료 조건 — dist 전수 grep (2026-08-14 강제 / 08-24 패턴 확장)

카피를 고칠 때는 **소스가 아니라 `dist/`를 grep한 결과로 통과를 판정한다.**
소스는 파일이 갈라져 있어 계속 샌다 — 같은 약속이 세 번 살아남았다:
FAQ 본문 "2년간 무상" → `faq.json`의 `chat_a` "1년에 1~2회" →
`Chatbot.astro`의 `as.when` + `config.js`의 `RESPONSE_NOTE` "1시간 안에".
dist는 최종 결과물이라 새지 않는다.

```bash
npm run build
# 사진 요구 — "보내"만 보면 샌다. 08-24 실측: "사진을 업체에 보내"·"사진을 공유"가 라이브에 생존.
# 선행 .{0,6}은 필수 — 없으면 grep -o가 "사진"부터 잘라내 뒤의 예외 필터가 헛돈다.
# 예외 필터는 우리 쪽 확정 약속(②작업 사진 전달) 제거용 — 없으면 12건이 전부 오탐이다.
grep -roE ".{0,6}사진을?[^.。]{0,12}(보내|공유|찍어|촬영|첨부|전달해)" dist/ | grep -v "작업 *사진을 *전달"
# 기간 약속
grep -roE "[0-9]+ ?(년|개월|일|시간|분|주) ?(이내|안에|내에)" dist/
# 금지어 — "보증"은 제조사 귀속만 허용
grep -roE "최고|완벽|정직|꼼꼼|보증|무상" dist/
# 내부 마커 — 초안 표기가 고객 화면에 나가면 안 된다
grep -ro "\[현장 데이터 필요\]" dist/
```

- **`dist/*.html`만 보면 안 된다.** 챗봇 COPY는 클라이언트 JS 번들
  (`dist/_astro/Chatbot.astro_*.js`)에 들어가 HTML에 안 나온다. `dist/` 전체를 훑을 것
- **정상 잔존 1건**: `/situation/newhome/`의 **제조사** 보증 언급 (자사 약속 아님).
  그 외 "보증"은 전부 위반
- 자사 이행 주장은 확정 3개만 — ①추가금 사전고지 ②작업 사진 전달 ③단일 연락 창구
- **고객에게 사진을 요구하는 문구 0.** 우리가 작업 사진을 남겨 드리는 문구는 유지(②)
