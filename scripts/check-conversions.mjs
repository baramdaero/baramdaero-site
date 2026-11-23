// 전환 측정 회귀 검사 — Base.astro 의 클릭 수집을 가짜 DOM 으로 실제 돌리고, 카카오 버튼 표시가 빠지지 않았는지 본다.
// 실행: npm run test:conv
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const base = read('src/layouts/Base.astro');
const body = base.match(/<script is:inline define:vars=\{\{ gaId:[^\n]*>\n([\s\S]*?)<\/script>/)?.[1];
assert.ok(body, 'Base.astro 의 GA 스크립트를 찾지 못했다');

const PHONE = '01054215338';
const KAKAO = 'https://pf.kakao.com/_TEST';
function boot(hostname) {
  const events = [];
  let listener = null;
  let capture = null;
  const window = {};
  const document = {
    createElement: () => ({}),
    head: { appendChild() {} },
    addEventListener: (type, fn, opt) => { assert.equal(type, 'click'); listener = fn; capture = opt; },
  };
  new Function('window', 'document', 'location', 'gaId', 'phone', 'kakao', 'dataLayer', `var gtag; ${body.replace('window.gtag = function', 'gtag = window.gtag = function')}`)(
    window, document, { hostname }, 'G-TEST', PHONE, KAKAO, (window.dataLayer = []),
  );
  if (window.gtag) {
    const real = window.gtag;
    window.gtag = (...a) => { if (a[0] === 'event') events.push(a); return real(...a); };
  }
  return { window, listener, capture, events, data: window.dataLayer };
}
const el = ({ href = '', kakao = false, chat = false }) => {
  const node = {
    getAttribute: (k) => (k === 'href' ? href : null),
    hasAttribute: (k) => k === 'data-kakao' && kakao,
    closest: (s) => (s === 'a,button' ? node : s === '[data-chat-root]' && chat ? {} : null),
  };
  return node;
};

const off = boot('localhost');
assert.equal(off.listener, null, '운영 주소가 아니면 수집하지 않는다');

const on = boot('baramdaero.com');
assert.equal(on.capture, true, '버튼의 stopPropagation 에 막히지 않게 캡처로 듣는다');
const fire = (opts) => {
  const before = on.data.length;
  on.listener({ target: el(opts) });
  return on.data.slice(before).map((a) => [...a]);
};
const one = (opts, name, where) => {
  const got = fire(opts);
  assert.equal(got.length, 1, JSON.stringify(opts));
  assert.deepEqual(got[0], ['event', name, { cta_location: where, transport_type: 'beacon' }]);
};
one({ href: 'tel:010-5421-5338' }, 'phone_click', 'page');
one({ href: 'tel:01054215338', chat: true }, 'phone_click', 'chatbot');
one({ href: `${KAKAO}/chat` }, 'kakao_open', 'page');
one({ href: KAKAO }, 'kakao_open', 'page');
one({ kakao: true, chat: true }, 'kakao_open', 'chatbot');
assert.equal(fire({ href: 'tel:15883366', chat: true }).length, 0, '제조사 서비스센터 번호는 회사 전화가 아니다');
assert.equal(fire({ href: 'https://shop.baramdaero.com/' }).length, 0);
assert.equal(fire({}).length, 0);
assert.doesNotThrow(() => on.listener({ target: {} }), 'closest 가 없는 대상');

// 카카오를 여는 버튼마다 표시가 있어야 센다
const chat = read('src/components/Chatbot.astro');
const opens = chat.match(/window\.open\(KAKAO/g).length;
assert.equal(chat.match(/btn\.dataset\.kakao = ''/g).length, opens, '챗봇의 카카오 버튼마다 data-kakao');
assert.match(read('src/pages/faq/index.astro'), /data-kakao data-faq-consult/);

// 접수 전환은 카드를 그릴 때 한 번, 분류만 보낸다
assert.equal(chat.match(/'chat_intake'/g).length, 1);
assert.match(chat, /gtag\?\.\('event', 'chat_intake', \{ inquiry_type: data\.분류 \}\)/);

console.log(`conversions: 통과 — 전화·카카오 판정, 다른 번호 제외, 운영 주소 한정, 챗봇 카카오 버튼 ${opens}곳`);
