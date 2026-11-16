// 렌더 누수 검사 — 사례·블로그 본문이 마크다운 기호를 그대로 드러내거나 깨져 나오지 않는지 dist 에서 본다.
//
//   npm run build && node scripts/check-render-leaks.mjs [dist 폴더]
//   node scripts/check-render-leaks.mjs --selfcheck    플러그인(rehype-literal-tilde)과 누수 패턴 자체 점검
//
// 본문(사례 /cases/<id>/, 블로그 /blog/<id>/)의 HTML 에서 <script>(JSON-LD 제외)·<style> 을 뺀 뒤 다음을 센다.
//   <del>          단일 틸다 범위('5~5.5cm')가 취소선으로 렌더된 것 — 본문에 진짜 취소선(~~)은 쓰지 않는다
//   **  ](  [object  undefined  NaN    마크다운이 해석되지 않은 기호, 값이 비어 문자열로 새어 나온 것
// dist 는 빌드 결과라 낡을 수 있다 — 고친 뒤에는 빌드부터 한다. 빌드는 이 스크립트가 하지 않는다.
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import rehypeLiteralTilde from './rehype-literal-tilde.mjs';

const PATTERNS = [
  ['<del>', /<del[\s>]/],
  ['**', /\*\*/],
  ['](', /\]\(/],
  ['[object ', /\[object /],
  ['undefined', /\bundefined\b/],
  ['NaN', /\bNaN\b/],
];

/** 화면에 그려지는 부분만 남긴다 — 인라인 스크립트·스타일은 뺀다(JSON-LD 는 남긴다: 거기에 새는 것도 누수다) */
export function visibleHtml(html) {
  return html
    .replace(/<style[\s\S]*?<\/style>/g, '')
    .replace(/<script(?![^>]*application\/ld\+json)[^>]*>[\s\S]*?<\/script>/g, '');
}
export const leaksIn = (html) => { const v = visibleHtml(html); return PATTERNS.filter(([, re]) => re.test(v)).map(([name]) => name); };

function pages(dist) {
  const out = [];
  for (const section of ['cases', 'blog']) {
    const dir = path.join(dist, section);
    if (!existsSync(dir)) continue;
    for (const d of readdirSync(dir, { withFileTypes: true })) {
      const f = d.isDirectory() && path.join(dir, d.name, 'index.html');
      if (f && existsSync(f) && !['apt', 'log', 'region'].includes(d.name)) out.push([`/${section}/${d.name}/`, f]);
    }
  }
  return out;
}

function selfcheck() {
  // 플러그인: 손으로 만든 hast 트리와 원문. 위치(offset)는 원문에서 첫 '~' 의 자리다.
  const text = (value) => ({ type: 'text', value });
  const del = (offset, ...children) => ({ type: 'element', tagName: 'del', properties: {}, children, position: { start: { offset } } });
  const para = (...children) => ({ type: 'root', children: [{ type: 'element', tagName: 'p', properties: {}, children }] });
  const plain = (tree) => JSON.stringify(tree.children[0].children.map((n) => n.type === 'text' ? n.value : `<${n.tagName}>`));
  const run = (tree, value) => { rehypeLiteralTilde()(tree, { value }); return tree; };

  // '5~5.5cm 와 8~10cm' → 취소선이 풀려 글자 그대로
  const range = '5~5.5cm 와 8~10cm';
  const t1 = run(para(text('5'), del(1, text('5.5cm 와 8')), text('10cm')), range);
  assert.equal(plain(t1), JSON.stringify(['5', '~', '5.5cm 와 8', '~', '10cm']));
  assert.equal(t1.children[0].children.map((n) => n.value).join(''), range, '이어 붙이면 원문 그대로');
  // 진짜 취소선(~~)은 유지
  const t2 = run(para(text('앞 '), del(2, text('진짜')), text(' 뒤')), '앞 ~~진짜~~ 뒤');
  assert.equal(plain(t2), JSON.stringify(['앞 ', '<del>', ' 뒤']));
  // 위치를 모르면 건드리지 않는다
  const t3 = para(text('a'), { type: 'element', tagName: 'del', properties: {}, children: [text('b')] }, text('c'));
  assert.equal(plain(run(t3, 'a~b~c')), JSON.stringify(['a', '<del>', 'c']));
  // 한 문단에 단일 틸다 둘, 사이에 진짜 취소선이 끼어도 각자 판정
  const mixed = '1~2 ~~x~~ 3~4';
  const t4 = run(para(text('1'), del(1, text('2 '), { type: 'element', tagName: 'del', properties: {}, children: [text('x')], position: { start: { offset: 4 } } }, text(' 3')), text('4')), mixed);
  assert.equal(plain(t4), JSON.stringify(['1', '~', '2 ', '<del>', ' 3', '~', '4']));

  // 누수 패턴
  assert.deepEqual(leaksIn('<p>5~5.5cm</p>'), []);
  assert.deepEqual(leaksIn('<p>130mm<del>150mm</del>180mm</p>'), ['<del>']);
  assert.deepEqual(leaksIn('<p>**굵게**와 [링크](/a)</p>'), ['**', '](']);
  assert.deepEqual(leaksIn('<p>설치 undefined대 NaN%</p>'), ['undefined', 'NaN']);
  assert.deepEqual(leaksIn('<script>const a = undefined; x ** 2</script><style>a{b:c}</style><p>정상</p>'), [], '인라인 스크립트·스타일은 보지 않는다');
  assert.deepEqual(leaksIn('<script type="application/ld+json">{"x":"undefined"}</script>'), ['undefined'], 'JSON-LD 는 본다');
  console.log('check-render-leaks selfcheck: 통과');
}

const args = process.argv.slice(2);
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (args.includes('--selfcheck')) selfcheck();
  else {
    const dist = path.resolve(args.find((a) => !a.startsWith('--')) ?? path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist'));
    const list = pages(dist);
    if (!list.length) { console.error(`본문 쪽을 못 찾았다(${dist}) — npm run build 뒤에 돌린다`); process.exitCode = 1; }
    else {
      const bad = list.map(([url, f]) => [url, leaksIn(readFileSync(f, 'utf8'))]).filter(([, l]) => l.length);
      if (bad.length) {
        console.error(`렌더 누수 ${bad.length}쪽 / ${list.length}쪽`);
        for (const [url, l] of bad.slice(0, 40)) console.error(`  FAIL ${url} — ${l.join(', ')}`);
        if (bad.length > 40) console.error(`  … 외 ${bad.length - 40}쪽`);
        process.exitCode = 1;
      } else console.log(`render leaks: 통과 — 사례·블로그 ${list.length}쪽에 누수 없음`);
    }
  }
}
