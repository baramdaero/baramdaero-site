// 실행: npm run build && node scripts/check-commercial.mjs
import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import vm from 'node:vm';

const chat = readFileSync('src/components/Chatbot.astro', 'utf8');
const start = chat.indexOf('  const L =');
const end = chat.indexOf('  /* ---------- 렌더 프리미티브');
assert.ok(start > 0 && end > start);
const context = { SITE_CONFIG: { BRANDS_INSTALL: ['테스트 브랜드'], WELCOME_MESSAGE: '' } };
vm.runInNewContext(stripTypeScriptTypes(chat.slice(start, end)) + '\nglobalThis.nodes = NODES;', context);
const nodes = context.nodes;
const spaces = nodes['install.space'].options;
assert.deepEqual(Array.from(spaces, (o) => o.label), ['아파트·주택', '카페', '매장·상가', '사무실', '학원·교육시설', '관공서·공공시설', '대형빌딩']);
for (const option of spaces) {
  const data = { ...option.set };
  const next = nodes['install.place'].input.next(data);
  assert.equal(next, data.공간 === '아파트·주택' ? 'install.live' : 'install.operating');
  assert.ok(nodes[next], `${option.label}: next node exists`);
  assert.match(nodes['install.place'].text(data), data.공간 === '아파트·주택' ? /아파트명/ : /건물명/);
}
assert.deepEqual(Array.from(nodes['install.operating'].options, (o) => o.set.운영상태), ['운영 중', '개업·입주 준비 중', '공사 중']);
for (const option of nodes['install.operating'].options) assert.equal(option.next, 'install.end');

const registry = JSON.parse(readFileSync('src/content/site/image-slots.json', 'utf8'));
for (const id of ['home-service-install', 'commercial-building', 'commercial-cafe']) {
  const entry = registry.slots[id];
  assert.ok(entry.alt.trim());
  assert.doesNotMatch(entry.alt, /AI/);
  assert.ok(statSync(`public${entry.src}`).size < 200_000, `${id}: web image under 200kB`);
}

const page = readFileSync('dist/commercial/index.html', 'utf8');
const home = readFileSync('dist/index.html', 'utf8');
assert.match(home, /id="commercial"/);
assert.match(home, /home-service-install\.webp/);
assert.match(page, /<link rel="canonical" href="https:\/\/baramdaero.com\/commercial\/"/);
assert.doesNotMatch(page, /AI로 만든 공간 예시입니다/);
assert.doesNotMatch(home, /AI로 만든 공간 예시입니다/);
assert.match(page, /관공서·공공시설/);
assert.match(page, /대형빌딩/);
assert.match(page, /바람대로에서 시공·관리를 받은 고객의 AS 안내/);
for (const tree of ['install', 'clean', 'as']) {
  const buttons = Array.from(page.matchAll(/<button\b[^>]*>/g), (m) => m[0]).filter((b) => b.includes(`data-chat-tree="${tree}"`));
  assert.ok(buttons.length > 0, `${tree}: entry exists`);
  assert.ok(buttons.every((b) => /\bdisabled\b/.test(b) && /aria-describedby="chat-unavailable"/.test(b)), `${tree}: no-JS fallback preserved`);
}
console.log('commercial regression: 7 space routes, 3 operating states, 3 image assets/alts and no duplicate overlay, rendered links and CTA fallbacks passed');
