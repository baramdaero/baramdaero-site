/**
 * 리듬 회귀 검사 — DESIGN.md §2 '눈썹 배급제'와 '제목 위 가로선 금지'.
 *
 *   npm run build && node scripts/check-design-rhythm.mjs
 *
 * 2026-09-22 이전 상태: 홈 제목 9개 중 9개에 1120px 가로선이 깔려 있었다
 * (눈썹 밑줄 6 + .br-h border-top 3). 모든 층위가 같은 선으로 시작하니
 * 페이지가 템플릿으로 읽혔다. 사람 눈으로는 "왜인지 모르게 AI 같다"로만 잡힌다 —
 * 그래서 기계가 센다.
 */
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';

const ROOT = new URL('..', import.meta.url).pathname;

/** 정원에서 빼는 눈썹 — 페이지 정체 라벨과 반복 카드·행의 분류 라벨 (DESIGN.md §2) */
const EXEMPT_PARENT = /v2-phero|br-story-row__copy|v2-svc__txt|sit-related/;

/** dist 의 html 을 전부 모은다 */
async function pages(dir = path.join(ROOT, 'dist'), acc = []) {
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) await pages(p, acc);
    else if (e.name.endsWith('.html')) acc.push([path.relative(ROOT, p), await readFile(p, 'utf8')]);
  }
  return acc;
}

/** 눈썹 하나하나를 '어느 블록 안에 있는지'와 함께 뽑는다 — 정원 계산에 부모가 필요하다 */
function eyebrows(html) {
  const out = [];
  const re = /<span[^>]*class="[^"]*br-eyebrow[^"]*"[^>]*>([\s\S]*?)<\/span>/g;
  for (const m of html.matchAll(re)) {
    out.push({ text: m[1].replace(/<[^>]+>/g, '').trim(), before: html.slice(Math.max(0, m.index - 400), m.index) });
  }
  return out;
}

function check(file, html) {
  const fails = [];
  const secs = (html.match(/<section\b/g) ?? []).length;
  const eb = eyebrows(html);

  // ① 눈썹 안의 em-dash — `설치 — 설계` 류. 앞말이 정보고 뒷말은 장식이다.
  for (const e of eb) {
    if (e.text.includes('—')) fails.push(`${file}: 눈썹에 em-dash — "${e.text}"`);
  }

  // ② 섹션 제목 눈썹 정원 = ceil(섹션 수 / 3)
  const counted = eb.filter((e) => !EXEMPT_PARENT.test(e.before));
  const allow = Math.ceil(secs / 3);
  if (counted.length > allow) {
    fails.push(`${file}: 섹션 눈썹 ${counted.length}개 > 정원 ${allow}개 (섹션 ${secs}) — ${counted.map((e) => e.text).join(' / ')}`);
  }
  return fails;
}

const css = await readFile(path.join(ROOT, 'src/styles/global.css'), 'utf8');
const fails = [];

// ③ 제목 위 가로선 — CSS 에서 원천 차단한다. 되살리면 여기서 걸린다.
if (/\.br-h[^{]*\{[^}]*border-top\s*:/.test(css)) {
  fails.push('global.css: .br-h 에 border-top 이 붙었다 — DESIGN.md §2 제목 위 가로선 금지');
}
if (/\.br-eyebrow\s*\{[^}]*border-bottom\s*:/.test(css)) {
  fails.push('global.css: .br-eyebrow 에 border-bottom 이 붙었다 — 눈썹은 인라인·선 없음');
}

for (const [file, html] of await pages()) fails.push(...check(file, html));

if (fails.length) {
  console.error(fails.map((f) => `  FAIL ${f}`).join('\n'));
  process.exit(1);
}

// 자체 점검 — 검사 자체가 죽어 있으면 통과가 의미 없다
assert.equal(check('x', '<section></section><span class="br-eyebrow">설치 — 설계</span>').length, 1, 'em-dash 를 못 잡는다');
assert.equal(check('x', '<section></section><span class="br-eyebrow">가</span><span class="br-eyebrow">나</span>').length, 1, '정원 초과를 못 잡는다');
assert.equal(check('x', '<section></section><div class="v2-svc__txt"><span class="br-eyebrow">설치</span></div>').length, 0, '카드 분류 라벨은 정원 밖이다');
console.log(`design rhythm: 가로선 0, 눈썹 정원 준수 — 페이지 ${(await pages()).length}개 통과`);
