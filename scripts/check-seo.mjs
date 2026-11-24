// 검색 노출 기본 검사 — 빌드 결과(dist)를 읽는다. 실행: npm run build && npm run test:seo
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
const { clipMeta, shortTitles } = await import('../src/lib/seo.ts');

// 1. 자르기 규칙
assert.equal(clipMeta('짧은 문장입니다.'), '짧은 문장입니다.');
const two = `${'가'.repeat(100)}합니다. ${'나'.repeat(100)}합니다.`;
assert.equal(clipMeta(two), `${'가'.repeat(100)}합니다.`, '문장 끝에서 자른다');
const noEnd = '낱말 '.repeat(60);
assert.ok(clipMeta(noEnd).length <= 155 && clipMeta(noEnd).endsWith('…'));
const d = new Date('2026-05-18T00:00:00Z');
const long = (x) => `${'가'.repeat(40)} ｜ LG 1Way 4대 · ${x}${'다'.repeat(20)}`;
const t = shortTitles([{ id: 'a', title: long('하나'), date: d }, { id: 'b', title: long('둘'), date: new Date('2026-06-01T00:00:00Z') }, { id: 'c', title: `${'나'.repeat(40)} · 설명${'다'.repeat(20)}`, date: d }]);
assert.ok(t.get('a').endsWith('(2026.5.18)') && t.get('b').endsWith('(2026.6.1)'), '겹치면 시공일로 구분');
assert.equal(t.get('c'), '나'.repeat(40));

// 2. 빌드 결과
const dist = new URL('../dist/', import.meta.url).pathname;
assert.ok(existsSync(path.join(dist, 'index.html')), 'dist 가 없다 — npm run build 먼저');
const pages = [];
const walk = (dir) => { for (const n of readdirSync(dir)) { const p = path.join(dir, n); if (statSync(p).isDirectory()) walk(p); else if (n.endsWith('.html')) pages.push(p); } };
walk(dist);
const decode = (s) => s.replace(/&amp;/g, '&').replace(/&#x27;|&#39;/g, "'").replace(/&quot;/g, '"');
const titles = new Map();
let cases = 0;
for (const p of pages) {
  const h = readFileSync(p, 'utf8');
  if (/name="robots" content="[^"]*noindex/.test(h) || /http-equiv="refresh"/.test(h)) continue;
  const rel = `/${path.relative(dist, p).replace(/index\.html$/, '')}`;
  const title = decode(h.match(/<title>(.*?)<\/title>/s)?.[1] ?? '').trim();
  const desc = decode(h.match(/<meta name="description" content="([^"]*)"/)?.[1] ?? '');
  assert.ok(title, `${rel}: 제목 없음`);
  assert.ok(desc, `${rel}: 설명 없음`);
  assert.ok(!titles.has(title), `제목 겹침: ${title}\n  ${titles.get(title)}\n  ${rel}`);
  titles.set(title, rel);
  assert.equal((h.replace(/<(script|style|template)[\s\S]*?<\/\1>/g, '').match(/<h1\b/g) ?? []).length, 1, `${rel}: h1 은 하나`);
  if (/^\/cases\/\d{4}-/.test(rel)) {
    cases += 1;
    assert.ok(title.length <= 72, `${rel}: 제목 ${title.length}자`);
    assert.ok(desc.length <= 160, `${rel}: 설명 ${desc.length}자`);
  }
}
assert.ok(cases > 0, '사례 페이지를 찾지 못했다');
assert.match(readFileSync(path.join(dist, '404.html'), 'utf8'), /name="robots" content="noindex"/, '404 는 색인하지 않는다');

// 주소에 쓸 수 없는 글자가 든 단지 폴더는 404 가 된다
const badDirs = readdirSync(path.join(dist, 'cases/apt')).filter((n) => /[%#?]/.test(n));
assert.deepEqual(badDirs, [], '단지 주소에 % # ? 가 있다');
assert.ok(!/%23|%3F/i.test(readFileSync(path.join(dist, 'sitemap-0.xml'), 'utf8')), '사이트맵에 깨지는 주소가 있다');

console.log(`seo: 통과 — 색인 페이지 ${titles.size}개 제목 중복 없음, 사례 ${cases}개 제목·설명 길이, 404 noindex, 단지 주소·사이트맵`);
