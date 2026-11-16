/**
 * 쇼핑몰 링크 회귀 검사 — 죽은 링크 금지, 오른쪽 위에는 하나만.
 *
 *   npm run test:shop     (빌드까지 같이 돈다 — dist 가 낡으면 검사가 거짓 초록이 된다)
 *
 * config.js 의 지금 값에 맞춰 dist 를 본다.
 *   SHOP_URL 이 비었으면: '가격'은 /faq/ 의 '비용' 묶음, 오른쪽 위는 견적 문의, '로그인'은 어디에도 없다.
 *   SHOP_URL 이 있으면: 헤더·푸터의 '예약·구매'는 쇼핑몰 주소, 오른쪽 위는 '로그인' 하나(견적 문의 버튼 없음), 푸터에도 '로그인' 하나.
 *     '로그인'에는 referrerpolicy="unsafe-url"(쇼핑몰이 돌아올 화면을 리퍼러로 알아 간다).
 *   SHOP_MYPAGE_PATH 까지 있으면: 로그인한 방문자용 '마이페이지'가 같은 자리에 하나씩 더 있고(쇼핑몰 마이페이지 주소, 기본 숨김 클래스),
 *     '로그인'에는 data-shop-login(로그인한 방문자에겐 숨김)이 붙고, 화면마다 로그인 표시 스크립트(src/scripts/shop-session.js)가
 *     <header> 앞에 원본과 같은 본문으로 한 번, 숨기고 보이는 CSS 규칙이 빌드 CSS 에 있다.
 *     마이페이지 경로가 비면 위 셋(표시·스크립트·숨김)이 모두 없어야 한다 — 로그인한 방문자에게 로그인이 사라지지 않게.
 *   스크립트 동작은 check-shop-session.mjs, 쇼핑몰 쪽 초안은 check-shop-bridge.mjs.
 */
import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';
import { SITE_CONFIG, shopHref } from '../src/config.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

/** 헤더가 화면에 인라인으로 넣는 본문 — SiteHeader.astro 의 주석 줄 제거와 같은 규칙 */
const SESSION_JS = (await readFile(path.join(ROOT, 'src/scripts/shop-session.js'), 'utf8')).replace(/^\s*\/\/.*\n/gm, '');

async function walk(dir, acc = []) {
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (e.name !== '3d') await walk(p, acc); }   // 3d/ 는 외부 뷰어 정적 사본
    else if (e.name.endsWith('.html')) acc.push([path.relative(ROOT, p), await readFile(p, 'utf8')]);
  }
  return acc;
}

/** 블록 안의 <a> 를 { href, text, … } 로 */
const anchors = (html) => Array.from(html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/g), (m) => ({
  href: (m[1].match(/\bhref="([^"]*)"/) ?? [])[1],
  text: m[2].replace(/<[^>]+>/g, '').trim(),
  cls: ((m[1].match(/\bclass="([^"]*)"/) ?? [])[1] ?? '').split(/\s+/),
  login: /\bdata-shop-login\b/.test(m[1]),                          // 로그인 링크 표시(로그인한 방문자에겐 숨김)
  unsafe: /\breferrerpolicy="unsafe-url"/.test(m[1]),                // 쇼핑몰이 돌아올 화면을 알아 가는 리퍼러
}));
const block = (html, tag, cls) => (html.match(new RegExp(`<${tag} class="${cls}[\\s\\S]*?</${tag}>`)) ?? [''])[0];

function check(file, html, cfg) {
  const fails = [];
  const header = block(html, 'header', 'bd-header');
  if (!header) return fails;   // 공용 틀을 안 쓰는 화면
  const shop = cfg.SHOP_URL.replace(/\/+$/, '');
  const login = shop && cfg.SHOP_LOGIN_PATH ? shop + cfg.SHOP_LOGIN_PATH : '';
  const priceHref = cfg.SHOP_URL || '/faq/#cat-비용', priceText = cfg.SHOP_URL ? '예약·구매' : '가격';   // 쇼핑몰로 가면 글자도 '예약·구매'
  const mypage = login && cfg.SHOP_MYPAGE_PATH ? shop + cfg.SHOP_MYPAGE_PATH : '';

  // 로그인 표시 스크립트 — 마이페이지가 있는 화면에만, 한 번, 헤더보다 앞에(첫 그림 전에 정해져 '로그인'이 비치지 않게), 원본 본문 그대로.
  // 푸터는 이 스크립트가 정한 <html> 클래스를 따른다
  const scripts = [...html.matchAll(/<script>([^<]*bd_login=1[^<]*)<\/script>/g)];
  if (scripts.length !== (mypage ? 1 : 0)) fails.push(`${file}: 로그인 표시 스크립트 ${scripts.length}개 (기대 ${mypage ? 1 : 0})`);
  else if (scripts.length === 1) {
    if (scripts[0][1] !== SESSION_JS) fails.push(`${file}: 로그인 표시 스크립트 본문이 src/scripts/shop-session.js 와 다르다`);
    if (scripts[0].index > html.indexOf('<header class="bd-header')) fails.push(`${file}: 로그인 표시 스크립트가 헤더 뒤에 있다 — 첫 화면에 '로그인'이 잠깐 비친다`);
  }

  for (const a of anchors(html)) if (a.href === '' || /undefined|null/.test(a.href ?? '')) fails.push(`${file}: 빈 주소 링크 — "${a.text}"`);

  for (const [where, list, myClass] of [['헤더', anchors(header), 'bd-header__mypage'], ['푸터', anchors(block(html, 'footer', 'bd-footer')), 'bd-footer__mypage']]) {
    const price = list.filter((a) => a.text === priceText || a.text === priceText + priceText);   // 헤더는 짧은·긴 이름 두 벌
    if (price.length !== 1 || price[0].href !== priceHref) fails.push(`${file}: ${where} '${priceText}' 주소 — ${price.map((a) => a.href).join(', ') || '없음'} (기대 ${priceHref})`);
    if (list.some((a) => a.text.startsWith('가격') && cfg.SHOP_URL)) fails.push(`${file}: ${where} 쇼핑몰로 가는데 '가격' 글자가 남았다`);
    const logins = list.filter((a) => a.text === '로그인');
    if (logins.length !== (login ? 1 : 0) || logins.some((a) => a.href !== login)) fails.push(`${file}: ${where} '로그인' ${logins.length}개 — ${logins.map((a) => a.href).join(', ')}`);
    if (logins.some((a) => a.login !== Boolean(mypage))) fails.push(`${file}: ${where} '로그인'의 data-shop-login 이 ${mypage ? '없다 — 로그인한 방문자에게도 계속 보인다' : '남아 있다 — 마이페이지가 없는데 로그인한 방문자에게 로그인이 숨는다'}`);
    if (logins.some((a) => !a.unsafe)) fails.push(`${file}: ${where} '로그인'에 referrerpolicy="unsafe-url" 이 없다 — 쇼핑몰이 돌아올 화면을 모른다`);
    const my = list.filter((a) => a.text === '마이페이지');
    if (my.length !== (mypage ? 1 : 0) || my.some((a) => a.href !== mypage)) fails.push(`${file}: ${where} '마이페이지' ${my.length}개 — ${my.map((a) => a.href).join(', ')} (기대 ${mypage || '없음'})`);
    if (my.some((a) => !a.cls.includes(myClass))) fails.push(`${file}: ${where} '마이페이지'에 ${myClass} 클래스가 없다 — 방문자에게도 '로그인'과 나란히 보인다`);
  }
  // 오른쪽 위에는 하나만 — 로그인이 있으면 견적 문의 버튼은 없다
  const quote = /<button\b[^>]*bd-header__quote/.test(header);
  if (quote === Boolean(login)) fails.push(`${file}: 헤더 오른쪽 위 — 견적 문의 ${quote ? '있음' : '없음'}, 로그인 ${login ? '있음' : '없음'}`);
  return fails;
}

/** 빌드 CSS — 마이페이지 기본 숨김 → 회원에게만 보임, 회원에게 로그인 숨김. 순서도 본다(마이페이지 숨김이 '로그인' 표시 규칙 뒤에 와야 이긴다) */
function checkCss(css) {
  const need = [
    [/\.bd-header__mypage[^{]*\{display:none\}/, '헤더 마이페이지 기본 숨김'],
    [/html\.bd-member \.bd-header__mypage[^{]*\{display:inline-flex\}/, '회원에게 헤더 마이페이지 표시'],
    [/html\.bd-member \.bd-header__login[^{]*\[data-shop-login\][^{]*\{display:none\}/, '회원에게 헤더 로그인 숨김'],
    [/\.bd-footer__mypage[^{]*\{display:none\}/, '푸터 마이페이지 기본 숨김'],
    [/html\.bd-member \.bd-footer__mypage[^{]*\{display:revert\}/, '회원에게 푸터 마이페이지 표시'],
    [/html\.bd-member \.bd-footer__nav[^{]*\[data-shop-login\]\{display:none\}/, '회원에게 푸터 로그인 숨김'],
  ];
  const fails = need.filter(([re]) => !re.test(css)).map(([, why]) => `빌드 CSS 에 규칙이 없다 — ${why}`);
  const loginShow = css.search(/\.bd-header__login\[[^{]*\{display:inline-flex/);
  const myHide = css.search(/(^|\})\.bd-header__mypage[^{]*\{display:none\}/);
  if (loginShow >= 0 && myHide >= 0 && myHide < loginShow) fails.push("빌드 CSS 에서 마이페이지 기본 숨김이 '로그인' 표시 규칙보다 앞이라 덮인다 — 방문자에게도 마이페이지가 보인다");
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
  const noMy = { ...off, SHOP_URL: 'https://s.example' };                      // 마이페이지 경로 없음
  const on = { ...noMy, SHOP_MYPAGE_PATH: '/shop_mypage' };
  const S = `<script>${SESSION_JS}</script>`;                                   // 로그인 표시 스크립트(원본 본문)
  const page = (h, f, s = '', after = '') => `${s}<header class="bd-header">${h}</header><footer class="bd-footer">${f}</footer>${after}`;
  const P = (href, t = '가격') => `<a href="${href}">${t}</a>`, PS = (href) => P(href, '예약·구매');
  const A = (extra = '') => `<a href="https://s.example/login" referrerpolicy="unsafe-url"${extra}>로그인</a>`;
  const L = A(' data-shop-login');                                              // 마이페이지가 있을 때의 로그인
  const L1 = A();                                                               // 마이페이지가 없을 때의 로그인
  const MH = '<a href="https://s.example/shop_mypage" class="bd-header__quote bd-header__login bd-header__mypage">마이페이지</a>';
  const MF = '<a href="https://s.example/shop_mypage" class="bd-footer__mypage">마이페이지</a>';
  const Q = '<button class="bd-header__quote">견적 문의</button>';
  const U = on.SHOP_URL;
  const n = (h, f, cfg, s, after) => check('x', page(h, f, s, after), cfg).length;

  assert.equal(n(P('/faq/#cat-비용') + Q, P('/faq/#cat-비용'), off), 0);
  assert.equal(n(P('/faq/#cat-비용') + Q, P('/faq/#cat-비용') + L1, off), 1, '빈 값인데 남은 로그인을 못 잡는다');
  assert.equal(n(P('/faq/#cat-비용'), P('/faq/#cat-비용'), off), 1, '빈 값인데 사라진 견적 문의를 못 잡는다');
  assert.equal(n(P('/faq/#cat-비용') + Q + MH, P('/faq/#cat-비용'), off), 1, '빈 값인데 남은 마이페이지를 못 잡는다');

  assert.equal(n(PS(U) + L + MH, PS(U) + L + MF, on, S), 0);
  assert.equal(n(PS(U) + L + MH + Q, PS(U) + L + MF, on, S), 1, '오른쪽 위에 둘이 있는 것을 못 잡는다');
  assert.ok(n(P(U) + L + MH, PS(U) + L + MF, on, S) >= 1, "쇼핑몰로 가는데 글자가 '가격'인 것을 못 잡는다");
  assert.equal(n(PS(U) + L + MH + P('/x', '가격 안내'), PS(U) + L + MF, on, S), 1, "쇼핑몰로 가는데 남은 '가격' 글자 규칙이 죽어 있다");   // 다른 규칙에 안 걸리게 그 규칙만 건드린다
  assert.equal(n(PS(U) + PS(U) + L + MH, PS(U) + L + MF, on, S), 1, "'예약·구매'가 둘인 것을 못 잡는다");
  assert.equal(n(PS('/faq/#cat-비용') + L + MH, PS(U) + L + MF, on, S), 1, "쇼핑몰로 안 가는 '가격'을 못 잡는다");
  assert.equal(n(PS(U) + L + MH, PS(U) + L.replace('/login', '/signin') + MF, on, S), 1, '흩어진 주소를 못 잡는다');
  assert.equal(n(PS(U) + L + MH, PS(U) + L + MF + '<a href="">예약</a>', on, S), 1, '빈 주소 링크를 못 잡는다');
  assert.equal(n(PS(U) + A() + MH, PS(U) + L + MF, on, S), 1, "'로그인'에서 빠진 data-shop-login 을 못 잡는다");
  assert.equal(n(PS(U) + L, PS(U) + L + MF, on, S), 1, '헤더에서 빠진 마이페이지를 못 잡는다');
  assert.equal(n(PS(U) + '<a href="https://s.example/login" data-shop-login>로그인</a>' + MH, PS(U) + L + MF, on, S), 1, "'로그인'에서 빠진 리퍼러 지정을 못 잡는다");
  assert.equal(n(PS(U) + L + MH.replace('/shop_mypage', '/mypage'), PS(U) + L + MF, on, S), 1, '엉뚱한 마이페이지 주소를 못 잡는다');
  assert.equal(n(PS(U) + L + MH.replace(' bd-header__mypage', ''), PS(U) + L + MF, on, S), 1, '헤더 마이페이지의 기본 숨김 클래스 누락을 못 잡는다');
  assert.equal(n(PS(U) + L + MH, PS(U) + L + MF.replace(' class="bd-footer__mypage"', ''), on, S), 1, '푸터 마이페이지의 기본 숨김 클래스 누락을 못 잡는다');

  // 로그인 표시 스크립트: 있음·한 번·헤더 앞·원본 본문
  assert.equal(n(PS(U) + L + MH, PS(U) + L + MF, on, ''), 1, '로그인 표시 스크립트 누락을 못 잡는다');
  assert.equal(n(PS(U) + L + MH, PS(U) + L + MF, on, S + S), 1, '스크립트가 둘인 것을 못 잡는다');
  assert.equal(n(PS(U) + L + MH, PS(U) + L + MF, on, '', S), 1, '헤더 뒤로 밀린 스크립트를 못 잡는다');
  assert.equal(n(PS(U) + L + MH, PS(U) + L + MF, on, S.replace('bd-member', 'bd-memb')), 1, '스크립트 본문이 달라진 것을 못 잡는다');
  assert.equal(n(PS(U) + L + MH, PS(U) + L + MF, on, S.replace("addEventListener('pageshow', sync)", '0')), 1, '뒤로 가기 처리가 빠진 스크립트를 못 잡는다');

  // 마이페이지 경로가 비었을 때: 마이페이지·표시·스크립트가 모두 없어야 한다(로그인한 방문자에게 로그인이 사라지지 않게)
  assert.equal(n(PS(U) + L1, PS(U) + L1, noMy), 0);
  assert.equal(n(PS(U) + L, PS(U) + L1, noMy), 1, '마이페이지가 없는데 남은 data-shop-login 을 못 잡는다');
  assert.equal(n(PS(U) + L1, PS(U) + L1, noMy, S), 1, '마이페이지가 없는데 남은 스크립트를 못 잡는다');
  assert.equal(n(PS(U) + L1 + MH, PS(U) + L1, noMy), 1, '마이페이지가 없는데 남은 마이페이지를 못 잡는다');

  // 빌드 CSS
  const CSS = '.bd-header__login[a]{display:inline-flex;align-items:center}.bd-header__mypage[a]{display:none}html.bd-member .bd-header__mypage[a]{display:inline-flex}'
    + 'html.bd-member .bd-header__login[a][data-shop-login]{display:none}.bd-footer__mypage[b]{display:none}html.bd-member .bd-footer__mypage[b]{display:revert}'
    + 'html.bd-member .bd-footer__nav[b] [b][data-shop-login]{display:none}';
  assert.equal(checkCss(CSS).length, 0);
  assert.equal(checkCss(CSS.replace('.bd-header__mypage[a]{display:none}', '')).length, 1, '마이페이지 기본 숨김이 빠진 CSS 를 못 잡는다');
  assert.equal(checkCss(CSS.replace('html.bd-member .bd-header__login[a][data-shop-login]{display:none}', '')).length, 1, '회원에게 로그인 숨김이 빠진 CSS 를 못 잡는다');
  assert.equal(checkCss(CSS.replace('{display:revert}', '{display:none}')).length, 1, '푸터 마이페이지 표시 규칙이 틀린 CSS 를 못 잡는다');
  assert.equal(checkCss('.bd-header__mypage[a]{display:none}.bd-header__login[a]{display:inline-flex}' + CSS.slice(CSS.indexOf('html.bd-member .bd-header__mypage'))).length, 1, '순서가 뒤집힌 CSS 를 못 잡는다');
}

const pages = await walk(path.join(ROOT, 'dist'));
assert.ok(pages.length > 0, 'dist 에 html 이 없다 — 먼저 npm run build');
const fails = pages.flatMap(([f, html]) => check(f, html, SITE_CONFIG));
if (SITE_CONFIG.SHOP_URL && SITE_CONFIG.SHOP_LOGIN_PATH && SITE_CONFIG.SHOP_MYPAGE_PATH) {
  const cssDir = path.join(ROOT, 'dist/_astro');
  const css = (await Promise.all((await readdir(cssDir)).filter((f) => f.endsWith('.css')).map((f) => readFile(path.join(cssDir, f), 'utf8')))).join('\n');
  fails.push(...checkCss(css));
}
{ // 옛 /price/ 주소(리다이렉트 한 장)는 메뉴 '예약·구매'(쇼핑몰이 없으면 '가격')와 같은 곳으로 간다
  const old = pages.find(([f]) => /(^|[\\/])price[\\/]index\.html$/.test(f));
  const want = SITE_CONFIG.SHOP_URL || '/faq/#cat-비용';
  if (!old) fails.push('옛 /price/ 주소가 dist 에 없다 — 외부 링크가 끊긴다');
  else if (!old[1].includes(`url=${want}`)) fails.push(`/price/ 가 메뉴와 다른 곳으로 간다 (기대 ${want})`);
}
if (fails.length) {
  console.error(fails.slice(0, 40).map((f) => `  FAIL ${f}`).join('\n') + (fails.length > 40 ? `\n  … 외 ${fails.length - 40}건` : ''));
  process.exit(1);
}
console.log(`shop links: ${SITE_CONFIG.SHOP_URL ? "쇼핑몰 주소 있음 — '예약·구매'는 쇼핑몰, 오른쪽 위는 로그인 하나(회원에겐 마이페이지)" : "쇼핑몰 주소 빔 — '가격'은 /faq/ 비용 묶음, 오른쪽 위는 견적 문의, 로그인 0"} — 화면 ${pages.length}개 통과`);
