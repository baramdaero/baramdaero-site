// 배포 후 sitemap 의 모든 주소를 IndexNow 로 알린다 — Bing(ChatGPT 검색)·Naver·Yandex 가 받는다.
// 키 파일은 public/<KEY>.txt (공개가 정상 — IndexNow 는 그 파일로 사이트 소유를 확인한다).
const KEY = 'd908e0d13ce71309fe5c2e1238b5b70e';
const HOST = 'baramdaero.com';
const get = async (url) => (await fetch(url)).text();
const locs = (xml) => [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);

const index = await get(`https://${HOST}/sitemap-index.xml`);
const urls = (await Promise.all(locs(index).map(get))).flatMap(locs);
if (!urls.length) throw new Error('sitemap 에 주소가 없습니다');

for (const endpoint of ['https://api.indexnow.org/indexnow', 'https://searchadvisor.naver.com/indexnow']) {
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ host: HOST, key: KEY, keyLocation: `https://${HOST}/${KEY}.txt`, urlList: urls }),
  });
  console.log(endpoint, res.status, `${urls.length}개`);
}
