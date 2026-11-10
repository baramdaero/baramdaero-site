// 카피 규칙 검사 — AGENTS.md '카피 작업 완료 조건'의 dist 전수 grep 7종을 실행 가능한 형태로 옮긴 것.
// 정본은 AGENTS.md(판정 기준은 docs/standards/2-발화기준.md)다. 패턴을 고칠 때는 둘을 같이 고친다.
//
//   npm run build && node scripts/check-copy-rules.mjs [dist 폴더]
//   node scripts/check-copy-rules.mjs --selfcheck     패턴이 위반 문장은 잡고 허용 자리는 통과시키는지 확인
//
// 소스가 아니라 dist 를 본다 — HTML 뿐 아니라 챗봇 문구가 들어가는 번들 JS 까지 훑는다(이진 파일만 뺀다).
// dist 는 빌드 결과라 낡을 수 있다: src/ 보다 오래됐으면 경고한다. 빌드는 이 스크립트가 하지 않는다.
//
// 종료 코드: 새 위반이 있으면 1. 이미 알려진 잔존(PENDING)은 매번 '사람 확인 대기'로 출력하며 위반으로 세지 않는다.
// 그 출력은 허용(승인)이 아니다 — exit 0 이어도 아래 목록은 사람이 판단해야 한다.
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { SITE_CONFIG } from '../src/config.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

// 법인명은 src/config.js 의 BUSINESS.NAME 한 곳에서만 읽는다(절대 규칙 7) — 이 파일에는 글자로 적지 않는다.
const NAME = SITE_CONFIG.BUSINESS.NAME;
const BRAND = NAME.replace(/^주식회사\s*/, '');
const HEAD = BRAND.slice(0, 2), TAIL = BRAND.slice(2);
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// 허용 자리(푸터 span · JSON-LD legalName · 방침 사업자 문장)는 정확히 그 모양일 때만 통과한다
const ALLOWED = new RegExp(`^(?:<span[^>]*>${esc(NAME)}</span>|"legalName":"${esc(NAME)}"|${esc(NAME)}\\(이하 ‘회사’\\))$`);

// [규칙 이름, 정규식, 예외 판정(true 면 위반 아님)]
export const RULES = [
  ['사진 요구', /.{0,6}사진을?[^.。\n]{0,12}(?:보내|공유|찍어|촬영|첨부|전달해)/g, (m) => /작업 *사진을 *전달/.test(m)],
  ['기간 약속', /[0-9]+ ?(?:년|개월|일|시간|분|주) ?(?:이내|안에|내에)/g],
  ['금지어', /최고|완벽|정직|꼼꼼|보증|무상/g],
  ['내부 마커', /\[현장 데이터 필요\]/g],
  ['법인명 허용 자리 밖', new RegExp(`<span[^>]*>${esc(NAME)}</span>|"legalName":"${esc(NAME)}"|${esc(NAME)}\\(이하 ‘회사’\\)|${HEAD}.{0,8}${TAIL}`, 'g'), (m) => ALLOWED.test(m)],
  ['법인명 줄임·띄어쓰기', new RegExp(`\\(주\\) ?${HEAD}|㈜ ?${HEAD}|주식회사${HEAD}|${HEAD} ${TAIL}`, 'gi')],
];

// 알려진 잔존 — 위반인지 아닌지는 사람이 정한다(여기 있다고 허용된 것이 아니다).
// [규칙, dist 안 경로, 일치 문자열, 최대 개수, 설명]
export const PENDING = [
  ['기간 약속', 'faq/index.html', '3분 안에', 1, 'FAQ 본문 "3분 안에 실외기가 멈추면 고장이 아닙니다" — 제품 동작 설명으로 보이나 기간 약속 패턴에 걸린다'],
  ['금지어', '3d/house.html', '최고', 2, '3D 뷰어 스크립트 주석("최고 속도"·"최고 각속도") — 화면에 나오는 글이 아니다'],
  ['금지어', '3d/commercial.html', '최고', 1, '3D 뷰어 스크립트 주석("자세 최고 각속도…")'],
  ['금지어', '3d/office.html', '최고', 1, '3D 뷰어 스크립트 주석("자세 최고 각속도…")'],
];

/** 텍스트 한 덩어리에서 규칙별 일치를 뽑는다 → [{ rule, match, context }] */
export function scanText(text) {
  const hits = [];
  for (const [rule, re, exempt] of RULES) {
    for (const m of text.matchAll(re)) {
      if (exempt?.(m[0])) continue;
      hits.push({ rule, match: m[0], context: text.slice(Math.max(0, m.index - 14), m.index + m[0].length + 14).replace(/\s+/g, ' ') });
    }
  }
  return hits;
}

/** 법인명이 쪽당 2회(방침 쪽만 3회)인지 — 센 횟수가 틀린 파일을 돌려준다 */
export function brandCountProblems(counts) {
  return Object.entries(counts).filter(([f, n]) => n !== 2 && !(n === 3 && f === 'privacy/index.html')).map(([f, n]) => `${f}: ${n}회`);
}

const BINARY = /\.(?:webp|png|jpe?g|gif|avif|ico|woff2?|ttf|otf|mp4|webm|mov|pdf|zip|gz)$/i;
function walk(dir, acc = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, acc); else if (!BINARY.test(e.name)) acc.push(p);
  }
  return acc;
}
const isBinary = (buf) => buf.subarray(0, 8000).includes(0);
const count = (text, needle) => text.split(needle).length - 1;
const newest = (dir) => readdirSync(dir, { withFileTypes: true }).reduce((t, e) => Math.max(t, e.isDirectory() ? newest(path.join(dir, e.name)) : statSync(path.join(dir, e.name)).mtimeMs), 0);

function selfcheck() {
  const has = (text, rule) => scanText(text).some((h) => h.rule === rule);
  assert.ok(has('견적은 1시간 안에 드립니다', '기간 약속'));
  assert.ok(has('2년간 무상 점검', '금지어'));
  assert.ok(has('현장 사진을 업체에 보내 주세요', '사진 요구'));
  assert.ok(!has('작업 사진을 전달해 드립니다', '사진 요구'), '작업 사진 전달은 자사 약속이라 예외');
  assert.ok(has('안내 [현장 데이터 필요] 문구', '내부 마커'));
  assert.ok(has(`상호 (주) ${BRAND} 입니다`, '법인명 줄임·띄어쓰기') && has(`㈜${BRAND}`, '법인명 줄임·띄어쓰기'));
  assert.ok(has(`${HEAD} ${TAIL}`, '법인명 줄임·띄어쓰기'));
  assert.ok(has(`본사는 ${BRAND} 입니다`, '법인명 허용 자리 밖'), '허용 모양이 아니면 위반');
  for (const ok of [`<span data-astro-cid-x>${NAME}</span>`, `"legalName":"${NAME}"`, `${NAME}(이하 ‘회사’)`]) {
    assert.ok(!has(ok, '법인명 허용 자리 밖'), `허용 자리인데 걸렸다: ${ok}`);
  }
  assert.deepEqual(scanText('평범한 문장입니다. 2년 뒤에 점검합니다.'), [], '평범한 문장은 통과');
  assert.deepEqual(brandCountProblems({ 'index.html': 2, 'privacy/index.html': 3, 'care/index.html': 2 }), []);
  assert.deepEqual(brandCountProblems({ 'index.html': 2, 'care/index.html': 3, '_astro/x.js': 1 }), ['care/index.html: 3회', '_astro/x.js: 1회']);
  console.log('check-copy-rules selfcheck: passed');
}

function main(distArg) {
  const dist = path.resolve(distArg ?? path.join(ROOT, 'dist'));
  if (!existsSync(dist)) { console.error(`dist 가 없다(${dist}) — npm run build 뒤에 돌린다`); process.exitCode = 1; return; }
  const srcDir = path.join(ROOT, 'src');
  if (!distArg && existsSync(srcDir) && statSync(path.join(dist, 'index.html')).mtimeMs < newest(srcDir)) {
    console.log('경고: dist 가 src/ 보다 오래됐다 — 낡은 dist 로는 거짓 통과가 나온다. npm run build 를 먼저 돌린다.');
  }
  const files = walk(dist);
  const found = [];            // { rule, file, match, context }
  const brandCounts = {};
  let scanned = 0;
  for (const f of files) {
    const buf = readFileSync(f);
    if (isBinary(buf)) continue;
    scanned++;
    const text = buf.toString('utf8');
    const rel = path.relative(dist, f).split(path.sep).join('/');
    for (const h of scanText(text)) found.push({ ...h, file: rel });
    const n = count(text, BRAND);
    if (n) brandCounts[rel] = n;
  }

  // 알려진 잔존은 '사람 확인 대기'로 빼고, 그 밖의 hit 만 새 위반이다
  const left = PENDING.map(([rule, file, match, max, note]) => ({ rule, file, match, max, note, seen: [] }));
  const violations = [];
  for (const h of found) {
    const p = left.find((x) => x.rule === h.rule && x.file === h.file && x.match === h.match && x.seen.length < x.max);
    if (p) p.seen.push(h); else violations.push(h);
  }
  for (const p of brandCountProblems(brandCounts)) violations.push({ rule: '법인명 쪽당 횟수', file: '', match: p, context: '쪽당 2회(푸터 1 + JSON-LD 1), /privacy/ 만 3회' });
  // 한계 보완: 홈 2회·/privacy/ 3회가 실제로 있어야 한다(둘 다 빠져 0회가 된 쪽은 위 검사에 안 걸린다)
  if (brandCounts['index.html'] !== 2) violations.push({ rule: '법인명 쪽당 횟수', file: '', match: `index.html: ${brandCounts['index.html'] ?? 0}회`, context: '홈은 정확히 2회여야 한다' });
  if (brandCounts['privacy/index.html'] !== 3) violations.push({ rule: '법인명 쪽당 횟수', file: '', match: `privacy/index.html: ${brandCounts['privacy/index.html'] ?? 0}회`, context: '방침 쪽은 정확히 3회여야 한다' });

  console.log(`카피 규칙 검사: ${dist} 텍스트 파일 ${scanned}개 · 규칙 ${RULES.length + 1}종`);
  const pending = left.filter((p) => p.seen.length);
  if (pending.length) {
    console.log('\n[사람 확인 대기] 위반으로 세지 않았지만 허용(승인)된 것이 아니다. exit 0 은 승인이 아니다:');
    for (const p of pending) console.log(`  - ${p.rule} · ${p.file} · "${p.match}" ${p.seen.length}건 — ${p.note}\n      예: …${p.seen[0].context}…`);
  }
  const gone = left.filter((p) => !p.seen.length);
  if (gone.length) console.log(`\n참고: 기준선에 있던 ${gone.map((p) => `${p.file} "${p.match}"`).join(', ')} 가 더는 없다 — PENDING 목록을 정리한다.`);
  if (violations.length) {
    console.error(`\n새 위반 ${violations.length}건`);
    for (const v of violations.slice(0, 40)) console.error(`  FAIL [${v.rule}] ${v.file}${v.file ? ' · ' : ''}"${v.match}" — …${v.context}…`);
    if (violations.length > 40) console.error(`  … 외 ${violations.length - 40}건`);
    process.exitCode = 1;
  } else {
    console.log(`\n새 위반 0건 (사람 확인 대기 ${pending.reduce((n, p) => n + p.seen.length, 0)}건)`);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  if (args.includes('--selfcheck')) selfcheck();
  else main(args.find((a) => !a.startsWith('--')));
}
