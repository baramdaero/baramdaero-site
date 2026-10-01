// 배포 후 '이번에 바뀐 페이지'만 IndexNow 로 알린다 — Bing(ChatGPT 검색)·Naver·Yandex 가 받는다.
// IndexNow 문서: 바뀌지 않은 주소를 다시 보내지 말 것. api.indexnow.org 한 곳에 보내면 참여 엔진(네이버 포함)에 공유된다.
// 바뀐 파일 목록은 CHANGED(줄바꿈 구분, deploy.yml 이 git diff 로 넘김) → 주소로 바꾸고, 사이트맵에 있는 것(공개된 것)만 보낸다.
// 키 파일은 public/<KEY>.txt (공개가 정상 — IndexNow 는 그 파일로 사이트 소유를 확인한다).
// 사용: CHANGED="$(git diff --name-only A B)" node scripts/indexnow.mjs [--dry]   |   node scripts/indexnow.mjs --selfcheck
import assert from 'node:assert/strict';

const KEY = 'd908e0d13ce71309fe5c2e1238b5b70e';
const HOST = 'baramdaero.com';

/** 바뀐 파일 → 그 파일이 내용을 정하는 페이지 경로. 레이아웃·컴포넌트처럼 모든 쪽에 걸치는 변경은 '내용 변경'이 아니라 보내지 않는다 */
export function pathsFor(files) {
  const out = new Set();
  const SITE_JSON = { 'home.json': ['/'], 'brands.json': ['/'], 'faq.json': ['/faq/'], 'pricing.json': ['/price/', '/care/'], 'standards.json': ['/price/', '/install/', '/care/'] };
  for (const f of files) {
    let m;
    if ((m = f.match(/^src\/content\/cases\/([^/]+)\.md$/))) out.add(`/cases/${m[1]}/`).add('/cases/');
    else if ((m = f.match(/^src\/content\/blog\/([^/]+)\.md$/))) out.add(`/blog/${m[1]}/`).add('/blog/');
    else if ((m = f.match(/^src\/content\/site\/([^/]+\.json)$/)) && SITE_JSON[m[1]]) SITE_JSON[m[1]].forEach((p) => out.add(p));
    else if (f === 'src/pages/index.astro') out.add('/');
    else if ((m = f.match(/^src\/pages\/([a-z-]+)\/index\.astro$/))) out.add(`/${m[1]}/`);
  }
  return [...out];
}

if (process.argv.includes('--selfcheck')) {
  assert.deepEqual(pathsFor(['src/content/cases/2026-09-21-경기김포-아파트-설치.md']).sort(), ['/cases/', '/cases/2026-09-21-경기김포-아파트-설치/'].sort());
  assert.deepEqual(pathsFor(['src/content/site/home.json', 'src/pages/index.astro']), ['/']);
  assert.deepEqual(pathsFor(['src/components/v2/Hero3D.astro', 'DESIGN.md']), [], '모든 쪽에 걸치는 변경은 보내지 않는다');
  assert.deepEqual(pathsFor(['src/pages/cases/index.astro']), ['/cases/']);
  console.log('indexnow selfcheck: 4/4 passed');
} else {
  const files = (process.env.CHANGED ?? '').split('\n').map((s) => s.trim()).filter(Boolean);
  const want = pathsFor(files);
  if (!want.length) { console.log('바뀐 페이지 없음 — 보내지 않음'); process.exit(0); }
  // 사이트맵에 있는 주소만(초안·삭제된 쪽은 없다)
  const get = async (url) => (await fetch(url)).text();
  const locs = (xml) => [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  const index = await get(`https://${HOST}/sitemap-index.xml`);
  const live = new Map((await Promise.all(locs(index).map(get))).flatMap(locs).map((u) => [decodeURI(new URL(u).pathname), u]));
  const urls = want.map((p) => live.get(p)).filter(Boolean);
  if (!urls.length) { console.log('공개된 페이지 변경 없음 — 보내지 않음'); process.exit(0); }
  if (process.argv.includes('--dry')) { console.log('[dry] 보낼 주소', urls.map((u) => decodeURI(new URL(u).pathname))); process.exit(0); }
  const res = await fetch('https://api.indexnow.org/indexnow', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ host: HOST, key: KEY, keyLocation: `https://${HOST}/${KEY}.txt`, urlList: urls }),
  });
  console.log('api.indexnow.org', res.status, `${urls.length}개`, urls.map((u) => decodeURI(new URL(u).pathname)).join(' '));
}
