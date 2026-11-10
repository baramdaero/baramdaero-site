/**
 * 로그인 표시 스크립트 검사 — src/scripts/shop-session.js 를 가짜 document 안에서 돌린다.
 *
 *   npm run test:shop   (링크 검사 뒤에 같이 돈다)  또는  node scripts/check-shop-session.mjs
 *
 * 보는 것: 쿠키 bd_login=1 이 있을 때만 <html> 에 bd-member 가 붙고, 뒤로 가기·탭 복귀 때 다시 읽으며,
 * 이 사이트는 쿠키를 쓰지 않는다(개인정보 처리방침 §8 '이 사이트는 쿠키를 직접 저장하지 않습니다'와 맞춘다).
 * 또 '로그인'(referrerpolicy="unsafe-url" 링크)을 누르는 순간 주소에서 검색어 q 를 뺀다 — 리퍼러로 쇼핑몰에 새지 않게.
 */
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const SRC = await readFile(fileURLToPath(new URL('../src/scripts/shop-session.js', import.meta.url)), 'utf8');

/** 쿠키 상자와 이벤트가 있는 가짜 화면 하나를 만들어 스크립트를 돌린다 */
function page(cookie = '', href = 'https://baramdaero.com/') {
  const classes = new Set();
  const on = {};
  const written = [];
  const replaced = [];
  let jar = cookie;
  const document = {
    get cookie() { return jar; },
    set cookie(v) { written.push(v); },
    documentElement: { classList: { toggle: (c, force) => (force ? classes.add(c) : classes.delete(c)) } },
    addEventListener: (type, fn, capture) => { (on[`doc:${type}`] ??= []).push(fn); (on[`doc:${type}:capture`] ??= []).push(capture === true); },
  };
  const window = { addEventListener: (type, fn) => { (on[`win:${type}`] ??= []).push(fn); } };
  const location = { href };
  const history = { state: { keep: 1 }, replaceState: (state, _title, url) => { replaced.push({ state, url: String(url) }); location.href = String(url); } };
  vm.runInNewContext(SRC, { document, window, location, history, URL });
  return {
    member: () => classes.has('bd-member'),
    setCookie: (v) => { jar = v; },
    fire: (key) => (on[key] ?? []).forEach((fn) => fn({})),
    written,
    replaced,
    /** 누른 곳(target)에서 type 이벤트를 일으킨다. closest 는 login 이면 로그인 링크를, 아니면 null 을 돌려준다 */
    press: (type, login = true) => (on[`doc:${type}`] ?? []).forEach((fn) =>
      fn({ target: { closest: (sel) => (login && sel === 'a[referrerpolicy="unsafe-url"]' ? {} : null) } })),
    captured: (type) => (on[`doc:${type}:capture`] ?? []).every(Boolean) && (on[`doc:${type}`] ?? []).length > 0,
    href: () => location.href,
  };
}

assert.equal(page().member(), false, '쿠키 없으면 방문자');
assert.equal(page('bd_login=1').member(), true, 'bd_login=1 이면 회원');
assert.equal(page('a=1; bd_login=1; b=2').member(), true, '다른 쿠키 사이에서도 읽는다');
assert.equal(page('xbd_login=1').member(), false, '이름이 비슷한 쿠키는 아니다');
assert.equal(page('bd_login=10').member(), false, '값이 1 이 아니면 아니다');
assert.equal(page('bd_login=0').member(), false, '꺼진 표시');
{
  const p = page();
  p.setCookie('bd_login=1'); p.fire('win:pageshow');
  assert.equal(p.member(), true, '뒤로 가기로 되살아날 때(pageshow) 다시 읽는다');
  p.setCookie(''); p.fire('doc:visibilitychange');
  assert.equal(p.member(), false, '탭으로 돌아왔을 때 로그아웃을 반영한다');
  assert.equal(p.written.length, 0, '이 사이트는 쿠키를 쓰지 않는다');
}

// '로그인'을 누르는 순간 주소에서 q 만 뺀다 — 쇼핑몰은 리퍼러로 이 주소를 받는다
const CASES = 'https://baramdaero.com/cases/?q=%EB%B4%87%EB%93%A4%EB%A7%88%EC%9D%84+%EC%84%B1%EB%82%A8&r=%EA%B2%BD%EA%B8%B0#top';
for (const type of ['click', 'auxclick', 'contextmenu']) {
  const p = page('', CASES);
  assert.ok(p.captured(type), `${type}: 가로채는 단계(capture)로 걸려야 다른 핸들러보다 먼저 돈다`);
  p.press(type);
  assert.equal(p.replaced.length, 1, `${type}: 주소를 한 번 바꿔야 한다`);
  assert.equal(p.href(), 'https://baramdaero.com/cases/?r=%EA%B2%BD%EA%B8%B0#top', `${type}: q 만 빠지고 지역(r)·# 는 남아야 한다`);
  assert.deepEqual(p.replaced[0].state, { keep: 1 }, `${type}: 기록 상태(history.state)를 건드리지 않는다`);
}
{
  const p = page('', CASES);
  p.press('click', false);
  assert.equal(p.replaced.length, 0, '로그인 링크가 아닌 곳을 눌렀을 땐 주소를 건드리지 않는다');
  const q = page('', 'https://baramdaero.com/faq/');
  q.press('click');
  assert.equal(q.replaced.length, 0, 'q 가 없으면 주소를 바꾸지 않는다');
  const r = page('', 'https://baramdaero.com/cases/?r=%EA%B2%BD%EA%B8%B0');
  r.press('click');
  assert.equal(r.replaced.length, 0, 'r 만 있을 땐 주소를 바꾸지 않는다');
  const nt = page('', CASES);
  assert.doesNotThrow(() => (nt.fire('doc:click'), (nt.fire('doc:auxclick'))), '대상(target)이 없는 이벤트에도 죽지 않는다');
  assert.equal(nt.written.length, 0, '이 사이트는 쿠키를 쓰지 않는다');
}
console.log('shop session: 로그인 표시·검색어 빼기 통과');
