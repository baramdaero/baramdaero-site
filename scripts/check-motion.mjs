// motion.ts 회귀 검사 — Node 표준 라이브러리만 사용 (node:vm / node:assert / node:fs / node:module)
// 실행: node scripts/check-motion.mjs   (Node 22.13+ 권장: module.stripTypeScriptTypes)
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const src = readFileSync(new URL('../src/scripts/motion.ts', import.meta.url), 'utf8');
const code = stripTypeScriptTypes(src);

function makeEnv({ ctorThrows = false, observeThrows = false, reduced = false, io = true } = {}) {
  const withClasses = (o) => {
    o.classes = new Set();
    o.classList = { add: (c) => o.classes.add(c), remove: (c) => o.classes.delete(c), contains: (c) => o.classes.has(c) };
    return o;
  };
  const el = (text = '') => withClasses({ textContent: text, dataset: {}, style: {}, parentElement: null });
  const html = withClasses({});
  const reveals = [el(), el()];
  const parent = { querySelectorAll: () => reveals };
  reveals.forEach((r) => { r.parentElement = parent; });
  const num = el('1,200');
  num.dataset.countup = '1200';
  // 화면에 찍힌 값을 순서대로 남긴다 — 카운트업이 어떤 값을 지나갔는지 본다
  const texts = []; let shown = '1,200';
  Object.defineProperty(num, 'textContent', { get: () => shown, set: (v) => { shown = v; texts.push(v); } });
  const observers = [], observed = [], raf = [];
  class IO {
    constructor(cb) { if (ctorThrows) throw new Error('IO ctor'); this.cb = cb; observers.push(this); }
    observe(t) { if (observeThrows) throw new Error('IO observe'); observed.push(t); }
    unobserve() {}
  }
  const ctx = {
    matchMedia: () => ({ matches: reduced }),
    requestAnimationFrame: (fn) => raf.push(fn),
    performance: { now: () => 0 },
    document: {
      documentElement: html,
      querySelectorAll: (s) => (s === '.br-reveal' ? reveals : s === '[data-countup]' ? [num] : []),
    },
  };
  if (io) ctx.IntersectionObserver = IO;
  ctx.window = ctx;
  return { ctx, html, reveals, num, texts, observers, observed, raf };
}
const run = (e) => vm.runInNewContext(code, e.ctx, { filename: 'motion.ts' });
// step = 프레임 간격(ms). 끝난 시각을 돌려준다
const drainRaf = (e, step = 400) => { let now = 0; while (e.raf.length) { const fn = e.raf.shift(); now += step; fn(now); } return now; };

// 1) IO 생성자 예외 → 예외 전파 없음, br-js 없음(콘텐츠 보임)
{ const e = makeEnv({ ctorThrows: true }); assert.doesNotThrow(() => run(e)); assert.equal(e.html.classes.has('br-js'), false, 'ctor throw: br-js must not remain'); }
// 2) observe 예외 → 동일
{ const e = makeEnv({ observeThrows: true }); assert.doesNotThrow(() => run(e)); assert.equal(e.html.classes.has('br-js'), false, 'observe throw: br-js must not remain'); }
// 3) 정상 경로 → br-js 적용, stagger, 교차 시 br-in, 카운트업 종료 시 마크업 원문
{
  const e = makeEnv(); run(e);
  assert.ok(e.html.classes.has('br-js'));
  assert.equal(e.observed.length, 3); // reveals 2 + countup 1
  assert.equal(e.reveals[1].style.transitionDelay, '60ms');
  e.observers[0].cb([{ isIntersecting: true, target: e.reveals[0] }]);
  assert.ok(e.reveals[0].classes.has('br-in'));
  e.observers[1].cb([{ isIntersecting: true, target: e.num }]);
  // 60fps(16ms)로 돌린다 — 스프링이 0에서 시작해 목표를 넘지 않고 올라가다 상한(6초) 전에 스스로 멎어야 한다
  const end = drainRaf(e, 16);
  assert.equal(e.num.textContent, '1,200');
  const vals = e.texts.slice(0, -1).map((t) => Number(String(t).replace(/,/g, ''))); // 마지막은 되돌린 마크업 원문
  assert.ok(vals.length > 30, 'countup must pass through intermediate values');
  assert.equal(vals[0], 0, 'countup starts at 0');
  assert.ok(vals.every((v, i) => v <= 1200 && (i === 0 || v >= vals[i - 1])), 'countup never overshoots and never goes down');
  assert.ok(end < 4000, `countup must settle on its own, not by the 6s cap (ended at ${end}ms)`);
}
// 3-2) 프레임이 드문드문 와도(400ms 간격 — 한 프레임에 64ms 까지만 적분해 스프링이 못 멎는다) 6초 상한에서 최종값으로 끝난다
{
  const e = makeEnv(); run(e);
  e.observers[1].cb([{ isIntersecting: true, target: e.num }]);
  const end = drainRaf(e, 400);
  assert.equal(e.num.textContent, '1,200');
  assert.equal(end, 6800, 'sparse frames must end by the 6s cap (first frame 400ms + 6000ms, next frame)');
}
// 4) 카운트업 도중 예외(두 번째 프레임에서 포맷터 고장) → 중간값 대신 최종 정적 콘텐츠 복원, 예외 전파 없음
{
  const e = makeEnv();
  vm.runInNewContext('let n = 0; Number.prototype.toLocaleString = function () { if (++n > 1) throw new Error("fmt"); return String(this); };', e.ctx);
  run(e);
  e.observers[1].cb([{ isIntersecting: true, target: e.num }]);
  assert.doesNotThrow(() => drainRaf(e));
  assert.equal(e.num.textContent, '1,200', 'failed animation must restore markup text');
}
// 5) IO 미지원 → 아무 것도 하지 않음
{ const e = makeEnv({ io: false }); assert.doesNotThrow(() => run(e)); assert.equal(e.html.classes.has('br-js'), false); assert.equal(e.observers.length, 0); }
// 6) reduced motion → 리빌 옵저버만 생성, stagger 없음, 카운트업 옵저버 없음
{ const e = makeEnv({ reduced: true }); run(e); assert.ok(e.html.classes.has('br-js')); assert.equal(e.observers.length, 1); assert.equal(e.reveals[1].style.transitionDelay, undefined); }

console.log('motion.ts regression: 7/7 passed');
