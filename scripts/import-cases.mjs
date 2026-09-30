// hermes 사례 글 → 사이트 사례 파일. 데밍 '통과'인 것만 가져오고 sample: true 를 강제한다(공개는 사람이 줄을 지운다).
// 이미 공개(sample 없음)된 사이트 파일은 덮어쓰지 않는다. 사이트 FAQ 를 hermes 참고 자료로 보낸다.
// 사용: npm run case:import
import { readdirSync, readFileSync, writeFileSync, existsSync, copyFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const HW = join(homedir(), 'HermesWork/baramdaero');
const OUT = join(HW, 'out');
const DEST = 'src/content/cases';

copyFileSync('src/content/site/faq.json', join(HW, 'ref/site-faq.json'));

for (const f of readdirSync(OUT).filter((f) => /^\d{4}-\d{2}-\d{2}-.+\.md$/.test(f))) {
  const id = f.slice(0, -3);
  const review = join(OUT, `review-${f}`);
  if (!existsSync(review) || !/판정:\s*통과/.test(readFileSync(review, 'utf8'))) { console.log('건너뜀(검수 전)', id); continue; }
  const dest = join(DEST, f);
  if (existsSync(dest) && !/^sample: true$/m.test(readFileSync(dest, 'utf8'))) { console.log('건너뜀(공개됨)', id); continue; }
  let md = readFileSync(join(OUT, f), 'utf8');
  if (!/^title:/m.test(md)) { console.log('건너뜀(옛 짧은 형식)', id); continue; }
  // 480~540 같은 범위의 ~ 가 GFM 취소선으로 읽히지 않게 이스케이프
  const end = md.indexOf('\n---', 4) + 4; // 본문만 (frontmatter YAML 은 그대로)
  md = md.slice(0, end) + md.slice(end).replace(/(?<!\\)~/g, '\\~');
  if (!/^sample: true$/m.test(md)) md = md.replace(/^---\n/, '---\nsample: true\n');
  writeFileSync(dest, md);
  console.log('가져옴', id);
}
