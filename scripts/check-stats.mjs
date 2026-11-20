// dist/stats.json 이 화면에 보이는 숫자와 같은지 본다 — 빌드 뒤: node scripts/check-stats.mjs [dist 폴더]
// 쇼핑몰 홈이 이 파일을 읽어 숫자를 채우므로, 화면과 갈라지면 쇼핑몰에 틀린 숫자가 나간다.
import fs from 'node:fs';
import assert from 'node:assert/strict';

const dist = process.argv[2] || 'dist';
const read = (p) => fs.readFileSync(`${dist}/${p}`, 'utf8');
const s = JSON.parse(read('stats.json'));

assert.deepEqual(Object.keys(s).sort(), ['photoCases', 'recentYearUnits'], 'stats.json 칸 이름');
const m = read('cases/index.html').match(/data-list-count[^>]*>([\d,]+)건/);
assert.ok(m, '/cases/ 의 사진 사례 숫자를 못 찾음');
assert.equal(s.photoCases, Number(m[1].replace(/,/g, '')), 'photoCases ≠ /cases/ 사진 사례');
assert.ok(read('index.html').includes(s.recentYearUnits.toLocaleString('en-US')), 'recentYearUnits 가 홈 실적에 없음');
console.log(`stats.json 통과: 사진 사례 ${s.photoCases}건 · 최근 1년 ${s.recentYearUnits}대`);
