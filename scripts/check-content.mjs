// 사례·단지 정합 검사 — 사례 md 의 사진·apt 값이 파일, 시공 기록(case-log.json), 단지 페이지(dist)와 맞는지 본다.
// 빌드는 apt 오타나 빠진 사진을 오류로 잡지 않는다 — 사례가 단지 페이지에서 조용히 빠지거나 사진이 안 나온다.
//
//   node scripts/check-content.mjs              사례 md 검사 + dist 가 있고 최신이면 단지 페이지까지
//   node scripts/check-content.mjs --dist       dist 단지 페이지를 반드시 검사(없으면 실패, 낡았어도 검사)
//   node scripts/check-content.mjs --no-dist    사례 md 만
//   node scripts/check-content.mjs --root <폴더>  저장소 루트 대신 다른 폴더(같은 구조)를 검사
//   node scripts/check-content.mjs --selfcheck  임시 폴더에 일부러 깬 사례를 만들어 실패하는지 확인
//
// 실패(exit 1): cover·photos·본문 사진 경로/파일, cover≠photos[0], 대표 사진이 본문에 또 나옴,
//   apt 가 case-log.json slug 에 없음, 단지 페이지에 다른 단지 사례가 붙음·자기 단지 사례가 빠짐.
// 경고(exit 0): 바이트가 같은 사진이 다른 사례에 있음 — 어느 쪽이 맞는지는 원본 사진이 있어야 정한다.
import { readFileSync, readdirSync, existsSync, statSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const unquote = (v) => v.trim().replace(/^(["'])(.*)\1$/, '$2');
const dec = (s) => { try { return decodeURIComponent(s); } catch { return s; } };

/** 사례 md 한 건에서 이 검사에 필요한 것만 읽는다 (frontmatter 전체를 파싱하지 않는다) */
export function parseCase(text) {
  const m = text.replace(/\r\n/g, '\n').match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!m) return null;
  const c = { sample: false, cover: '', apt: '', photos: [], images: [] };
  let inPhotos = false;
  for (const line of m[1].split('\n')) {
    if (/^\S/.test(line)) inPhotos = /^photos:\s*$/.test(line);
    let k;
    if ((k = line.match(/^sample:\s*(.+)$/))) c.sample = unquote(k[1]) === 'true';
    else if ((k = line.match(/^cover:\s*(.+)$/))) c.cover = unquote(k[1]);
    else if ((k = line.match(/^apt:\s*(.+)$/))) c.apt = unquote(k[1]);
    else if (inPhotos && (k = line.match(/^\s+-\s*file:\s*(.+)$/))) c.photos.push(unquote(k[1]));
  }
  c.images = [...m[2].matchAll(/!\[[^\]]*\]\(([^)\s]+)\)/g)].map((x) => dec(x[1]));
  return c;
}

/** 단지 페이지의 "사진으로 보기" 블록(apt__photos)에서 /cases/<id>/ 링크를 읽는다 — 카드 안 div 가 중첩돼 있어 깊이로 닫는다 */
export function photoLinks(html) {
  const start = html.search(/<div[^>]*class="[^"]*\bapt__photos\b[^"]*"[^>]*>/);
  if (start < 0) return [];
  let depth = 0, end = html.length;
  for (const t of html.slice(start).matchAll(/<(\/?)div\b/g)) {
    depth += t[1] ? -1 : 1;
    if (depth === 0) { end = start + t.index; break; }
  }
  return [...html.slice(start, end).matchAll(/href="\/cases\/([^"/]+)\/"/g)].map((x) => dec(x[1]).toLowerCase());
}

export function check(root, { dist = 'auto' } = {}) {
  const fails = [], warns = [];
  const notes = [];
  const casesDir = path.join(root, 'src/content/cases');
  const slugs = new Set(JSON.parse(readFileSync(path.join(root, 'src/content/site/case-log.json'), 'utf8')).records.map((r) => r.slug).filter(Boolean));
  const publicFile = (p) => path.join(root, 'public', p);
  const cases = new Map();   // 소문자 id → { id, c }
  let photoCount = 0, aptCount = 0, sampleCount = 0;
  const byHash = new Map();

  for (const f of readdirSync(casesDir).filter((x) => x.endsWith('.md')).sort()) {
    const id = f.slice(0, -3);
    const c = parseCase(readFileSync(path.join(casesDir, f), 'utf8'));
    if (!c) { fails.push(`${id}: frontmatter 가 없다`); continue; }
    if (c.sample) { sampleCount++; continue; }   // 샘플은 페이지가 만들어지지 않는다
    cases.set(id.toLowerCase(), { id, c });
    const bad = (msg) => fails.push(`${id}: ${msg}`);

    if (!c.cover) bad('cover 가 없다');
    else if (!existsSync(publicFile(c.cover))) bad(`cover 파일이 없다 ${c.cover}`);
    if (!c.photos.length) bad('photos 가 비어 있다');
    else if (c.cover && c.cover !== c.photos[0]) bad(`cover 가 photos[0] 와 다르다 (${c.cover} ≠ ${c.photos[0]})`);
    for (const p of c.photos) {
      photoCount++;
      if (!existsSync(publicFile(p))) { bad(`사진 파일이 없다 ${p}`); continue; }
      const h = createHash('sha1').update(readFileSync(publicFile(p))).digest('hex');
      (byHash.get(h) ?? byHash.set(h, []).get(h)).push({ id, p });
    }
    for (const p of c.images) {
      if (!c.photos.includes(p)) bad(`본문 사진이 photos 에 없다 ${p}`);
      else if (!existsSync(publicFile(p))) bad(`본문 사진 파일이 없다 ${p}`);
    }
    if (c.cover && c.images.includes(c.cover)) bad(`대표 사진이 본문에 또 나온다 ${c.cover}`);
    if (c.apt) {
      aptCount++;
      if (!slugs.has(c.apt)) bad(`apt "${c.apt}" 가 case-log.json 의 slug 에 없다 — 단지 페이지에서 이 사례가 빠진다`);
    }
  }

  for (const items of byHash.values()) {
    const ids = [...new Set(items.map((x) => x.id))];
    if (ids.length > 1) warns.push(`바이트가 같은 사진이 다른 사례에 있다: ${items.map((x) => `${x.id}${x.p.slice(x.p.lastIndexOf('/'))}`).join(' = ')}`);
  }

  // 단지 페이지(dist): 링크된 사례의 apt 가 그 페이지 slug 와 같고, apt 가 있는 사례는 자기 단지 페이지에 모두 있다
  const aptDir = path.join(root, 'dist/cases/apt');
  let distChecked = false;
  if (dist !== 'off') {
    const newest = Math.max(0, ...[...cases.values()].map(({ id }) => statSync(path.join(casesDir, id + '.md')).mtimeMs),
      ...['src/content/site/case-log.json', 'src/pages/cases/apt/[slug].astro'].filter((x) => existsSync(path.join(root, x))).map((x) => statSync(path.join(root, x)).mtimeMs));
    if (!existsSync(aptDir)) {
      if (dist === 'force') fails.push('dist/cases/apt 가 없다 — npm run build 뒤에 다시 돌린다');
      else notes.push('dist 가 없어 단지 페이지는 검사하지 않았다');
    } else if (dist !== 'force' && statSync(aptDir).mtimeMs < newest) {
      notes.push('dist 가 사례·시공 기록보다 오래돼 단지 페이지는 검사하지 않았다 (--dist 로 강제)');
    } else {
      distChecked = true;
      const shown = new Map();   // slug → Set(소문자 id)
      for (const d of readdirSync(aptDir, { withFileTypes: true })) {
        const html = d.isDirectory() && path.join(aptDir, d.name, 'index.html');
        if (!html || !existsSync(html)) continue;
        const slug = d.name.normalize('NFC');
        const ids = photoLinks(readFileSync(html, 'utf8'));
        shown.set(slug, new Set(ids));
        for (const id of ids) {
          const hit = cases.get(id);
          if (!hit) fails.push(`/cases/apt/${slug}/: 링크된 사례 ${id} 가 사례 md 에 없다`);
          else if ((hit.c.apt || '').normalize('NFC') !== slug) fails.push(`/cases/apt/${slug}/: 다른 단지 사례가 붙었다 ${hit.id} (apt: ${hit.c.apt || '없음'})`);
        }
      }
      for (const { id, c } of cases.values()) {
        if (!c.apt || !slugs.has(c.apt)) continue;   // apt 오타는 위에서 이미 실패로 잡았다
        if (!shown.get(c.apt.normalize('NFC'))?.has(id.toLowerCase())) fails.push(`/cases/apt/${c.apt}/: 자기 단지 사례 ${id} 가 빠졌다`);
      }
    }
  }
  return { fails, warns, notes, stats: { cases: cases.size, samples: sampleCount, photos: photoCount, apts: aptCount, distChecked } };
}

/** 임시 폴더에 작은 저장소 구조를 만든다 */
function fixture() {
  const root = mkdtempSync(path.join(tmpdir(), 'check-content-'));
  const w = (rel, text) => { mkdirSync(path.dirname(path.join(root, rel)), { recursive: true }); writeFileSync(path.join(root, rel), text); };
  const md = (id, apt, body, photos = ['01', '02']) => `---\nregion: 서울 강남\ncover: /media/cases/${id}/01.webp\n${apt ? `apt: "${apt}"\n` : ''}photos:\n${photos.map((n) => `  - file: /media/cases/${id}/${n}.webp\n    caption: "x"`).join('\n')}\ntitle: "${id}"\n---\n${body}\n`;
  w('src/content/site/case-log.json', JSON.stringify({ updated: '2026-01-01', records: [{ d: '2026-01-01', t: '설치', r: '서울 강남', apt: 'A', slug: 'a-dong' }, { d: '2026-01-02', t: '설치', r: '서울 강남', apt: 'B', slug: 'b-dong' }] }));
  w('src/content/cases/2026-01-01-A-설치.md', md('2026-01-01-A-설치', 'a-dong', '본문\n\n![사진](/media/cases/2026-01-01-A-설치/02.webp)'));
  w('src/content/cases/2026-01-02-B-설치.md', md('2026-01-02-B-설치', 'b-dong', '본문\n\n![사진](/media/cases/2026-01-02-B-설치/02.webp)'));
  w('src/content/cases/sample-x.md', '---\nsample: true\n---\n샘플\n');
  for (const id of ['2026-01-01-A-설치', '2026-01-02-B-설치']) for (const n of ['01', '02']) w(`public/media/cases/${id}/${n}.webp`, `${id}-${n}`);
  const card = (id) => `<a class="bd-case-card" href="/cases/${id.toLowerCase()}/"><div class="bd-case-card__media"><img src="x" alt=""></div></a>`;
  const page = (...ids) => `<html><body><div class="apt__photos" data-astro-cid-x>${ids.map(card).join('')}</div><section class="apt__qa"></section></body></html>`;
  w('dist/cases/apt/a-dong/index.html', page('2026-01-01-A-설치'));
  w('dist/cases/apt/b-dong/index.html', page('2026-01-02-B-설치'));
  return { root, w, md, page, rm: () => rmSync(root, { recursive: true, force: true }) };
}

function selfcheck() {
  const fx = fixture();
  const A = '2026-01-01-A-설치', B = '2026-01-02-B-설치';
  const run = () => check(fx.root, { dist: 'force' });
  const expectFail = (label, re) => { const r = run(); assert.ok(r.fails.some((x) => re.test(x)), `${label}: 실패가 나와야 한다 ${re} — 실제 ${JSON.stringify(r.fails)}`); };
  try {
    const ok = run();
    assert.deepEqual(ok.fails, [], '정상 픽스처는 통과해야 한다');
    assert.equal(ok.stats.cases, 2); assert.equal(ok.stats.samples, 1); assert.equal(ok.stats.distChecked, true);
    assert.deepEqual(photoLinks(fx.page(A, B)), [A.toLowerCase(), B.toLowerCase()], '중첩된 div 안의 링크를 모두 읽는다');

    const orig = readFileSync(path.join(fx.root, `src/content/cases/${A}.md`), 'utf8');
    const put = (text) => fx.w(`src/content/cases/${A}.md`, text);
    put(orig.replace('apt: "a-dong"', 'apt: "a-dongg"')); expectFail('apt 오타', /case-log\.json 의 slug 에 없다/);
    put(orig); fx.w(`dist/cases/apt/a-dong/index.html`, fx.page());
    expectFail('자기 단지 사례 빠짐', /자기 단지 사례 .* 빠졌다/);
    fx.w('dist/cases/apt/a-dong/index.html', fx.page(A, B)); expectFail('다른 단지 사례 붙음', /다른 단지 사례가 붙었다 2026-01-02-B-설치/);
    fx.w('dist/cases/apt/a-dong/index.html', fx.page(A)); assert.deepEqual(run().fails, [], '되돌리면 다시 통과');
    rmSync(path.join(fx.root, `public/media/cases/${A}/02.webp`)); expectFail('사진 파일 없음', /사진 파일이 없다/);
    fx.w(`public/media/cases/${A}/02.webp`, `${A}-02`);
    put(orig.replace('cover: /media/cases/' + A + '/01.webp', 'cover: /media/cases/' + A + '/02.webp')); expectFail('cover≠photos[0]', /photos\[0\] 와 다르다/);
    put(orig.replace('02.webp)', '09.webp)')); expectFail('본문 사진이 photos 밖', /본문 사진이 photos 에 없다/);
    put(orig.replace('02.webp)', '01.webp)')); expectFail('대표 사진 본문 중복', /대표 사진이 본문에 또 나온다/);
    put(orig); fx.w(`public/media/cases/${B}/02.webp`, `${A}-02`);   // 같은 바이트 → 경고만
    const dup = run(); assert.deepEqual(dup.fails, []); assert.equal(dup.warns.length, 1, '같은 사진은 경고만');
    fx.w(`public/media/cases/${B}/02.webp`, `${B}-02`);
    rmSync(path.join(fx.root, 'dist'), { recursive: true }); expectFail('dist 없음(--dist)', /dist\/cases\/apt 가 없다/);
    assert.ok(check(fx.root).notes.length === 1 && check(fx.root).fails.length === 0, 'dist 가 없으면 자동 모드는 건너뛴다');
    console.log('check-content selfcheck: 13/13 passed');
  } finally { fx.rm(); }
}

const args = process.argv.slice(2);
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (args.includes('--selfcheck')) selfcheck();
  else {
    const ri = args.indexOf('--root');
    const root = ri >= 0 ? path.resolve(args[ri + 1]) : path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
    const r = check(root, { dist: args.includes('--no-dist') ? 'off' : args.includes('--dist') ? 'force' : 'auto' });
    for (const n of r.notes) console.log(`참고: ${n}`);
    for (const w of r.warns) console.log(`경고: ${w}`);
    if (r.fails.length) {
      console.error(`content check 실패 ${r.fails.length}건`);
      for (const f of r.fails.slice(0, 40)) console.error(`  FAIL ${f}`);
      if (r.fails.length > 40) console.error(`  … 외 ${r.fails.length - 40}건`);
      process.exitCode = 1;
    } else {
      const s = r.stats;
      console.log(`content check 통과 — 사례 ${s.cases}건(샘플 ${s.samples} 제외) · 사진 ${s.photos}장 · apt ${s.apts}건 · 단지 페이지 ${s.distChecked ? '검사함' : '검사 안 함'} · 경고 ${r.warns.length}건`);
    }
  }
}
