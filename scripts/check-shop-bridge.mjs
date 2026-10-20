/**
 * 쇼핑몰 Footer Code 검사 — docs/shop-login-bridge.md 의 코드를 그대로 꺼내 가짜 화면에서 여러 흐름으로 돌린다.
 *
 *   npm run test:shop   (링크·스크립트 검사 뒤에 같이 돈다)  또는  node scripts/check-shop-bridge.mjs
 *
 * 쇼핑몰 코드의 논리(로그인 판별·저장·돌아오기·튕김 방지·주소 검증)를 여기서 고정해 둔다. 2026-10-20 로그아웃·로그인 두 상태의 실제 화면에서
 * 같은 동작을 확인했다(문서의 '확인한 것'). 실제 비밀번호 로그인·가입, 일반 회원 계정의 MEMBER_UID 값, 소셜 로그인(카카오·네이버 등)이
 * 팝업인지 화면 이동인지는 여기서 알 수 없다 — 소셜 로그인은 두 방식 모두를 가정해 돌려 본다.
 * 가짜 화면은 실제와 같게 만든다: 로그아웃 화면에도 숨은 로그아웃 링크가 있고, 로그인 여부는 window.MEMBER_UID(로그아웃은 빈 문자열)로만 드러난다.
 * 문서에 적힌 코드의 SHA-256 이 블록과 같은지도 본다(코드를 고쳤는데 쇼핑몰에 넣은 것과의 대조값을 안 고치는 일을 막는다).
 */
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const doc = await readFile(fileURLToPath(new URL('../docs/shop-login-bridge.md', import.meta.url)), 'utf8');
const m = doc.match(/```html\n<script>\n([\s\S]*?)<\/script>\n```/);
assert.ok(m, '문서에서 Footer Code 블록을 못 찾았다');
const CODE = m[1];
{
  // '아래 블록은 v2**(2252자, SHA-256 `…`)' 한 줄 — 쇼핑몰에 들어 있는 이전 버전(v1)의 해시와 헷갈리지 않게 이 줄만 본다
  const stated = doc.match(/아래 블록은 v\d+(?:\.\d+)?\*\*\((\d+)자, SHA-256 `([0-9a-f]{64})`\)/);
  assert.ok(stated, "문서에 '아래 블록은 vN**(길이자, SHA-256 `…`)' 줄이 없다");
  const block = `<script>\n${CODE}</script>`;
  assert.equal(block.length, Number(stated[1]), '문서에 적힌 길이가 코드 블록과 다르다 — 코드를 고쳤으면 해시와 길이를 다시 적는다');
  assert.equal(createHash('sha256').update(block).digest('hex'), stated[2], '문서에 적힌 SHA-256 이 코드 블록과 다르다 — 코드를 고쳤으면 해시와 길이를 다시 적는다');
}

const SHOP = 'https://shop.baramdaero.com';
const MIN = 60_000;
const T0 = Date.UTC(2026, 9, 19);   // 가짜 시계의 0 — 실제 시각처럼 큰 값이어야 '시각 0 으로 저장' 같은 퇴행이 낡은 값으로 잡힌다

const COOKIE_ON = 'bd_login=1; max-age=604800; domain=.baramdaero.com; path=/; SameSite=Lax; Secure';
const COOKIE_OFF = 'bd_login=; max-age=0; domain=.baramdaero.com; path=/; SameSite=Lax; Secure';

/** 한 브라우저 — 저장소는 탭이 달라도 같다(localStorage). 탭마다 화면을 열 수 있다 */
function browser({ storageThrows = false, writeThrows = false } = {}) {
  const store = new Map();
  const cookies = [];
  const localStorage = {
    getItem: (k) => { if (storageThrows) throw new Error('blocked'); return store.has(k) ? store.get(k) : null; },
    setItem: (k, v) => { if (storageThrows || writeThrows) throw new Error('blocked'); store.set(k, v); },
    removeItem: (k) => { if (storageThrows) throw new Error('blocked'); store.delete(k); },
  };
  return {
    store, cookies,
    /** 화면 하나를 연다(어느 탭이든). 돌려주는 값 = 쇼핑몰 코드가 보낸 곳(없으면 null) */
    /** uid: 'auto' 면 로그인 여부에 맞춰(로그인 'm…', 로그아웃 ''), 'none' 이면 변수가 없는 화면, 그 밖의 값은 그대로.
     *  lateUid: 코드가 처음 돌 때는 변수가 없고 load 때 생기는 경우의 값('none' 이면 load 가 와도 끝내 없다) */
    visit({ path = '/', search = '', referrer = '', loggedIn = false, now = 0, framed = false, popup = false, uid = 'auto', lateUid } = {}) {
      let redirected = null;
      const listeners = {};
      const win = { opener: popup ? {} : null, addEventListener: (type, fn) => { (listeners[type] ??= []).push(fn); } };
      win.top = framed ? {} : win;
      win.self = win;
      if (uid === 'auto') win.MEMBER_UID = loggedIn ? 'm20261019abcdef1234567' : '';
      else if (uid !== 'none') win.MEMBER_UID = uid;
      const document = {
        referrer,
        set cookie(v) { cookies.push(v); },
        get cookie() { return ''; },
        // 로그아웃 화면에도 숨은 로그아웃 링크가 있다(알림 패널, 2026-10-20 실제 공개 화면) — 이 링크로 로그인을 판단하면 안 된다
        querySelector: (sel) => (sel === 'a[href*="logout"]' ? {} : null),
      };
      const location = { pathname: path, search, origin: SHOP, replace: (u) => { redirected = u; } };
      vm.runInNewContext(CODE, { window: win, document, location, localStorage, URL, Date: { now: () => T0 + now } });
      if (lateUid !== undefined && listeners.load) { if (lateUid !== 'none') win.MEMBER_UID = lateUid; listeners.load.forEach((fn) => fn()); }
      return redirected;
    },
  };
}

const MAIN_CARE = 'https://baramdaero.com/care/';
const stored = (b) => JSON.parse(b.store.get('bd_return') ?? 'null');
const put = (b, u, t = T0) => b.store.set('bd_return', JSON.stringify({ u, t }));

// 1. 보통 흐름 — 본 사이트 '로그인' → 로그인 화면(기억) → 로그인 뒤 쇼핑몰 아무 화면 → 눌렀던 화면으로
{
  const t = browser();
  assert.equal(t.visit({ path: '/login', referrer: 'https://baramdaero.com/cases/?q=봇들마을&r=성남시', now: 0 }), null);
  assert.equal(stored(t).u, 'https://baramdaero.com/cases/?r=%EC%84%B1%EB%82%A8%EC%8B%9C', '입력한 검색어 q 는 빼고 지역 r 은 남긴다');
  assert.ok(!stored(t).u.includes('q='), 'q 가 남아 있다');
  assert.equal(stored(t).t, T0, '저장 시각이 지금이 아니다');
  assert.equal(t.visit({ path: '/', referrer: `${SHOP}/login`, loggedIn: true, now: 2 * MIN }), 'https://baramdaero.com/cases/?r=%EC%84%B1%EB%82%A8%EC%8B%9C');
  assert.equal(t.store.size, 0, '쓰고 나면 지운다');
  assert.ok(t.cookies.includes(COOKIE_ON), '로그인 표시 쿠키(.baramdaero.com, 7일, Secure, SameSite=Lax)');
}
// 2. 비밀번호를 틀려 /login 이 다시 열려도(리퍼러가 /login) 기억이 남아 있다
{
  const t = browser();
  t.visit({ path: '/login', referrer: MAIN_CARE, now: 0 });
  t.visit({ path: '/login', referrer: `${SHOP}/login`, now: 1 * MIN });
  assert.equal(t.visit({ path: '/', referrer: `${SHOP}/login`, loggedIn: true, now: 2 * MIN }), MAIN_CARE);
}
// 3. 가입 화면을 거쳐도(리퍼러가 로그인·가입 흐름 안) 가입을 마치면 돌아온다
{
  const t = browser();
  t.visit({ path: '/login', referrer: MAIN_CARE, now: 0 });
  t.visit({ path: '/shop_join', referrer: `${SHOP}/login`, now: 1 * MIN });
  t.visit({ path: '/shop_join_agree', referrer: `${SHOP}/shop_join`, now: 2 * MIN });
  assert.equal(t.visit({ path: '/', referrer: `${SHOP}/shop_join_agree`, loggedIn: true, now: 4 * MIN }), MAIN_CARE);
}
// 4. 낡은 표시로 '마이페이지'를 눌러 아임웹이 /login?back_url=… 로 보낸 경우 — 기억하지 않고, 앞서 남은 기억도 버려 로그인 뒤 본 사이트로 튕기지 않는다
{
  const t = browser();
  assert.equal(t.visit({ path: '/login', search: '?back_url=Lw%3D%3D', referrer: 'https://baramdaero.com/', now: 0 }), null);
  assert.equal(t.store.size, 0, '쿼리가 있는 로그인은 기억하지 않는다');
  assert.equal(t.visit({ path: '/shop_mypage', referrer: `${SHOP}/login`, loggedIn: true, now: 1 * MIN }), null, '마이페이지로 가던 사람을 본 사이트로 보내면 안 된다');
  const t2 = browser();
  t2.visit({ path: '/login', referrer: MAIN_CARE, now: 0 });
  t2.visit({ path: '/login', search: '?back_url=Lw%3D%3D', referrer: 'https://baramdaero.com/faq/', now: 1 * MIN });
  assert.equal(t2.store.size, 0, '본 사이트에서 보호된 화면으로 갔다가 넘어온 로그인은 앞의 기억을 버린다');
}
// 5. 본 사이트에서 '로그인'을 누른 뒤 쇼핑몰 안을 돌아다니다 쇼핑몰의 로그인 버튼으로 시작한 로그인 — 옛 기억을 버린다
{
  const t = browser();
  t.visit({ path: '/login', referrer: MAIN_CARE, now: 0 });
  t.visit({ path: '/login', referrer: `${SHOP}/shop_view/?idx=1`, now: 3 * MIN });
  assert.equal(t.store.size, 0);
  assert.equal(t.visit({ path: '/', referrer: `${SHOP}/login`, loggedIn: true, now: 4 * MIN }), null, '쇼핑몰에서 시작한 로그인은 쇼핑몰에 머문다');
}
// 6. 보호된 화면(장바구니·구매)에서 시작한 로그인도 쇼핑몰에 머문다
{
  const t = browser();
  t.visit({ path: '/login', referrer: MAIN_CARE, now: 0 });
  t.visit({ path: '/login', search: '?back_url=L3Nob3BfY2FydA%3D%3D', referrer: `${SHOP}/shop_cart`, now: 1 * MIN });
  assert.equal(t.visit({ path: '/shop_cart', referrer: `${SHOP}/login`, loggedIn: true, now: 2 * MIN }), null);
}
// 7. 10분이 지난 기억은 쓰지 않고 지운다 — 경계 9분 59초는 돌아오고 10분은 안 돌아온다
{
  const t = browser();
  t.visit({ path: '/login', referrer: MAIN_CARE, now: 0 });
  assert.equal(t.visit({ path: '/', referrer: `${SHOP}/login`, loggedIn: true, now: 11 * MIN }), null);
  assert.equal(t.store.size, 0);
  const t2 = browser();
  t2.visit({ path: '/login', referrer: MAIN_CARE, now: 0 });
  assert.equal(t2.visit({ path: '/', loggedIn: true, now: 10 * MIN - 1000 }), MAIN_CARE, '9분 59초면 아직 돌아온다');
  const t3 = browser();
  t3.visit({ path: '/login', referrer: MAIN_CARE, now: 0 });
  assert.equal(t3.visit({ path: '/', loggedIn: true, now: 10 * MIN }), null, '10분이면 안 돌아온다');
  const t4 = browser();
  t4.visit({ path: '/login', referrer: MAIN_CARE, now: 0 });
  t4.visit({ path: '/shop_cart', now: 20 * MIN });
  assert.equal(t4.store.size, 0, '로그인하지 않은 채 낡은 기억은 다음 화면에서 지운다');
}
// 8. 다른 주소로 보내는 통로가 되지 않는다 — 리퍼러·저장값 둘 다 검증한다
for (const evil of [
  'https://baramdaero.com.evil.example/x', 'https://baramdaero.com@evil.example/', 'http://baramdaero.com/care/',
  'https://evilbaramdaero.com/', 'https://shop.baramdaero.com/care/', 'javascript:alert(1)',
  'https://evil.example/?next=https://baramdaero.com/care/',   // 앞이 막히지 않으면 중간에 낀 본 사이트 주소에 걸린다
]) {
  const t = browser();
  t.visit({ path: '/login', referrer: evil, now: 0 });
  assert.equal(t.store.size, 0, `리퍼러 ${evil} 를 기억했다`);
  put(t, evil);
  assert.equal(t.visit({ path: '/', loggedIn: true, now: 1 * MIN }), null, `저장값 ${evil} 로 보냈다`);
  assert.equal(t.store.size, 0, '못 쓰는 저장값은 지운다');
}
// 9. 깨진·엉뚱한 저장값·저장소 차단(사생활 보호 모드)에서도 죽지 않고 보내지 않는다
{
  const t = browser();
  t.store.set('bd_return', '{깨진');
  assert.equal(t.visit({ path: '/', loggedIn: true, now: 0 }), null);
  assert.equal(t.store.size, 0, '깨진 값을 지우지 않았다');
  for (const [label, value] of [
    ['미래 시각', { u: MAIN_CARE, t: T0 + 24 * 60 * MIN }], ['주소가 배열', { u: [MAIN_CARE], t: T0 }], ['주소가 객체', { u: { toString: () => MAIN_CARE }, t: T0 }],
    ['시각이 없음', { u: MAIN_CARE }], ['null', null],
  ]) {
    const x = browser();
    x.store.set('bd_return', JSON.stringify(value));
    assert.equal(x.visit({ path: '/', loggedIn: true, now: 1 * MIN }), null, `${label} 저장값으로 보냈다`);
    assert.equal(x.store.size, 0, `${label} 저장값을 지우지 않았다`);
  }
  const b = browser({ storageThrows: true });
  assert.equal(b.visit({ path: '/login', referrer: MAIN_CARE, now: 0 }), null);
  assert.equal(b.visit({ path: '/', loggedIn: true, now: 1 * MIN }), null);
  assert.ok(b.cookies.includes(COOKIE_ON), '저장소가 막혀도 로그인 표시는 켠다');
  // 저장소가 가득 차 쓰기만 실패해도 옛 기억이 남아 엉뚱한 곳으로 가지 않는다
  const w = browser({ writeThrows: true });
  put(w, 'https://baramdaero.com/faq/');
  w.visit({ path: '/login', referrer: MAIN_CARE, now: 1 * MIN });
  assert.equal(w.store.size, 0, '쓰기가 실패했는데 옛 기억이 남았다');
  assert.equal(w.visit({ path: '/', loggedIn: true, now: 2 * MIN }), null);
}
// 10. 로그아웃 상태면 표시를 끈다(속성이 켤 때와 같아야 지워진다)
{
  const t = browser();
  t.visit({ path: '/', loggedIn: false, now: 0 });
  assert.ok(t.cookies.includes(COOKIE_OFF), '로그인 표시 삭제(켤 때와 같은 도메인·경로·속성)');
  assert.ok(!t.cookies.some((c) => c.startsWith('bd_login=1')));
}
// 11. 틀(iframe) 안에서는 아무것도 하지 않는다 — 디자인 모드 편집 화면이 튕기면 안 된다
{
  const t = browser();
  put(t, MAIN_CARE);
  assert.equal(t.visit({ path: '/', loggedIn: true, now: 1 * MIN, framed: true }), null);
  assert.equal(t.cookies.length, 0, '틀 안에서 쿠키를 건드렸다');
  assert.equal(t.store.size, 1, '틀 안에서 저장값을 건드렸다');
}
// 12. 기억 없이 로그인한 화면은 그대로 둔다
assert.equal(browser().visit({ path: '/shop_mypage', loggedIn: true, now: 0 }), null);
// 13. www 주소도 본 사이트다 — 저장하고 돌아온다
{
  const t = browser();
  t.visit({ path: '/login', referrer: 'https://www.baramdaero.com/care/', now: 0 });
  assert.equal(t.visit({ path: '/', loggedIn: true, now: 1 * MIN }), 'https://www.baramdaero.com/care/');
}

// ── 쇼핑몰 안을 돌아다니다 로그인·가입한 경우는 튕기지 않는다 ──
// 14. 로그인 화면에서 쇼핑몰 홈으로 갔다가 가입 링크로 가입(리퍼러가 쇼핑몰 홈) — 돌아가지 않는다
{
  const t = browser();
  t.visit({ path: '/login', referrer: MAIN_CARE, now: 0 });
  t.visit({ path: '/', referrer: `${SHOP}/login`, now: 1 * MIN });   // 로그인 화면에서 곧바로 나온 화면은 아직 흐름 안이다
  t.visit({ path: '/shop_join', referrer: `${SHOP}/`, now: 3 * MIN });
  assert.equal(t.store.size, 0, '돌아다니다 시작한 가입이 기억을 버리지 않았다');
  assert.equal(t.visit({ path: '/', referrer: `${SHOP}/shop_join`, loggedIn: true, now: 5 * MIN }), null);
}
// 15. 상품 화면에서 로그인 화면을 거치지 않고(모달 등) 로그인 — 돌아가지 않는다
{
  const t = browser();
  t.visit({ path: '/login', referrer: MAIN_CARE, now: 0 });
  t.visit({ path: '/shop_view', referrer: `${SHOP}/`, now: 2 * MIN });
  assert.equal(t.store.size, 0);
  assert.equal(t.visit({ path: '/shop_view', referrer: `${SHOP}/shop_view`, loggedIn: true, now: 3 * MIN }), null);
}
// 16. 리퍼러 없이 /login 에 들어온 경우(주소 입력·북마크, 또는 리퍼러를 막은 브라우저) — 취소·앱 전환 뒤일 수 있어 기억을 지우지 않는다(10분 한계, 문서에 적음)
{
  const t = browser();
  t.visit({ path: '/login', referrer: MAIN_CARE, now: 0 });
  t.visit({ path: '/login', referrer: '', now: 5 * MIN });
  assert.ok(stored(t));
  assert.equal(t.visit({ path: '/', loggedIn: true, now: 6 * MIN }), MAIN_CARE);
}

// ── 소셜 로그인(카카오톡·네이버 등) — 팝업이든 화면 이동이든 돌아오고, 취소해도 기억이 남는다 ──
// 17. 화면 이동 방식: /login(기억) → 제공자 화면 → 쇼핑몰 /oauth 콜백(아직 로그인 전, 리퍼러가 제공자) → 로그인된 화면에서 돌아온다
{
  const t = browser();
  t.visit({ path: '/login', referrer: MAIN_CARE, now: 0 });
  assert.equal(t.visit({ path: '/oauth', search: '?code=abc&state=xyz', referrer: 'https://kauth.kakao.com/', now: 1 * MIN }), null);
  assert.ok(stored(t), '콜백 화면(/oauth)은 기억을 건드리지 않는다');
  assert.equal(t.visit({ path: '/', referrer: `${SHOP}/oauth`, loggedIn: true, now: 2 * MIN }), MAIN_CARE);
  assert.equal(t.store.size, 0);
}
// 18. 제공자 화면에서 취소하고 /login 으로 돌아와도 기억이 남는다 — 제공자가 바로 돌려보내든(리퍼러가 제공자), 쇼핑몰 콜백을 거쳐 보내든(리퍼러가 /oauth), 리퍼러가 막혔든
for (const [search, referrer] of [
  ['', 'https://kauth.kakao.com/'], ['?error=access_denied', 'https://nid.naver.com/'], ['', ''],
  ['', `${SHOP}/oauth`], ['?error=access_denied', `${SHOP}/oauth?error=access_denied&state=x`], ['', `${SHOP}/login/oauth/kakao`],
]) {
  const t = browser();
  t.visit({ path: '/login', referrer: MAIN_CARE, now: 0 });
  t.visit({ path: '/login', search, referrer, now: 1 * MIN });
  assert.ok(stored(t), `취소 뒤 돌아온 /login(${search || '쿼리 없음'}, 리퍼러 ${referrer || '없음'})에서 기억을 버렸다`);
  assert.equal(t.visit({ path: '/', loggedIn: true, now: 3 * MIN }), MAIN_CARE, '다시 로그인하면 돌아온다');
}
// 19. 새 탭·앱 전환으로 같은 브라우저에서 돌아와도(저장소가 탭마다 따로가 아니다) 돌아온다
{
  const t = browser();
  t.visit({ path: '/login', referrer: MAIN_CARE, now: 0 });
  // 다른 탭에서 로그인이 끝난 쇼핑몰 화면이 열린다
  assert.equal(t.visit({ path: '/', referrer: '', loggedIn: true, now: 2 * MIN }), MAIN_CARE);
}
// 20. 팝업(소셜 로그인 창)에서는 아무것도 하지 않는다 — 팝업이 본 사이트로 튕기면 안 되고, 원래 창이 새로고침되면 거기서 돌아온다
{
  const t = browser();
  t.visit({ path: '/login', referrer: MAIN_CARE, now: 0 });
  assert.equal(t.visit({ path: '/oauth', search: '?code=abc', referrer: 'https://kauth.kakao.com/', loggedIn: true, now: 1 * MIN, popup: true }), null, '팝업이 본 사이트로 튕겼다');
  assert.ok(stored(t), '팝업이 기억을 건드렸다');
  assert.ok(!t.cookies.includes(COOKIE_ON), '팝업이 로그인 표시를 건드렸다');
  assert.equal(t.visit({ path: '/login', referrer: `${SHOP}/login`, loggedIn: true, now: 2 * MIN }), MAIN_CARE, '원래 창(로그인 뒤 새로고침)에서 돌아온다');
}
// 21. 소셜 로그인으로 처음 가입하는 경우 — 추가 정보 화면을 거쳐도(리퍼러가 콜백·가입 흐름 안) 가입을 마치면 돌아온다
{
  const t = browser();
  t.visit({ path: '/login', referrer: MAIN_CARE, now: 0 });
  t.visit({ path: '/oauth', search: '?code=abc', referrer: 'https://nid.naver.com/', now: 1 * MIN });
  t.visit({ path: '/shop_join', referrer: `${SHOP}/oauth`, now: 3 * MIN });
  assert.equal(t.visit({ path: '/', referrer: `${SHOP}/shop_join`, loggedIn: true, now: 6 * MIN }), MAIN_CARE);
}

// ── 로그인 판별 — 2026-10-20 쇼핑몰이 공개된 것을 보고 로그아웃 상태를 확인했더니, 로그아웃 화면에도 숨은 로그아웃 링크가 1개 있어
//    링크로 판단하던 v1·v2 가 방문자 모두를 로그인으로 오판했다(본 사이트에 '마이페이지'가 뜸). 로그인 여부는 window.MEMBER_UID 로 본다 ──
// 22. 로그아웃 방문자는 로그인으로 오판하지 않는다 — 로그인 표시를 켜지 않고 끄며, 복귀 주소로 보내지 않는다
{
  const t = browser();
  assert.equal(t.visit({ path: '/', loggedIn: false, now: 0 }), null);
  assert.ok(t.cookies.includes(COOKIE_OFF), '로그아웃 화면에서 로그인 표시를 끄지 않았다');
  assert.ok(!t.cookies.some((c) => c.startsWith('bd_login=1')), '로그아웃 방문자에게 로그인 표시를 켰다');
  t.visit({ path: '/login', referrer: MAIN_CARE, now: 1 * MIN });
  assert.ok(stored(t), '로그아웃 화면 /login 에서 복귀 주소를 못 저장했다');
  assert.equal(t.visit({ path: '/', loggedIn: false, referrer: `${SHOP}/login`, now: 2 * MIN }), null, '로그아웃 방문자를 본 사이트로 보냈다');
}
// 23. 변수가 아직 없으면 load 에서 다시 본다(로그인 변수가 늦게 생기는 경우)
{
  const t = browser();
  put(t, MAIN_CARE);
  assert.equal(t.visit({ now: 1 * MIN, uid: 'none', lateUid: 'm20261019abcdef1234567' }), MAIN_CARE, '늦게 생긴 로그인 변수를 load 에서 못 봤다');
  assert.ok(t.cookies.includes(COOKIE_ON));
  const o = browser();
  o.visit({ now: 0, uid: 'none', lateUid: '' });
  assert.ok(o.cookies.includes(COOKIE_OFF), '늦게 생긴 빈 변수(로그아웃)를 load 에서 못 봤다');
}
// 24. 로그인 상태를 알 수 없으면(변수가 끝내 없거나 문자열이 아니다) 쿠키·저장값·이동 어느 것도 건드리지 않는다
for (const bad of ['none', null, 0, 12345, {}, ['x']]) {
  const t = browser();
  put(t, MAIN_CARE);
  const label = bad === 'none' ? '변수 없음' : JSON.stringify(bad);
  assert.equal(t.visit({ now: 1 * MIN, uid: bad, lateUid: 'none' }), null, `상태를 모르는데(${label}) 보냈다`);
  assert.equal(t.cookies.length, 0, `상태를 모르는데(${label}) 쿠키를 건드렸다`);
  assert.equal(t.store.size, 1, `상태를 모르는데(${label}) 저장값을 건드렸다`);
}

console.log('shop bridge: 쇼핑몰 Footer Code — 24개 흐름 통과(돌아다니기 3개·소셜 로그인 5개·로그인 판별 3개 포함), 문서 해시 일치');
