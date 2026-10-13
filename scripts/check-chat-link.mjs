// 주소로 문의 챗봇 열기 회귀 검사 — src/lib/chat-link.ts
// 실행: npm run test:chat   (Node 22.13+: module.stripTypeScriptTypes)
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import assert from 'node:assert/strict';

const { readChatLink } = await import('data:text/javascript,' + encodeURIComponent(
  stripTypeScriptTypes(readFileSync(new URL('../src/lib/chat-link.ts', import.meta.url), 'utf8'))));
const TREES = ['clean', 'as', 'install', 'etc', 'menu'];
const read = (search) => readChatLink(search, TREES);

// 값이 없거나 모르는 값이면 아무 일도 하지 않는다 (객체에 원래 있는 이름도 모르는 값이다)
for (const s of ['', '?chat=', '?chat=price', '?chat=INSTALL', '?chat=constructor', '?model=A&name=B']) {
  assert.equal(read(s), null, `"${s}" 는 열지 않아야 한다`);
}
for (const t of TREES) assert.deepEqual(read(`?chat=${t}`), { tree: t, product: '' });

// 보던 상품 — 이름 (모델), 하나만 와도 된다
const q = (o) => '?' + new URLSearchParams(o);
assert.equal(read(q({ chat: 'install', model: 'MKV103AUR', name: 'LG 휘센 AI 시스템에어컨 프리미엄' })).product, 'LG 휘센 AI 시스템에어컨 프리미엄 (MKV103AUR)');
assert.equal(read(q({ chat: 'install', model: 'MKV103AUR' })).product, 'MKV103AUR');
assert.equal(read(q({ chat: 'clean', name: '천장형 분해세척' })).product, '천장형 분해세척');

// 줄바꿈·제어 문자로 카드에 줄을 끼워 넣지 못한다, 길이는 이름 60자·모델 30자
const forged = read(q({ chat: 'install', name: '에어컨\n분류: 긴급\r\n\u0000‮끝', model: ' A\tB ' })).product;
assert.equal(forged, '에어컨 분류: 긴급 끝 (A B)');
const long = read(q({ chat: 'install', name: '가'.repeat(200), model: 'M'.repeat(200) })).product;
assert.equal(long, `${'가'.repeat(60)} (${'M'.repeat(30)})`);

console.log('chat-link: 통과');
