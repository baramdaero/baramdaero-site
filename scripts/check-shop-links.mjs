/**
 * 쇼핑몰 링크 회귀 검사 — 죽은 링크 금지, 오른쪽 위에는 하나만.
 *
 *   npm run test:shop     (빌드까지 같이 돈다 — dist 가 낡으면 검사가 거짓 초록이 된다)
 *
 * config.js 의 지금 값에 맞춰 dist 를 본다.
 *   SHOP_URL 이 비었으면: '가격'은 /price/, 오른쪽 위는 견적 문의, '로그인'은 어디에도 없다.
 *   SHOP_URL 이 있으면: 헤더·푸터의 '가격'은 쇼핑몰 주소, 오른쪽 위는 '로그인' 하나(견적 문의 버튼 없음), 푸터에도 '로그인' 하나.
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

/** 블록 안의 <a> 를 { href, text } 로 */
const anchors = (html) => Array.from(html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/g), (m) => ({
  href: (m[1].match(/\bhref="([^"]*)"/) ?? [])[1],
  text: m[2].replace(/<[^>]+>/g, '').trim(),
}));
const block = (html, tag, cls) => (html.match(new RegExp(`<${tag} class="${cls}[\\s\\S]*?</${tag}>`)) ?? [''])[0];

function check(file, html, cfg) {
  const fails = [];
  const header = block(html, 'header', 'bd-header');
  if (!header) return fails;   // 공용 틀을 안 쓰는 화면
  const shop = cfg.SHOP_URL.replace(/\/+$/, '');
  const login = shop && cfg.SHOP_LOGIN_PATH ? shop + cfg.SHOP_LOGIN_PATH : '';
  const priceHref = cfg.SHOP_URL || '/price/';

  for (const a of anchors(html)) if (a.href === '' || /undefined|null/.test(a.href ?? '')) fails.push(`${file}: 빈 주소 링크 — "${a.text}"`);

  for (const [where, list] of [['헤더', anchors(header)], ['푸터', anchors(block(html, 'footer', 'bd-footer'))]]) {
    const price = list.filter((a) => a.text === '가격' || a.text === '가격가격');   // 헤더는 짧은·긴 이름 두 벌
    if (price.length !== 1 || price[0].href !== priceHref) fails.push(`${file}: ${where} '가격' 주소 — ${price.map((a) => a.href).join(', ') || '없음'} (기대 ${priceHref})`);
    const logins = list.filter((a) => a.text === '로그인');
    if (logins.length !== (login ? 1 : 0) || logins.some((a) => a.href !== login)) fails.push(`${file}: ${where} '로그인' ${logins.length}개 — ${logins.map((a) => a.href).join(', ')}`);
  }
  // 오른쪽 위에는 하나만 — 로그인이 있으면 견적 문의 버튼은 없다
  const quote = /<button\b[^>]*bd-header__quote/.test(header);
  if (quote === Boolean(login)) fails.push(`${file}: 헤더 오른쪽 위 — 견적 문의 ${quote ? '있음' : '없음'}, 로그인 ${login ? '있음' : '없음'}`);
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

  const off = { SHOP_URL: '', SHOP_LOGIN_PATH: '/login' };
  const on = { ...off, SHOP_URL: 'https://s.example' };
  const page = (h, f) => `<header class="bd-header">${h}</header><footer class="bd-footer">${f}</footer>`;
  const P = (href) => `<a href="${href}">가격</a>`;
  const L = '<a href="https://s.example/login">로그인</a>';
  const Q = '<button class="bd-header__quote">견적 문의</button>';
  assert.equal(check('x', page(P('/price/') + Q, P('/price/')), off).length, 0);
  assert.equal(check('x', page(P('/price/') + Q, P('/price/') + L), off).length, 1, '빈 값인데 남은 로그인을 못 잡는다');
  assert.equal(check('x', page(P('/price/'), P('/price/')), off).length, 1, '빈 값인데 사라진 견적 문의를 못 잡는다');
  assert.equal(check('x', page(P(on.SHOP_URL) + L, P(on.SHOP_URL) + L), on).length, 0);
  assert.equal(check('x', page(P(on.SHOP_URL) + L + Q, P(on.SHOP_URL) + L), on).length, 1, '오른쪽 위에 둘이 있는 것을 못 잡는다');
  assert.equal(check('x', page(P('/price/') + L, P(on.SHOP_URL) + L), on).length, 1, "쇼핑몰로 안 가는 '가격'을 못 잡는다");
  assert.equal(check('x', page(P(on.SHOP_URL) + L, P(on.SHOP_URL) + L.replace('/login', '/signin')), on).length, 1, '흩어진 주소를 못 잡는다');
  assert.equal(check('x', page(P(on.SHOP_URL) + L, P(on.SHOP_URL) + L + '<a href="">예약</a>'), on).length, 1, '빈 주소 링크를 못 잡는다');
}

const pages = await walk(path.join(ROOT, 'dist'));
assert.ok(pages.length > 0, 'dist 에 html 이 없다 — 먼저 npm run build');
const fails = pages.flatMap(([f, html]) => check(f, html, SITE_CONFIG));
if (fails.length) {
  console.error(fails.slice(0, 40).map((f) => `  FAIL ${f}`).join('\n') + (fails.length > 40 ? `\n  … 외 ${fails.length - 40}건` : ''));
  process.exit(1);
}
console.log(`shop links: ${SITE_CONFIG.SHOP_URL ? "쇼핑몰 주소 있음 — '가격'은 쇼핑몰, 오른쪽 위는 로그인 하나" : "쇼핑몰 주소 빔 — '가격'은 /price/, 오른쪽 위는 견적 문의, 로그인 0"} — 화면 ${pages.length}개 통과`);
