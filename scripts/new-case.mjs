/**
 * 현장 사진 폴더 → 시공사례 초안(md + webp).
 *
 *   node scripts/new-case.mjs <폴더> [--publish]
 *
 * 폴더 이름이 메타데이터다 — `날짜_지역_공간_브랜드_구분_대수`
 *   예) 2026-09-22_경기부천_사무실_LG_세척_4대
 * 폴더 안 사진은 파일명 순서대로 photos[] 가 된다. 파일명에 `-` 뒤 문구를 적으면 캡션이 된다.
 *   예) 01-작업 전 흡입 그릴.jpg  →  캡션 "작업 전 흡입 그릴"
 *
 * 기본은 **초안**이다: frontmatter 에 `sample: true` 가 붙어 사이트에 나오지 않는다.
 * 사람이 사진을 눈으로 확인한 뒤 그 줄을 지워야 공개된다 — src/content/cases/README.txt 의
 * 개인정보 규칙(현관문·문패·번호판·사람 금지, 단지명 금지)은 기계가 판정할 수 없다.
 * `--publish` 는 그 확인을 이미 했다는 뜻으로 sample 줄을 빼고 쓴다.
 */
import { readdir, mkdir, writeFile, access } from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import sharp from 'sharp';

const ROOT = new URL('..', import.meta.url).pathname;
const PHOTO_W = 1280;                       // 사례 사진 가로 상한 — 본문 폭(1120)보다 한 단계 위
const TYPES = new Set(['설치', '세척', '복원']);
// 현장 사진은 카톡방에서 '단지명 c동 2409호' 로 온다 — 그 습관이 폴더 이름으로 따라오면 사이트에 실린다.
// region 은 시·구까지만(README.txt 개인정보 규칙). 기계가 막을 수 있는 건 여기까지다.
const BANNED = /\d+\s*동|\d+\s*호|파크|캐슬|자이|래미안|푸르지오|힐스테이트|더샵|트리폴리스|아란티움|스카이|센트럴|리버뷰/;
const IMG = /\.(jpe?g|png|webp|heic)$/i;

/** `2026-09-22_경기부천_사무실_LG_세척_4대` → 레코드 머리말 */
export function parseFolder(name) {
  const [date, region, space, brand, type, units] = name.split('_');
  assert.match(date ?? '', /^\d{4}-\d{2}-\d{2}$/, `폴더 이름 앞은 날짜여야 한다: ${name}`);
  assert.ok(TYPES.has(type), `구분은 ${[...TYPES].join('|')} 중 하나여야 한다: ${type}`);
  const n = Number(String(units ?? '').replace(/[^0-9]/g, ''));
  assert.ok(n > 0, `대수를 읽지 못했다: ${units}`);
  // 지역은 시·구까지만 — 붙여 쓴 것을 띄운다 (경기부천 → 경기 부천)
  const bad = [region, space, brand].find((v) => BANNED.test(v ?? ''));
  assert.ok(!bad, `단지명·동호수는 쓸 수 없다(시·구까지만): ${bad} — src/content/cases/README.txt`);
  const r = /^(서울|경기|인천)(.+)$/.exec(region ?? '');
  return {
    date, region: r ? `${r[1]} ${r[2]}` : region, space, brand, type, units: n,
    // 지역까지 넣는다 — 같은 날 같은 공간 유형 현장이 둘이면 이름이 겹쳐 두 번째를 거절하던 것
    slug: `${date}-${region ?? ''}-${(space ?? '').toLowerCase()}-${type}`.replace(/[^\w가-힣-]/g, ''),
  };
}

/** `01-작업 전 흡입 그릴.jpg` → `작업 전 흡입 그릴` (없으면 빈 캡션) */
export const captionOf = (file) =>
  path.basename(file, path.extname(file)).replace(/^\d+\s*[-_.]?\s*/, '').trim();

const yaml = (v) => (/^[\w가-힣 .-]+$/.test(v) ? v : JSON.stringify(v));

export function toMarkdown(meta, photos, { publish = false } = {}) {
  const head = [
    `region: ${yaml(meta.region)}`,
    `space: ${yaml(meta.space)}`,
    `brand: ${yaml(meta.brand)}`,
    `type: ${meta.type}`,
    `units: ${meta.units}`,
    `date: ${meta.date}`,
    photos[0] ? `cover: ${photos[0].file}` : '',
    publish ? '' : 'sample: true',
    photos.length ? 'photos:' : '',
    ...photos.map((p) => `  - file: ${p.file}\n    caption: ${yaml(p.caption)}`),
  ].filter(Boolean);
  const body = publish
    ? '작업 기록입니다. 사진은 찍은 순서대로입니다.\n'
    : [
        '> 초안입니다. 사진을 확인하고 아래를 채운 뒤 frontmatter 의 `sample: true` 줄을 지우면 공개됩니다.',
        '> 확인할 것: 현관문·문패·차량 번호판·사람이 찍히지 않았는지, 단지명이 드러나지 않는지.',
        '',
        '- 작업 전 상태:',
        '- 분해 범위:',
        '- 세척 후 확인:',
      ].join('\n') + '\n';
  return `---\n${head.join('\n')}\n---\n\n${body}`;
}

async function main() {
  const [dir, ...flags] = process.argv.slice(2);
  if (!dir) {
    console.error('사용법: node scripts/new-case.mjs <사진 폴더> [--publish]');
    process.exit(1);
  }
  const publish = flags.includes('--publish');
  const meta = parseFolder(path.basename(path.resolve(dir)));
  const outDir = path.join(ROOT, 'public/media/cases', meta.slug);
  const mdPath = path.join(ROOT, 'src/content/cases', `${meta.slug}.md`);
  await access(mdPath).then(
    () => { throw new Error(`이미 있다: ${mdPath} — 덮어쓰지 않는다`); },
    () => {},
  );

  const files = (await readdir(dir)).filter((f) => IMG.test(f)).sort();
  assert.ok(files.length, '사진이 없다');
  await mkdir(outDir, { recursive: true });

  const photos = [];
  for (const [i, f] of files.entries()) {
    const out = `${String(i + 1).padStart(2, '0')}.webp`;
    await sharp(path.join(dir, f))
      .rotate()                                  // EXIF 방향을 굽는다 — 안 하면 세로 사진이 눕는다
      .resize({ width: PHOTO_W, withoutEnlargement: true })
      .webp({ quality: 82 })
      .toFile(path.join(outDir, out));
    photos.push({ file: `/media/cases/${meta.slug}/${out}`, caption: captionOf(f) });
  }

  await writeFile(mdPath, toMarkdown(meta, photos, { publish }));
  console.log(`${mdPath}  사진 ${photos.length}장 → ${path.relative(ROOT, outDir)}`);
  if (!publish) console.log('초안이다. 사진을 확인하고 `sample: true` 줄을 지우면 공개된다.');
}

/** 자체 점검 — 폴더 이름과 캡션 규칙이 깨지면 여기서 걸린다 */
function selfcheck() {
  const m = parseFolder('2026-09-22_경기부천_사무실_LG_세척_4대');
  assert.equal(m.region, '경기 부천');
  assert.equal(m.units, 4);
  assert.equal(m.type, '세척');
  assert.equal(captionOf('01-작업 전 흡입 그릴.jpg'), '작업 전 흡입 그릴');
  assert.equal(captionOf('02.jpg'), '');
  assert.match(toMarkdown(m, [{ file: '/media/cases/x/01.webp', caption: '작업 전' }]), /sample: true/);
  assert.doesNotMatch(toMarkdown(m, [], { publish: true }), /sample: true/);
  assert.throws(() => parseFolder('경기부천_사무실_LG_세척_4대'), /날짜/);
  assert.throws(() => parseFolder('2026-09-22_경기부천_사무실_LG_청소_4대'), /구분/);
  assert.throws(() => parseFolder('2026-09-22_서울송도아이파크_아파트_LG_설치_5대'), /단지명/);
  assert.throws(() => parseFolder('2026-09-22_경기하남_아파트2504동_LG_설치_5대'), /단지명/);
  assert.equal(parseFolder('2026-09-22_경기하남_아파트_삼성_설치_5대').space, '아파트');   // 정상값은 통과해야 한다
  console.log('new-case selfcheck: 10/10 passed');
}

if (process.argv.includes('--selfcheck')) selfcheck();
else await main();
