/**
 * 쇼핑몰 Footer Code 초안 검사 — docs/shop-login-bridge.md 의 코드를 그대로 꺼내 가짜 화면에서 여러 흐름으로 돌린다.
 *
 *   npm run test:shop   (링크·스크립트 검사 뒤에 같이 돈다)  또는  node scripts/check-shop-bridge.mjs
 *
 * 쇼핑몰은 비공개라 진짜 화면에서는 아직 못 돌려 본다. 그 전에 흐름의 논리(돌아오기·튕김 방지·주소 검증)만이라도 고정해 둔다.
 * 아임웹이 실제로 로그인 뒤 어디로 보내는지, 로그인 판별 요소가 무엇인지는 여기서 알 수 없다(문서의 '넣기 전에').
 */
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const doc = await readFile(fileURLToPath(new URL('../docs/shop-login-bridge.md', import.meta.url)), 'utf8');
const m = doc.match(/```html\n<script>\n([\s\S]*?)<\/script>\n```/);
assert.ok(m, '문서에서 Footer Code 블록을 못 찾았다');
const CODE = m[1];

const SHOP = 'https://shop.baramdaero.com';
const MIN = 60_000;

/** 같은 탭(sessionStorage 공유)에서 쇼핑몰 화면을 연달아 여는 가짜 브라우저 */
function tab({ storageThrows = false } = {}) {
  const store = new Map();
  const cookies = [];
  const sessionStorage = {
    getItem: (k) => { if (storageThrows) throw new Error('blocked'); return store.has(k) ? store.get(k) : null; },
    setItem: (k, v) => { if (storageThrows) throw new Error('blocked'); store.set(k, v); },
    removeItem: (k) => { if (storageThrows) throw new Error('blocked'); store.delete(k); },
  };
  return {
    store, cookies,
    /** 화면 하나를 연다. 돌려주는 값 = 쇼핑몰 코드가 보낸 곳(없으면 null) */
    visit({ path = '/', search = '', referrer = '', loggedIn = false, now = 0, framed = false }) {
      let redirected = null;
      const win = {};
      win.top = framed ? {} : win;
      win.self = win;
      const document = {
        referrer,
        set cookie(v) { cookies.push(v); },
        get cookie() { return ''; },
        // 로그인한 화면에는 로그아웃 링크가 있다(문서 '넣기 전에' 1번 — 실제 요소는 공개 뒤 확인)
        querySelector: (sel) => (loggedIn && sel === 'a[href*="logout"]' ? {} : null),
      };
      const location = { pathname: path, search, replace: (u) => { redirected = u; } };
      vm.runInNewContext(CODE, { window: win, document, location, sessionStorage, URL, Date: { now: () => now } });
      return redirected;
    },
  };
}

const MAIN_CARE = 'https://baramdaero.com/care/';
const stored = (t) => JSON.parse(t.store.get('bd_return') ?? 'null');

// 1. 보통 흐름 — 본 사이트 '로그인' → 로그인 화면(기억) → 로그인 뒤 쇼핑몰 아무 화면 → 눌렀던 화면으로
{
  const t = tab();
  assert.equal(t.visit({ path: '/login', referrer: 'https://baramdaero.com/cases/?q=봇들마을&r=성남시', now: 0 }), null);
  assert.equal(stored(t).u, 'https://baramdaero.com/cases/?r=%EC%84%B1%EB%82%A8%EC%8B%9C', '입력한 검색어 q 는 빼고 지역 r 은 남긴다');
  assert.ok(!stored(t).u.includes('q='), 'q 가 남아 있다');
  assert.equal(t.visit({ path: '/', referrer: `${SHOP}/login`, loggedIn: true, now: 2 * MIN }), 'https://baramdaero.com/cases/?r=%EC%84%B1%EB%82%A8%EC%8B%9C');
  assert.equal(t.store.size, 0, '쓰고 나면 지운다');
  assert.ok(t.cookies.some((c) => c.startsWith('bd_login=1; max-age=604800') && c.includes('domain=.baramdaero.com') && c.includes('Secure')), '로그인 표시 쿠키(.baramdaero.com, 7일, Secure)');
}
// 2. 비밀번호를 틀려 /login 이 다시 열려도(리퍼러가 /login) 기억이 남아 있다
{
  const t = tab();
  t.visit({ path: '/login', referrer: MAIN_CARE, now: 0 });
  t.visit({ path: '/login', referrer: `${SHOP}/login`, now: 1 * MIN });
  assert.equal(t.visit({ path: '/', referrer: `${SHOP}/login`, loggedIn: true, now: 2 * MIN }), MAIN_CARE);
}
// 3. 가입 화면을 거쳐도(경로가 /login 이 아니다) 가입을 마치면 돌아온다
{
  const t = tab();
  t.visit({ path: '/login', referrer: MAIN_CARE, now: 0 });
  t.visit({ path: '/shop_join', referrer: `${SHOP}/login`, now: 1 * MIN });
  assert.equal(t.visit({ path: '/', referrer: `${SHOP}/shop_join`, loggedIn: true, now: 4 * MIN }), MAIN_CARE);
}
// 4. 낡은 표시로 '마이페이지'를 눌러 아임웹이 /login?back_url=… 로 보낸 경우 — 기억하지 않고, 로그인 뒤에도 본 사이트로 튕기지 않는다
{
  const t = tab();
  assert.equal(t.visit({ path: '/login', search: '?back_url=Lw%3D%3D', referrer: 'https://baramdaero.com/', now: 0 }), null);
  assert.equal(t.store.size, 0, '쿼리가 있는 로그인은 기억하지 않는다');
  assert.equal(t.visit({ path: '/shop_mypage', referrer: `${SHOP}/login`, loggedIn: true, now: 1 * MIN }), null, '마이페이지로 가던 사람을 본 사이트로 보내면 안 된다');
}
// 5. 본 사이트에서 '로그인'을 누른 뒤 쇼핑몰 안을 돌아다니다 쇼핑몰의 로그인 버튼으로 시작한 로그인 — 옛 기억을 버린다
{
  const t = tab();
  t.visit({ path: '/login', referrer: MAIN_CARE, now: 0 });
  t.visit({ path: '/login', referrer: `${SHOP}/shop_view/?idx=1`, now: 3 * MIN });
  assert.equal(t.store.size, 0);
  assert.equal(t.visit({ path: '/', referrer: `${SHOP}/login`, loggedIn: true, now: 4 * MIN }), null, '쇼핑몰에서 시작한 로그인은 쇼핑몰에 머문다');
}
// 6. 보호된 화면(장바구니·구매)에서 시작한 로그인도 쇼핑몰에 머문다
{
  const t = tab();
  t.visit({ path: '/login', referrer: MAIN_CARE, now: 0 });
  t.visit({ path: '/login', search: '?back_url=L3Nob3BfY2FydA%3D%3D', referrer: `${SHOP}/shop_cart`, now: 1 * MIN });
  assert.equal(t.visit({ path: '/shop_cart', referrer: `${SHOP}/login`, loggedIn: true, now: 2 * MIN }), null);
}
// 7. 10분이 지난 기억은 쓰지 않고 지운다
{
  const t = tab();
  t.visit({ path: '/login', referrer: MAIN_CARE, now: 0 });
  assert.equal(t.visit({ path: '/', referrer: `${SHOP}/login`, loggedIn: true, now: 11 * MIN }), null);
  assert.equal(t.store.size, 0);
  const t2 = tab();
  t2.visit({ path: '/login', referrer: MAIN_CARE, now: 0 });
  assert.equal(t2.visit({ path: '/', loggedIn: true, now: 9 * MIN }), MAIN_CARE, '9분이면 아직 돌아온다');
}
// 8. 다른 주소로 보내는 통로가 되지 않는다 — 리퍼러·저장값 둘 다 검증한다
for (const evil of [
  'https://baramdaero.com.evil.example/x', 'https://baramdaero.com@evil.example/', 'http://baramdaero.com/care/',
  'https://evilbaramdaero.com/', 'https://shop.baramdaero.com/care/', 'javascript:alert(1)',
  'https://evil.example/?next=https://baramdaero.com/care/',   // 앞이 막히지 않으면 중간에 낀 본 사이트 주소에 걸린다
]) {
  const t = tab();
  t.visit({ path: '/login', referrer: evil, now: 0 });
  assert.equal(t.store.size, 0, `리퍼러 ${evil} 를 기억했다`);
  t.store.set('bd_return', JSON.stringify({ u: evil, t: 0 }));
  assert.equal(t.visit({ path: '/', loggedIn: true, now: 1 * MIN }), null, `저장값 ${evil} 로 보냈다`);
  assert.equal(t.store.size, 0, '못 쓰는 저장값은 지운다');
}
// 9. 깨진 저장값·저장소 차단(사생활 보호 모드)에서도 죽지 않는다
{
  const t = tab();
  t.store.set('bd_return', '{깨진');
  assert.equal(t.visit({ path: '/', loggedIn: true, now: 0 }), null);
  assert.equal(t.store.size, 0, '깨진 값을 지우지 않았다');
  const b = tab({ storageThrows: true });
  assert.equal(b.visit({ path: '/login', referrer: MAIN_CARE, now: 0 }), null);
  assert.equal(b.visit({ path: '/', loggedIn: true, now: 1 * MIN }), null);
  assert.ok(b.cookies.some((c) => c.startsWith('bd_login=1')), '저장소가 막혀도 로그인 표시는 켠다');
}
// 10. 로그아웃 상태면 표시를 끈다(속성이 켤 때와 같아야 지워진다)
{
  const t = tab();
  t.visit({ path: '/', loggedIn: false, now: 0 });
  assert.ok(t.cookies.some((c) => c.startsWith('bd_login=; max-age=0') && c.includes('domain=.baramdaero.com') && c.includes('path=/')), '로그인 표시 삭제');
  assert.ok(!t.cookies.some((c) => c.startsWith('bd_login=1')));
}
// 11. 틀(iframe) 안에서는 아무것도 하지 않는다 — 디자인 모드 편집 화면이 튕기면 안 된다
{
  const t = tab();
  t.store.set('bd_return', JSON.stringify({ u: MAIN_CARE, t: 0 }));
  assert.equal(t.visit({ path: '/', loggedIn: true, now: 1 * MIN, framed: true }), null);
  assert.equal(t.cookies.length, 0, '틀 안에서 쿠키를 건드렸다');
  assert.equal(t.store.size, 1, '틀 안에서 저장값을 건드렸다');
}
// 12. 기억 없이 로그인한 화면은 그대로 둔다
assert.equal(tab().visit({ path: '/shop_mypage', loggedIn: true, now: 0 }), null);

console.log('shop bridge: 쇼핑몰 Footer Code 초안 — 12개 흐름 통과');
