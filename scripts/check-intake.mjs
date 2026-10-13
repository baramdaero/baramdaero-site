// 접수 기록 회귀 검사 — src/lib/intake.ts + Chatbot.astro 가 그것을 부르는 자리
// 실행: npm run test:intake   (Node 22.18+: .ts 를 그대로 import 한다. 그 아래 버전은 stripTypeScriptTypes 로 바꿔야 한다)
// 브라우저·네트워크는 쓰지 않는다 — fetch 는 가짜로 갈아 끼우고 호출 인자만 본다. 실제 전송은 브라우저에서 따로 확인한다.
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

// 모듈 불러오기 단계에서 window 를 건드리면 정적 빌드에서 깨진다 — 아래 import 가 통과하는 것 자체가 그 검사다
assert.equal(typeof window, 'undefined');
assert.equal(typeof document, 'undefined');
const { intakeEnabled, newReceiptId, recordIntake } = await import('../src/lib/intake.ts');
const { SITE_CONFIG } = await import('../src/config.js');

// ── 1. 접수번호 ─────────────────────────────────────────────
const ID_RE = /^\d{6}-[A-HJ-NP-Z2-9]{4}$/;
const kstDay = (d) => d.toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' }).slice(2).replace(/-/g, ''); // 따로 구한 한국 날짜

// 날짜는 한국시간 — 자정 경계·연말 경계. 기본값(지금)도 다른 방법으로 구한 한국 날짜와 같아야 한다
for (const [utc, day] of [
  ['2026-10-13T14:59:59Z', '261013'], // 한국 23:59:59
  ['2026-10-13T15:00:00Z', '261014'], // 한국 00:00:00
  ['2026-12-31T15:00:00Z', '270101'],
  ['2026-01-01T00:00:00Z', '260101'],
]) assert.equal(newReceiptId(new Date(utc)).slice(0, 6), day, utc);
assert.equal(newReceiptId().slice(0, 6), kstDay(new Date()));

// 형식·글자 — 1만 번. 0 O 1 I 는 나오지 않고, 32자가 네 자리 모두에서 골고루 나온다
const N = 10_000;
const ids = Array.from({ length: N }, () => newReceiptId(new Date('2026-10-13T03:00:00Z')));
for (const id of ids) assert.match(id, ID_RE, id);
const count = [0, 1, 2, 3].map(() => new Map());
for (const id of ids) [...id.slice(7)].forEach((c, i) => count[i].set(c, (count[i].get(c) ?? 0) + 1));
for (const m of count) {
  assert.equal(m.size, 32, '네 자리 모두 32자가 다 나와야 한다');
  for (const n of m.values()) assert.ok(Math.abs(n - N / 32) < 120, `한 글자가 치우쳤다: ${n}`); // 기대 312.5, 표준편차 약 17
}

// 유일성 — 뒤 4자는 32^4 = 1,048,576 가지(하루 20비트)라 같은 날 1만 번이면 겹침이 평균 48쌍 나오는 게 정상이다(생일 문제).
// '1만 번 충돌 없음'은 이 길이로는 성립하지 않는다. 여기서는 겹침이 확률 예상(≈48) 근처임을 본다 — 난수가 한곳에 몰리면 이 값이 크게 늘어난다.
// 하루 접수 수십 건에서 겹칠 확률은 n²/2,097,152 (30건 0.04%, 100건 0.5%)
const dup = N - new Set(ids).size;
assert.ok(dup < 150, `1만 번 중 겹침 ${dup}쌍 — 예상 약 48`);
// 날짜가 다르면 같은 글자여도 다른 번호다
assert.notEqual(newReceiptId(new Date('2026-10-13T03:00:00Z')).slice(0, 6), newReceiptId(new Date('2026-10-14T03:00:00Z')).slice(0, 6));

// 난수는 crypto 에서만 — Math.random 을 쓰면 여기서 터진다
{
  const real = Math.random;
  Math.random = () => { throw new Error('Math.random 사용'); };
  try { newReceiptId(); } finally { Math.random = real; }
}

// ── 2. recordIntake ────────────────────────────────────────
const ENDPOINT = 'https://intake.invalid/exec'; // .invalid 는 어디에도 연결되지 않는 예약 도메인
const ENDPOINT_RE = /^$|^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/;
// 형식 검사기 자체 확인 — 빈 값과 웹앱 주소만 통과한다
assert.ok(ENDPOINT_RE.test('') && ENDPOINT_RE.test('https://script.google.com/macros/s/AKfycbx-_0aZ/exec'));
for (const bad of [' ', 'https://intake.invalid/exec', 'http://script.google.com/macros/s/abc/exec', 'https://script.google.com/macros/s/abc/dev', 'https://script.google.com/macros/s//exec', 'https://script.google.com/macros/s/abc/exec?x=1', 'https://script.google.com/macros/s/abc/exec\n'])
  assert.ok(!ENDPOINT_RE.test(bad), `형식 밖이어야 한다: ${JSON.stringify(bad)}`);
const saved = { endpoint: SITE_CONFIG.INTAKE_ENDPOINT, fetch: globalThis.fetch, location: globalThis.location };
const calls = [];
const useFetch = (impl) => { calls.length = 0; globalThis.fetch = (...a) => { calls.push(a); return impl(...a); }; };
const CARD = (id) => `[바람대로 접수]\n분류: 설치\n지역: 성남시 분당구\n접수번호: ${id}`;
const id = newReceiptId();

let unhandled = 0;
process.on('unhandledRejection', () => { unhandled += 1; });

try {
  globalThis.location = { pathname: '/care/' };

  // config.js 의 값은 빈 값(배포 승인 전)이거나 웹앱 주소 형식(승인 뒤)이다 — 임의 문자열이면 막는다
  assert.match(saved.endpoint, ENDPOINT_RE, 'config.js 의 INTAKE_ENDPOINT 는 빈 값이거나 https://script.google.com/macros/s/<id>/exec');

  // 켜짐 여부 — 빈 값·없는 값은 꺼짐, 값이 있으면 켜짐. 접수번호와 저장 안내는 이 값 하나로 갈린다
  for (const off of ['', undefined, null]) {
    SITE_CONFIG.INTAKE_ENDPOINT = off;
    assert.equal(intakeEnabled(), false, `꺼짐: ${String(off)}`);
  }
  SITE_CONFIG.INTAKE_ENDPOINT = ENDPOINT;
  assert.equal(intakeEnabled(), true);
  assert.equal(typeof intakeEnabled(), 'boolean');

  // 주소가 비면 아무것도 하지 않는다
  useFetch(() => Promise.resolve());
  SITE_CONFIG.INTAKE_ENDPOINT = '';
  assert.equal(recordIntake(CARD(id), id), undefined);
  assert.equal(calls.length, 0, '빈 주소면 fetch 를 부르지 않는다');

  // 주소가 있으면 한 번, 올바른 인자로 — 기다리지 않는다(반환값 없음)
  SITE_CONFIG.INTAKE_ENDPOINT = ENDPOINT;
  const ret = recordIntake(CARD(id), id);
  assert.equal(ret, undefined);
  assert.equal(calls.length, 1);
  const [url, init] = calls[0];
  assert.equal(url, ENDPOINT);
  assert.equal(init.method, 'POST');
  assert.equal(init.mode, 'no-cors');
  assert.equal(init.credentials, 'omit');
  assert.equal(init.referrerPolicy, 'no-referrer');
  assert.equal(init.keepalive, true);
  assert.equal('headers' in init, false, '헤더를 직접 지정하면 단순 요청이 아니게 된다');
  assert.deepEqual(Object.keys(init).sort(), ['body', 'credentials', 'keepalive', 'method', 'mode', 'referrerPolicy']);
  assert.equal(typeof init.body, 'string');
  assert.deepEqual(JSON.parse(init.body), { v: 1, id, card: CARD(id), path: '/care/' });
  assert.deepEqual(Object.keys(JSON.parse(init.body)), ['v', 'id', 'card', 'path']);

  // 카드 4000자 — 경계. 길이는 글자 수(서버의 JS 문자열 길이와 같은 기준)다
  const pad = (n) => '가'.repeat(n);
  recordIntake(pad(4000), id);
  assert.equal(calls.length, 2, '4000자는 보낸다');
  recordIntake(pad(4001), id);
  assert.equal(calls.length, 2, '4001자는 보내지 않는다');

  // 어떤 실패도 접수를 막지 않는다: 동기 예외 · 거절된 약속 · fetch 없음 · location 없음
  useFetch(() => { throw new Error('동기 실패'); });
  assert.doesNotThrow(() => recordIntake(CARD(id), id));
  assert.equal(calls.length, 1);

  useFetch(() => Promise.reject(new TypeError('Failed to fetch')));
  assert.doesNotThrow(() => recordIntake(CARD(id), id));
  await new Promise((r) => setTimeout(r, 20)); // 거절이 처리되지 않은 채 남으면 unhandledRejection 이 온다
  assert.equal(unhandled, 0, '거절된 약속을 삼켜야 한다');

  globalThis.fetch = undefined;
  assert.doesNotThrow(() => recordIntake(CARD(id), id));

  useFetch(() => Promise.resolve());
  globalThis.location = undefined;
  assert.doesNotThrow(() => recordIntake(CARD(id), id));
} finally {
  SITE_CONFIG.INTAKE_ENDPOINT = saved.endpoint;
  globalThis.fetch = saved.fetch;
  if (saved.location === undefined) delete globalThis.location; else globalThis.location = saved.location;
}

// ── 3. Chatbot.astro 가 부르는 자리 (소스 대조) ─────────────────
const chat = readFileSync(new URL('../src/components/Chatbot.astro', import.meta.url), 'utf8');

// 접수번호는 카드의 마지막 줄이고, id 가 없으면 줄이 붙지 않는다
assert.match(chat, /push\('접수번호', id\);\s*return lines\.join\('\\n'\);/);
assert.match(chat, /function buildCard\(id\?: string\)/);
assert.match(chat, /import \{[^}]*\bintakeEnabled\b[^}]*\} from '\.\.\/lib\/intake\.ts'/);

// id 는 주소가 있을 때만 만든다 — newReceiptId 호출은 그 한 곳뿐. 받는 곳이 없으면 카드에 번호를 붙이지 않는다
assert.match(chat, /const id = intakeEnabled\(\) \? newReceiptId\(\) : undefined;\s*const text = buildCard\(id\);/);
assert.equal(chat.match(/\bnewReceiptId\(/g).length, 1, 'newReceiptId 호출은 renderCard 한 곳');
assert.equal(chat.match(/\bbuildCard\(/g).length, 2, 'buildCard 는 정의와 renderCard 호출뿐');

// buildCard 를 소스에서 떼어 실제로 돌린다(타입 표기만 걷어 낸다) — id 가 없으면 변경 전 카드 그대로, 있으면 마지막에 한 줄만 늘어난다
{
  const m = chat.match(/function buildCard\(id\?: string\): string \{[\s\S]*?\n  \}\n/);
  assert.ok(m, 'buildCard 를 찾지 못했다');
  const src = m[0].replace('(id?: string): string', '(id)').replace('(k: string, v?: string)', '(k, v)');
  assert.ok(!/:\s*(string|number|boolean)\b/.test(src.replace(/`[^`]*`/g, '')), '타입 표기가 남았다 — 이 시험의 걷어 내기를 고쳐야 한다');
  const build = new Function('data', 'askedProduct', `${src}\nreturn buildCard;`);
  const full = { 분류: '설치', 공간: '아파트', 브랜드: '삼성', 유형: '1Way', 기종: '1Way 천장형', 대수: '3대', 지역: '성남시 분당구', 증상: '' };
  for (const [data, product] of [[full, ''], [full, '(예시) 제품'], [{ 분류: 'AS', 긴급: true, 증상: '물이 떨어져요' }, ''], [{ 분류: '세척' }, '']]) {
    const off = build(data, product)();
    const on = build(data, product)('261013-ABCD');
    assert.ok(!off.includes('접수번호'), '꺼져 있으면 번호 줄이 없다');
    assert.ok(off.startsWith('[바람대로 접수]\n분류: '), '첫 줄·둘째 줄은 그대로');
    assert.equal(on, `${off}\n접수번호: 261013-ABCD`, '켜져 있으면 마지막에 한 줄만 늘어난다');
    assert.ok(on.endsWith('접수번호: 261013-ABCD'));
  }
}

// 기록 호출은 두 곳뿐 — 「이 내용으로 접수하기」(채널 연결을 기다리기 전)와 폴백 '카톡으로 접수하기'. 전화·다시 복사·기타 트리에는 없다.
// 둘 다 id 가 있을 때만 부른다(주소가 없으면 id 도 없다)
const sites = [...chat.matchAll(/\brecordIntake\(text, id\)/g)].map((m) => m.index);
assert.equal(sites.length, 2, `recordIntake 호출 ${sites.length}곳`);
assert.equal(chat.match(/if \(id\) recordIntake\(text, id\)/g)?.length, 2, '두 호출 모두 if (id) 로 감싼다');
const consultAt = chat.indexOf("ctaButton('이 내용으로 접수하기'");
const awaitAt = chat.indexOf('(await ensureChannel()) && openConsult(text)');
assert.ok(consultAt > 0 && awaitAt > consultAt);
assert.ok(sites.some((i) => i > consultAt && i < awaitAt), '접수하기 핸들러에서 채널 연결을 기다리기 전에 기록해야 한다');
const kakaoAt = chat.indexOf("ctaButton('카톡으로 접수하기'");
assert.ok(kakaoAt > 0 && sites.some((i) => i > kakaoAt && i < chat.indexOf('window.open(KAKAO', kakaoAt)), "'카톡으로 접수하기' 클릭에서도 기록한다");
assert.ok(!chat.slice(chat.indexOf('function renderEtc')).includes('recordIntake('), '기타 트리의 상담 연결은 기록하지 않는다');

// 저장 안내 — 한 줄 하나. 기록하는 버튼(접수하기·카톡으로 접수하기) 바로 아래에만, 주소가 있을 때(id 가 있을 때)만 단다
const helperAt = chat.indexOf('function intakeNote()');
assert.ok(helperAt > 0, '저장 안내 도우미가 없다');
const helperBlock = chat.slice(helperAt, chat.indexOf('\n  }\n', helperAt));
assert.equal(chat.match(/chat__card-note/g).length, 2, '클래스는 도우미 1 + CSS 1 — 다른 자리에 안내를 또 만들지 않는다');
const noteText = helperBlock.match(/\.textContent = '([^']*)';/)?.[1];
// 문구: 따옴표 문자열 하나 — 조작 설명('누르면' 등, DESIGN.md §7)·약속·사진 요구 없음, 챗봇 한 줄 25자 이하(2-발화기준 §5)
assert.equal(noteText, '접수하신 내용은 확인용으로 저장됩니다.');
assert.ok([...noteText].length <= 25 && !noteText.includes('\n'), `안내 한 줄 25자 초과: ${noteText}`);
assert.ok(!/누르|눌러|클릭|탭|버튼|사진|이내|안에|내에|보증|무상|최고|완벽|정직|꼼꼼|\d+ ?(분|시간|일)|연락|드립니다|해 드/.test(noteText), '안내에 금지 표현');
assert.ok(!/role|tabindex|addEventListener|L\(/.test(helperBlock), '안내는 role·조작 없는 한 줄 p');
const noteCalls = [...chat.matchAll(/if \(id\) wrap\.appendChild\(intakeNote\(\)\);/g)].map((m) => m.index);
assert.equal(noteCalls.length, 3, `안내 호출 ${noteCalls.length}곳 — 접수하기 2분기 + 카톡으로 접수하기 1곳`);
assert.equal(chat.match(/intakeNote\(\)/g).length, 4, '정의 1 + 호출 3 외에 안내를 달지 않는다');
const kakaoNote = chat.indexOf('wrap.appendChild(btn);', kakaoAt);
assert.ok(kakaoNote > 0 && chat.slice(kakaoNote, kakaoNote + 90).includes('if (id) wrap.appendChild(intakeNote())'), "'카톡으로 접수하기' 바로 아래");
assert.ok(noteCalls.filter((i) => i > consultAt).length === 2 && chat.slice(consultAt, chat.indexOf('function renderEtc')).split('if (id) wrap.appendChild(intakeNote())').length - 1 >= 2, "'이 내용으로 접수하기' 두 분기 모두 바로 아래");
// 전화·복사 버튼 아래에는 달지 않는다 (기록이 없는데 저장된다고 말하는 모순 금지)
assert.ok(!/ctaTel\([^\n]*\);\s*\n\s*if \(id\) wrap\.appendChild\(intakeNote/.test(chat), '전화 버튼 바로 아래에 안내를 달지 않는다');

// 안내 스타일 — 12px, 기존 토큰 색만(새 색·hex·rgb 금지)
const css = chat.match(/\.chat__card-note \{([^}]*)\}/)?.[1];
assert.ok(css, 'CSS 규칙이 없다');
assert.match(css, /font-size:\s*12px/);
assert.match(css, /color:\s*var\(--br-ink(-sub)?\)/);
assert.ok(!/#[0-9a-fA-F]{3,8}|rgba?\(|hsla?\(|color-mix|opacity/.test(css), '새 색·투명도 금지');

// 위치 예시는 단지명·층만 — 동·호수는 저장하지 않는다(3-데이터기준 §1)
assert.ok(chat.includes("install_place_hint_home: '예: 바람아파트 15층'"), '위치 예시에 동 번호를 넣지 않는다');

console.log(`intake: 통과 — 접수번호 ${N}건 형식·분포(같은 날 겹침 ${dup}쌍), 켜짐 판정, 전송 인자, 4000자 경계, 오류 삼킴, 카드 번호 줄(꺼짐=변경 전 그대로), 안내 한 줄·접수 버튼 아래 위치, 챗봇 호출 위치`);
