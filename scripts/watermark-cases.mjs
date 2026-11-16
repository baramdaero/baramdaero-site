/**
 * 시공사례 사진에 워터마크를 넣는다 — 가운데, 사진 폭의 28%, 옅게(2026-10-13 대표 결정).
 *
 *   node scripts/watermark-cases.mjs                 public/media/cases 아래에서 아직 안 찍힌 사진 전부
 *   node scripts/watermark-cases.mjs <폴더> [<폴더>…]  그 사례 폴더만(public/media/cases/<폴더>)
 *   node scripts/watermark-cases.mjs --check          안 찍힌 사진이 있으면 목록을 내고 1 로 끝난다(배포 전 확인용)
 *   node scripts/watermark-cases.mjs --selfcheck
 *
 * - 한 번 찍은 파일은 다시 찍지 않는다: 파일 EXIF 의 Software 에 표시(MARK)를 남기고, 표시가 있으면 건너뛴다.
 * - 로고는 src/assets/logo/baramdaero-wide-reverse.svg(흰색). 로고가 놓일 자리가 아주 밝으면(밝기 185 이상, 전체의 5%쯤)
 *   흰 로고가 묻히므로 같은 모양의 먹색(--br-ink) 한 색 로고를 쓴다.
 * - 워터마크 없는 원본은 git 기록에 있다(이 스크립트를 처음 돌린 커밋의 부모). 방식을 바꿀 때는 원본에서 다시 찍는다.
 */
import sharp from 'sharp';
import { readFile, readdir, writeFile, rename, stat } from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';

const ROOT = path.resolve(new URL('..', import.meta.url).pathname);
const DIR = path.join(ROOT, 'public/media/cases');
const MARK = 'baramdaero-wm1';
const WIDTH = 0.28, OPACITY_WHITE = 0.24, OPACITY_INK = 0.2, BRIGHT = 185, INK = '#0b2027';

let logos;   // { white, ink } SVG 글
async function loadLogos() {
  if (!logos) {
    const white = await readFile(path.join(ROOT, 'src/assets/logo/baramdaero-wide-reverse.svg'), 'utf8');
    logos = { white, ink: white.replace(/fill="#[0-9A-Fa-f]{6}"/g, `fill="${INK}"`) };
  }
  return logos;
}
async function logoPng(svg, width, opacity) {
  const { data, info } = await sharp(Buffer.from(svg), { density: 600 }).resize({ width }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  for (let i = 3; i < data.length; i += 4) data[i] = Math.round(data[i] * opacity);
  return { buf: await sharp(data, { raw: info }).png().toBuffer(), w: info.width, h: info.height };
}
export async function isMarked(file) {
  const { exif } = await sharp(file).metadata();
  return !!exif && exif.includes(MARK);
}
/** 사진 한 장(버퍼) → 워터마크를 넣은 webp 버퍼. tone: 'white' | 'ink' */
export async function watermark(input) {
  const { white, ink } = await loadLogos();
  const { width: W, height: H } = await sharp(input).metadata();
  const lw = Math.round(W * WIDTH);
  const probe = await logoPng(white, lw, 1);
  const left = Math.round((W - probe.w) / 2), top = Math.round((H - probe.h) / 2);
  const lum = (await sharp(input).extract({ left, top, width: probe.w, height: probe.h }).greyscale().stats()).channels[0].mean;
  const tone = lum >= BRIGHT ? 'ink' : 'white';
  const logo = tone === 'ink' ? await logoPng(ink, lw, OPACITY_INK) : await logoPng(white, lw, OPACITY_WHITE);
  const buf = await sharp(input).composite([{ input: logo.buf, left, top }]).withExif({ IFD0: { Software: MARK } }).webp({ quality: 84, effort: 5 }).toBuffer();
  return { buf, tone, width: W, height: H };
}

async function files(folders) {
  const dirs = folders.length ? folders : (await readdir(DIR)).filter((d) => !d.startsWith('.'));
  const out = [];
  for (const d of dirs) {
    const p = path.join(DIR, d);
    if (!(await stat(p).catch(() => null))?.isDirectory()) { if (folders.length) throw new Error(`폴더 없음: ${d}`); continue; }
    for (const f of (await readdir(p)).sort()) if (f.endsWith('.webp')) out.push(path.join(p, f));
  }
  return out;
}

async function selfcheck() {
  const gray = (v) => sharp({ create: { width: 1000, height: 750, channels: 3, background: { r: v, g: v, b: v } } }).webp().toBuffer();
  const a = await watermark(await gray(120)); assert.equal(a.tone, 'white');
  const b = await watermark(await gray(230)); assert.equal(b.tone, 'ink', '아주 밝은 자리는 먹색 로고');
  const m = await sharp(a.buf).metadata(); assert.equal(m.width, 1000); assert.equal(m.height, 750); assert.ok(m.exif.includes(MARK), '찍은 표시가 남아야 한다');
  // 가운데는 바뀌고 구석은 그대로다
  const px = async (buf, x, y) => (await sharp(buf).extract({ left: x, top: y, width: 4, height: 4 }).greyscale().stats()).channels[0].mean;
  assert.ok(Math.abs((await px(a.buf, 10, 10)) - 120) < 3, '구석은 그대로');
  const band = (await sharp(a.buf).extract({ left: 360, top: 345, width: 280, height: 60 }).greyscale().stats()).channels[0];
  assert.ok(band.max > 135, '가운데에 로고가 보여야 한다');
  console.log('watermark selfcheck: 5/5 passed');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  if (args[0] === '--selfcheck') await selfcheck();
  else if (args[0] === '--check') {
    const miss = []; for (const f of await files([])) if (!(await isMarked(f))) miss.push(path.relative(DIR, f));
    console.log(miss.length ? `워터마크 없는 사진 ${miss.length}장\n` + miss.slice(0, 40).join('\n') : '모든 사례 사진에 워터마크가 있다');
    process.exit(miss.length ? 1 : 0);
  } else {
    const list = await files(args); const n = { done: 0, skip: 0, ink: 0 }; let before = 0, after = 0;
    for (const f of list) {
      if (await isMarked(f)) { n.skip++; continue; }
      const src = await readFile(f); const r = await watermark(src);
      await writeFile(f + '.tmp', r.buf); await rename(f + '.tmp', f);
      n.done++; if (r.tone === 'ink') n.ink++; before += src.length; after += r.buf.length;
    }
    console.log(`사진 ${list.length}장 — 찍음 ${n.done}(먹색 ${n.ink}) · 이미 찍힘 ${n.skip} · 용량 ${(before / 1e6).toFixed(1)}MB → ${(after / 1e6).toFixed(1)}MB`);
  }
}
