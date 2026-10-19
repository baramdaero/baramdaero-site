/**
 * 로그인 표시 스크립트 검사 — src/scripts/shop-session.js 를 가짜 document 안에서 돌린다.
 *
 *   npm run test:shop   (링크 검사 뒤에 같이 돈다)  또는  node scripts/check-shop-session.mjs
 *
 * 보는 것: 쿠키 bd_login=1 이 있을 때만 <html> 에 bd-member 가 붙고, 뒤로 가기·탭 복귀 때 다시 읽으며,
 * 이 사이트는 쿠키를 쓰지 않는다(개인정보 처리방침 §8 '이 사이트는 쿠키를 직접 저장하지 않습니다'와 맞춘다).
 */
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const SRC = await readFile(fileURLToPath(new URL('../src/scripts/shop-session.js', import.meta.url)), 'utf8');

/** 쿠키 상자와 이벤트가 있는 가짜 화면 하나를 만들어 스크립트를 돌린다 */
function page(cookie = '') {
  const classes = new Set();
  const on = {};
  const written = [];
  let jar = cookie;
  const document = {
    get cookie() { return jar; },
    set cookie(v) { written.push(v); },
    documentElement: { classList: { toggle: (c, force) => (force ? classes.add(c) : classes.delete(c)) } },
    addEventListener: (type, fn) => { (on[`doc:${type}`] ??= []).push(fn); },
  };
  const window = { addEventListener: (type, fn) => { (on[`win:${type}`] ??= []).push(fn); } };
  vm.runInNewContext(SRC, { document, window });
  return {
    member: () => classes.has('bd-member'),
    setCookie: (v) => { jar = v; },
    fire: (key) => (on[key] ?? []).forEach((fn) => fn({})),
    written,
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
console.log('shop session: 로그인 표시 통과');
