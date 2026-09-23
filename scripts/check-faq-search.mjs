// /faq/ 묻고 답하기 회귀 검사 — 실제 faq.json(live 문항)으로 고르는 규칙(faq-rank.ts)을 돌린다.
// 실행: npm run test:faq   (저장소 루트에서. Node 22.13+: module.stripTypeScriptTypes)
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import assert from 'node:assert/strict';

const load = (rel) => import('data:text/javascript,' + encodeURIComponent(
  stripTypeScriptTypes(readFileSync(new URL(rel, import.meta.url), 'utf8'))));
const { decideFaq, normFaq } = await load('../src/scripts/faq-rank.ts');
const { loadFaqPage, faqPlainText } = await load('../src/lib/faq.ts');

// 페이지의 data-* 와 같은 값 (faq/index.astro 참고)
const docs = loadFaqPage().map((f) => ({
  id: f.id, q: normFaq(f.q), kw: normFaq(f.keywords.join(' ')), hook: normFaq(f.hook), body: normFaq(faqPlainText(f.a)),
}));
const has = (id) => docs.some((d) => d.id === id);
const say = (d) => JSON.stringify(d);

// 1) 문항 질문을 그대로 물으면 그 문항으로 답해야 한다
const selfMiss = docs.filter((d) => { const r = decideFaq(loadFaqPage().find((f) => f.id === d.id).q, docs); return !(r.kind === 'answer' && r.id === d.id); });
assert.deepEqual(selfMiss.map((d) => d.id), [], '자기 질문으로 자기 답이 안 나오는 문항');

// 2) 고객 말투 → 기대 문항. id 가 없으면(바뀌었거나 hold) 조용히 건너뛰지 말고 실패한다
const cases = [
  ['에어컨에서 냄새가 나요', 'faq-smell'],
  ['필터 청소 얼마나 자주', 'faq-filter-cycle'],
  ['추가 비용', 'faq-extra-cost'],
  ['분해 세척 일반 세척 차이', 'faq-deep-vs-basic'],
  ['살고 있는 집인데 세척 가능한가요', 'faq-clean-live-in'], // 군말 하나로 AND 가 깨져도 후보가 하나면 답한다
  ['에어컨에서 물이 떨어져요', 'faq-drip-ceiling'],
  ['천장형 에어컨에서 물이 떨어져요', 'faq-drip-ceiling'],
  // 실제 수요 상위 질문(09-23 수집) — 긴 문장에 딸린 말이 있어도 답한다
  ['필터는 어떻게 빼서 씻나요? 물로 씻으면 안 되는 필터도 있나요?', 'faq-filter-wash'],
];
for (const [q, id] of cases) {
  assert.ok(has(id), `검사 사례의 문항 ${id} 가 live 에 없다 — 사례를 고치거나 지운다`);
  const r = decideFaq(q, docs);
  assert.ok(r.kind === 'answer' && r.id === id, `"${q}" → ${id} 기대, 실제 ${say(r)}`);
}

// 2-0) 확답까지는 아니어도 첫 후보로는 나와야 하는 질문
for (const [q, id] of [['같은 제품인데 업체마다 견적이 수십만 원씩 차이 나는 이유가 뭔가요?', 'faq-quote-gap'],
  ['온도를 올리거나 송풍일 때만 냄새가 나요', 'faq-smell-fan-mode'],
  ['에어컨 청소 얼마나 자주', 'faq-clean-cycle'],
  ['우리 집 평수면 시스템에어컨을 몇 대, 몇 평형으로 넣어야 하나요?', 'faq-capacity-rooms']]) {
  const r = decideFaq(q, docs);
  assert.ok((r.kind === 'answer' && r.id === id) || (r.kind === 'pick' && r.ids[0] === id), `"${q}" → ${id} 가 답이나 첫 후보여야, 실제 ${say(r)}`);
}

// 2-1) 낱자·기호·따옴표가 붙어도 붙지 않은 말과 같은 결과
for (const [a, b] of [['냄새ㅠㅠ', '냄새'], ['“냄새”', '냄새'], ['에어컨 냄새…', '에어컨 냄새'], ['실외기실 창(루버·갤러리창)', '실외기실 창 루버 갤러리창']]) {
  assert.deepEqual(decideFaq(a, docs), decideFaq(b, docs), `"${a}" 와 "${b}" 가 다르게 나온다`);
}

// 3) 틀린 답을 자신 있게 내놓지 않는다 — 누수 질문에 보양 답이 나오던 사례, 군말뿐인 질문
// 금액을 묻는 말에 금액 없는 견적 차이 답, 세척 뒤 문제에 '바로 쓰셔도 됩니다' 답을 못 박지 않는다(09-23 커버리지 검수)
for (const [q, wrong] of [['에어컨에서 물이 떨어져요', 'faq-curing'], ['천장형 에어컨에서 물이 떨어져요', 'faq-curing'],
  ['설치비 얼마', 'faq-quote-gap'], ['시스템에어컨 설치비', 'faq-quote-gap'], ['청소비 얼마', 'faq-quote-gap'],
  ['세척 후 냄새', 'faq-clean-after-use'], ['청소하고 나서 물이 떨어져요', 'faq-clean-after-use'],
  ['청소비 얼마예요', 'faq-tenant-cost'],                // 값을 묻는데 '누가 내나요' 답을 못 박지 않는다
  // 답이 없는 질문(건강·천장 얼룩)은 가까운 문항을 못 박지 않는다 — 없는 말도 질문의 일부로 친다
  ['에어컨 곰팡이 냄새를 계속 맡으면 아이 건강에 문제가 되나요?', 'faq-smell'],
  ['에어컨 주변 천장 벽지가 젖고 곰팡이가 폈어요. 결로인가요, 누수인가요?', 'faq-curing']]) {
  const r = decideFaq(q, docs);
  assert.ok(!(r.kind === 'answer' && r.id === wrong), `"${q}" → ${wrong} 답 금지, 실제 ${say(r)}`);
}
for (const q of ['왜', '어떻게', '되나요?', '뭐가']) {
  assert.notEqual(decideFaq(q, docs).kind, 'answer', `"${q}" 는 군말뿐 — 답을 못 박으면 안 된다`);
}

// 4) 고르게 할 때 본문에 스친 문항은 후보에서 뺀다
{
  const r = decideFaq('실외기 소리', docs);
  assert.ok(!(r.kind === 'pick' && r.ids.includes('faq-extra-cost')), `실외기 소리 → 추가비용 후보 금지, 실제 ${say(r)}`);
}

// 5) 흔한 말만 → 고르게, 모르는 말·빈 말 → 답 없음
assert.equal(decideFaq('에어컨', docs).kind, 'pick');
assert.equal(decideFaq('ㅁㄴㅇㄹ', docs).kind, 'none');
assert.equal(decideFaq('   ', docs).kind, 'none');

console.log(`faq 검색 검사 통과 — live ${docs.length}문항`);
