# 검색 열기 — 출시 날 순서

출시 전에는 검색엔진에 아무것도 알리지 않는다(2026-10-12 결정). 색인 요청은 사업을 시작하는 날 한꺼번에 한다.

## 지금 상태 (출시 전)
- `src/config.js` `SEARCH_OPEN: false` — 배포 뒤 바뀐 페이지를 IndexNow(Bing·Naver·Yandex)로 보내지 않는다.
- 네이버 서치어드바이저·구글 서치 콘솔·빙 웹마스터에 사이트맵을 제출하지 않는다. `NAVER_SITE_VERIFICATION` 은 빈 값.
- 사이트맵(`/sitemap-index.xml`)·`robots.txt`·`llms.txt`·구조화 데이터는 배포할 때마다 자동으로 만들어진다 — 출시 날 손댈 것이 없다.

## 출시 날
1. `src/config.js`
   - `SEARCH_OPEN: true`
   - `NAVER_SITE_VERIFICATION` 에 네이버 서치어드바이저의 HTML 태그 값
   - 문의 채널·연락처 값이 최종인지 확인(`KAKAO_CHANNEL_URL`, `PHONE`, `SHOP_URL`)
2. 배포한다.
3. 네이버 서치어드바이저: 소유 확인 → 사이트맵 `https://baramdaero.com/sitemap-index.xml` 제출.
4. 구글 서치 콘솔: 사이트맵 제출(도메인 속성은 인증돼 있다).
5. 빙 웹마스터: 구글 서치 콘솔에서 가져오기로 등록 → 사이트맵 제출.
6. 전체 주소를 IndexNow 로 한 번 보낸다.
   ```bash
   node scripts/indexnow.mjs --all --dry   # 보낼 개수 확인
   node scripts/indexnow.mjs --all
   ```
7. 홈·`/cases/`·`/install/`·`/care/`·`/faq/` 는 각 도구의 URL 검사에서 색인 요청을 한 번씩 누른다.

## 그 뒤
- 배포할 때마다 바뀐 페이지만 자동으로 IndexNow 로 간다(`.github/workflows/deploy.yml` 의 indexnow 작업).
- 1주·2주 뒤 색인 수를 확인한다(네이버 `site:baramdaero.com`, 구글 서치 콘솔 '페이지').
