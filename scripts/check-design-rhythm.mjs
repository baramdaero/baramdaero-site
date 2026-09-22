/**
 * 리듬 회귀 검사 — DESIGN.md §2 '눈썹 배급제'와 '제목 위 가로선 금지'.
 *
 *   npm run test:rhythm     (빌드까지 같이 돈다 — dist 가 낡으면 검사가 거짓 초록이 된다)
 *
 * 2026-09-22 이전 상태: 홈 제목 9개 중 9개에 1120px 가로선이 깔려 있었다
 * (눈썹 밑줄 6 + .br-h border-top 3). 모든 층위가 같은 선으로 시작하니
 * 페이지가 템플릿으로 읽혔다. 사람 눈으로는 "왜인지 모르게 AI 같다"로만 잡힌다 —
 * 그래서 기계가 센다.
 */
import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';

const ROOT = fileURLToPath(new URL('..', import.meta.url));   // 경로에 공백이 있어도 안전

/** 정원에서 빼는 눈썹 — 페이지 정체 라벨과 반복 카드·행의 분류 라벨 (DESIGN.md §2).
 *  눈썹 **바로 앞의 여는 태그** 하나만 본다. 앞쪽 N자를 통째로 훑으면 히어로의 잔상이
 *  아래 섹션 눈썹까지 면제시킨다(실제로 /care/ 에서 그랬다). */
const EXEMPT_PARENT = /v2-phero|br-story-row__copy|v2-svc__txt/;

/** 대시류 전부 — em 하나만 막으면 en 이나 호선으로 우회된다 */
const DASH = /[‒–—―−]/;

/** 같은 가로선을 그리는 표현들. 선택자는 따로 잡고 속성만 여기서 본다. */
const RULE_LIKE = /border(-top|-bottom|-block(-start|-end)?)?\s*:\s*(?!none|0)/;

async function walk(dir, ext, acc = []) {
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (e.name !== '3d') await walk(p, ext, acc); }   // 3d/ 는 외부 뷰어 정적 사본
    else if (ext.test(e.name)) acc.push([path.relative(ROOT, p), await readFile(p, 'utf8')]);
  }
  return acc;
}

/** 눈썹을 '바로 앞 여는 태그'와 '바로 뒤 .br-h 유무'까지 같이 뽑는다 */
function eyebrows(html) {
  const out = [];
  const re = /<span[^>]*class="[^"]*br-eyebrow[^"]*"[^>]*>([\s\S]*?)<\/span>/g;
  for (const m of html.matchAll(re)) {
    const before = html.slice(Math.max(0, m.index - 400), m.index);
    out.push({
      text: m[1].replace(/<[^>]+>/g, '').replace(/&mdash;/g, '—').replace(/&ndash;/g, '–').trim(),
      parentTag: (before.match(/<[a-z][^>]*>\s*$/i) ?? [''])[0],
      // 정원은 '제목을 이끄는 눈썹'만 센다 — 뒤에 .br-h 가 없으면 그 블록의 유일한 이름표다
      leadsHeadline: /^[\s\S]{0,400}?class="[^"]*\bbr-h\b/.test(html.slice(m.index + m[0].length)),
    });
  }
  return out;
}

function check(file, html) {
  const fails = [];
  const secs = (html.replace(/<section class="chat__panel"/g, '<div').match(/<section\b/g) ?? []).length;
  const eb = eyebrows(html);

  // ① 눈썹 안의 대시 — `설치 — 설계` 류. 앞말이 정보고 뒷말은 장식이다.
  for (const e of eb) if (DASH.test(e.text)) fails.push(`${file}: 눈썹에 대시 — "${e.text}"`);

  // ② 섹션 제목 눈썹 정원 = ceil(섹션 수 / 3)
  const counted = eb.filter((e) => e.leadsHeadline && !EXEMPT_PARENT.test(e.parentTag));
  const allow = Math.ceil(secs / 3);
  if (counted.length > allow) {
    fails.push(`${file}: 섹션 눈썹 ${counted.length}개 > 정원 ${allow}개 (섹션 ${secs}) — ${counted.map((e) => e.text).join(' / ')}`);
  }
  return fails;
}

/** ③ 제목 위 가로선 — 컴포넌트 scoped style 로 되살려도 걸리도록 **빌드 결과**를 본다 */
function ruleGuard(css, where) {
  const fails = [];
  for (const m of css.matchAll(/([^{}]*)\{([^}]*)\}/g)) {
    const sel = m[1], body = m[2];
    if (!/\.br-h\b|\.br-eyebrow\b/.test(sel)) continue;
    if (RULE_LIKE.test(body)) fails.push(`${where}: 제목·눈썹에 가로선이 붙었다 — "${sel.trim().slice(0, 80)}" (DESIGN.md §2)`);
  }
  return fails;
}

const pages = await walk(path.join(ROOT, 'dist'), /\.html$/);
assert.ok(pages.length > 0, 'dist 에 html 이 없다 — 먼저 npm run build');

const fails = [];
for (const [f, html] of pages) {
  fails.push(...check(f, html));
  for (const s of html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)) fails.push(...ruleGuard(s[1], f));
}
for (const [f, css] of await walk(path.join(ROOT, 'dist/_astro'), /\.css$/)) fails.push(...ruleGuard(css, f));
fails.push(...ruleGuard(await readFile(path.join(ROOT, 'src/styles/global.css'), 'utf8'), 'src/styles/global.css'));

if (fails.length) {
  console.error([...new Set(fails)].map((f) => `  FAIL ${f}`).join('\n'));
  process.exit(1);
}

// 자체 점검 — 검사가 죽어 있으면 통과가 의미 없다
assert.equal(check('x', '<section></section><span class="br-eyebrow">설치 — 설계</span>').length, 1, 'em-dash 를 못 잡는다');
assert.equal(check('x', '<section></section><span class="br-eyebrow">설치 – 설계</span>').length, 1, 'en-dash 로 우회된다');
assert.equal(check('x', '<section></section><span class="br-eyebrow">가</span><h2 class="br-h">A</h2><span class="br-eyebrow">나</span><h2 class="br-h">B</h2>').length, 1, '정원 초과를 못 잡는다');
assert.equal(check('x', '<section></section><div class="v2-svc__txt"><span class="br-eyebrow">설치</span><h2 class="br-h">A</h2></div>').length, 0, '카드 분류 라벨은 정원 밖이다');
assert.equal(ruleGuard('.care-close :global(.br-h){border-top:1px solid #ccc}', 'x').length, 1, '컴포넌트 scoped 가로선을 못 잡는다');
assert.equal(ruleGuard('.br-eyebrow--lead,.x{border-bottom:1px solid #ccc}', 'x').length, 1, '눈썹 수정자 밑줄을 못 잡는다');
assert.equal(ruleGuard('.br-h{border-top:none}', 'x').length, 0, 'none 은 가로선이 아니다');

console.log(`design rhythm: 가로선 0, 눈썹 정원 준수 — 화면 ${pages.length}개 통과`);
