/**
 * 쇼핑몰 링크 회귀 검사 — 죽은 링크 금지.
 *
 *   npm run test:shop     (빌드까지 같이 돈다 — dist 가 낡으면 검사가 거짓 초록이 된다)
 *
 * config.js 의 지금 값에 맞춰 dist 를 본다.
 *   SHOP_URL 이 비었으면: 쇼핑몰로 가는 링크·회원 링크·쿠폰 띠가 어느 화면에도 없어야 한다.
 *   SHOP_URL 이 있으면: 헤더(오른쪽 슬롯 + 펼침 목록)와 푸터의 회원 링크가 shopHref 주소 그대로여야 하고,
 *   경로가 빈 링크(가입 등)는 나오지 않아야 한다.
 */
import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';
import { SITE_CONFIG, shopHref } from '../src/config.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

async function walk(dir, acc = []) {
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (e.name !== '3d') await walk(p, acc); }   // 3d/ 는 외부 뷰어 정적 사본
    else if (e.name.endsWith('.html')) acc.push([path.relative(ROOT, p), await readFile(p, 'utf8')]);
  }
  return acc;
}

/** 블록 안의 <a> 를 { href, cls, text } 로 */
const anchors = (html) => Array.from(html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/g), (m) => ({
  href: (m[1].match(/\bhref="([^"]*)"/) ?? [])[1],
  cls: (m[1].match(/\bclass="([^"]*)"/) ?? [, ''])[1],
  text: m[2].replace(/<[^>]+>/g, '').trim(),
}));
const block = (html, tag, cls) => (html.match(new RegExp(`<${tag} class="${cls}[\\s\\S]*?</${tag}>`)) ?? [''])[0];

function check(file, html, cfg) {
  const fails = [];
  const shop = cfg.SHOP_URL.replace(/\/+$/, '');
  const login = shop && cfg.SHOP_LOGIN_PATH ? shop + cfg.SHOP_LOGIN_PATH : '';
  const join = shop && cfg.SHOP_JOIN_PATH ? shop + cfg.SHOP_JOIN_PATH : '';
  const all = anchors(html);
  const head = anchors(block(html, 'header', 'bd-header'));
  const foot = anchors(block(html, 'footer', 'bd-footer'));
  const member = (list) => list.filter((a) => /bd-header__(link--)?member/.test(a.cls) || a.text === '로그인' || a.text === '회원가입');

  for (const a of all) if (a.href === '' || /undefined|null/.test(a.href ?? '')) fails.push(`${file}: 빈 주소 링크 — "${a.text}"`);

  if (!shop) {
    if (member([...head, ...foot]).length) fails.push(`${file}: SHOP_URL 이 비었는데 회원 링크가 있다`);
    if (/<aside class="member-coupon"/.test(html)) fails.push(`${file}: SHOP_URL 이 비었는데 쿠폰 띠가 있다`);
    return fails;
  }
  if (!/<header class="bd-header/.test(html)) return fails;   // 공용 틀을 안 쓰는 화면
  // 헤더 둘(오른쪽 슬롯 + 펼침 목록), 푸터 하나 — 경로가 비면 0
  const want = login ? [2, 1] : [0, 0];
  const got = [head.filter((a) => a.text === '로그인'), foot.filter((a) => a.text === '로그인')];
  if (got[0].length !== want[0] || got[1].length !== want[1]) fails.push(`${file}: 로그인 링크 수 헤더 ${got[0].length}·푸터 ${got[1].length} (기대 ${want.join('·')})`);
  for (const a of got.flat()) if (a.href !== login) fails.push(`${file}: 로그인 주소가 다르다 — ${a.href}`);
  for (const a of all.filter((x) => x.text.startsWith('회원가입'))) if (!join || a.href !== join) fails.push(`${file}: 가입 경로가 비었거나 다른데 가입 링크가 있다 — ${a.href}`);
  return fails;
}

// 자체 점검 — 검사가 죽어 있으면 통과가 의미 없다
{
  const keep = SITE_CONFIG.SHOP_URL;
  SITE_CONFIG.SHOP_URL = '';
  assert.equal(shopHref('/login'), '', '쇼핑몰 주소가 비면 빈 값');
  SITE_CONFIG.SHOP_URL = 'https://s.example/';
  assert.equal(shopHref('/login'), 'https://s.example/login', '끝 빗금이 겹치지 않는다');
  assert.equal(shopHref(''), '', '경로가 비면 빈 값');
  SITE_CONFIG.SHOP_URL = keep;

  const off = { SHOP_URL: '', SHOP_LOGIN_PATH: '/login', SHOP_JOIN_PATH: '' };
  const on = { ...off, SHOP_URL: 'https://s.example' };
  const page = (h, f, body = '') => `<header class="bd-header">${h}</header>${body}<footer class="bd-footer">${f}</footer>`;
  const L = '<a href="https://s.example/login" class="bd-header__link">로그인</a>';
  assert.equal(check('x', page('', ''), off).length, 0);
  assert.equal(check('x', page(L, ''), off).length, 1, '빈 값인데 남은 회원 링크를 못 잡는다');
  assert.equal(check('x', page('', '', '<aside class="member-coupon"></aside>'), off).length, 1, '빈 값인데 남은 쿠폰 띠를 못 잡는다');
  assert.equal(check('x', page(L + L, L), on).length, 0);
  assert.equal(check('x', page(L, L), on).length, 1, '빠진 헤더 링크를 못 잡는다');
  assert.equal(check('x', page(L + L, L.replace('/login', '/signin')), on).length, 1, '흩어진 주소를 못 잡는다');
  assert.equal(check('x', page(L + L, L, '<a href="https://s.example/join">회원가입 <span>→</span></a>'), on).length, 1, '가입 경로가 비었는데 나온 가입 링크를 못 잡는다');
  assert.equal(check('x', page(L + L, L, '<a href="">예약</a>'), on).length, 1, '빈 주소 링크를 못 잡는다');
}

const pages = await walk(path.join(ROOT, 'dist'));
assert.ok(pages.length > 0, 'dist 에 html 이 없다 — 먼저 npm run build');
const fails = pages.flatMap(([f, html]) => check(f, html, SITE_CONFIG));
if (fails.length) {
  console.error(fails.slice(0, 40).map((f) => `  FAIL ${f}`).join('\n') + (fails.length > 40 ? `\n  … 외 ${fails.length - 40}건` : ''));
  process.exit(1);
}
console.log(`shop links: ${SITE_CONFIG.SHOP_URL ? `쇼핑몰 주소 있음 — 회원 링크 주소 일치(가입 경로 ${SITE_CONFIG.SHOP_JOIN_PATH ? '있음' : '빔'})` : '쇼핑몰 주소 빔 — 회원 링크·쿠폰 띠 0'} — 화면 ${pages.length}개 통과`);
