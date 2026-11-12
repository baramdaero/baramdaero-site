// 누름·바람결(src/scripts/press.ts) 회귀 검사 — 실행: npm run test:press
// 브라우저 없이 가짜 window 로 돌린다(check-motion.mjs 와 같은 방식). 손맛 자체는 화면에서 본다 — 여기서는 규칙만 지킨다.
import { readFileSync, readdirSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const root = new URL('../src/', import.meta.url);
const code = stripTypeScriptTypes(readFileSync(new URL('scripts/press.ts', root), 'utf8')).replace(/^export /gm, '');

function makeEnv({ reduced = false } = {}) {
  const handlers = {}, calls = [], classes = [], timers = [];
  let now = 1000, drawn;   // drawn: 눌림 모션이 실제로 그려진 시간(ms). 비우면 '다 그려짐'
  const html = { classList: { add: (c) => classes.push(c) } };
  // o: is(이 요소가 무엇인지 — 선택자 낱개 목록, 비우면 button) · display · parent
  // 가짜 요소는 자기가 무엇인지만 안다. 맞는지는 press.ts 가 넘긴 선택자를 쉼표로 갈라 견준다 — SEL · OFF · GLOW 에서 하나가 빠지거나 바뀌면 여기서 걸린다.
  // 글자 그대로 견준다: 뜻이 같아도 따옴표·공백을 바꾸면 실패한다(그때는 아래 is 의 글자를 같이 고친다 — 조용히 통과하는 쪽보다 낫다)
  const hit = (is) => (sel) => sel.split(/,\s*(?![^()]*\))/).some((s) => is.includes(s.trim()));
  const el = (w, h, o = {}) => ({
    w, h, on: {},
    addEventListener(t, fn) { this.on[t] = fn; },
    removeEventListener(t) { delete this.on[t]; },
    parentElement: o.parent,
    matches: hit(o.is || ['button']),
    closest(sel) { for (let n = this; n; n = n.parentElement) if (n.matches(sel)) return n; return null; },
    getBoundingClientRect: () => ({ left: 0, top: 0, width: w, height: h }),
    animate(frames, opts) {
      const anim = { cancelled: false, cancel() { this.cancelled = true; }, get currentTime() { return drawn; } };
      calls.push({ el: this, frames, opts, anim });
      return anim;
    },
    display: o.display || 'block',
  });
  const ctx = {
    matchMedia: () => ({ matches: reduced }),
    performance: { now: () => now },
    addEventListener: (t, fn) => { (handlers[t] ||= []).push(fn); },
    getComputedStyle: (e) => e === html
      ? { getPropertyValue: (k) => ({ '--dur-spring': '600ms', '--dur-ui': '240ms', '--ease-spring': 'linear(0, 1)' })[k] || '' }
      : { display: e.display, opacity: '1', scale: 'none' },
    KeyframeEffect: class {},
    // 타이머는 손으로 돌린다(flush) — 터치 대기(HOLD)가 지난 뒤와 지나기 전을 따로 본다
    setTimeout: (fn) => timers.push(fn),
    clearTimeout: (id) => { if (id) timers[id - 1] = null; },
    document: { documentElement: html },
  };
  ctx.window = ctx;
  vm.runInNewContext(code, ctx, { filename: 'press.ts' });
  const fire = (type, ev = {}) => (handlers[type] || []).forEach((fn) => fn({ type, ...ev }));
  // 따로 주지 않으면 한가운데를 누른다
  const press = (target, pointerType = 'mouse', at = {}) => fire('pointerdown', { isPrimary: true, button: 0, pointerType, target, clientX: at.x ?? target.w / 2, clientY: at.y ?? target.h / 2 });
  const flush = () => { for (let i = 0; i < timers.length; i++) { const fn = timers[i]; timers[i] = null; fn?.(); } };
  return { ctx, calls, classes, el, fire, press, flush, tick: (ms) => { now += ms; }, draw: (ms) => { drawn = ms; } };
}
const last = (c) => c.frames.at(-1);

// 1. 깊이 — 작은 것은 0.96, 큰 것은 긴 변 기준 8px 까지만. 가장자리를 누르면 그만큼 덜 눌린다(줄어든 상자 밖에 포인터가 남지 않게)
{
  const e = makeEnv();
  assert.ok(e.classes.includes('br-press'), '스크립트가 돌면 html 에 표시를 남긴다(탭 번쩍임 끄기)');
  e.press(e.el(100, 40));
  assert.equal(last(e.calls[0]).scale, '0.96');
  assert.equal(e.calls[0].opts.fill, 'forwards', '누르고 있는 동안은 눌린 채로');
  e.press(e.el(400, 300));
  assert.equal(last(e.calls.at(-1)).scale, '0.98');
  e.press(e.el(100, 40), 'mouse', { x: 99 });
  assert.ok(Math.abs(Number(last(e.calls.at(-1)).scale) - 0.99) < 1e-9, '오른쪽 끝을 누르면 1% 만');
  e.press(e.el(100, 40), 'mouse', { y: 40 });
  assert.equal(last(e.calls.at(-1)).scale, '1', '맨 끝은 눌리지 않는다');
}
// 2. 뗄 때만 스프링 — 취소(스크롤·끌기)는 출렁임 없이 돌아온다
{
  const e = makeEnv();
  e.press(e.el(100, 40)); e.tick(200); e.fire('pointerup');
  assert.equal(e.calls[0].anim.cancelled, true, '앞 모션(눌림)은 끊고 이어 간다');
  assert.equal(e.calls[1].opts.duration, 600);
  assert.equal(e.calls[1].frames[0].easing, 'linear(0, 1)');
  assert.ok(!('fill' in e.calls[1].opts), '돌아온 뒤에는 아무것도 남기지 않는다');
  e.press(e.el(100, 40)); e.tick(200); e.fire('pointercancel');
  assert.equal(e.calls.at(-1).opts.duration, 240);
  assert.equal(e.calls.at(-1).frames[0].easing, 'ease-out');
  // 화면이 버벅여 눌림이 아직 안 그려졌는데 뗐다 — 시계로는 지났어도 처음부터 눌렸다 돌아온다
  e.draw(0); e.press(e.el(100, 40)); e.tick(200); e.fire('pointerup');
  assert.equal(e.calls.at(-1).opts.duration, 700);
  assert.equal(e.calls.at(-1).frames[1].scale, '0.96');
  e.draw(40); e.press(e.el(100, 40)); e.fire('pointerup');
  assert.equal(e.calls.at(-1).opts.duration, 660, '그려진 만큼만 뺀다');
}
// 3. 터치 — 스크롤을 시작한 손가락에는 반응하지 않고, 톡 치고 뗀 손가락에는 끝까지 눌렸다 돌아온다
{
  const e = makeEnv();
  e.press(e.el(300, 200), 'touch'); e.fire('pointercancel'); e.flush();
  assert.equal(e.calls.length, 0, '기다리는 동안 취소되면 아무 일도 없다(걸어 둔 눌림도 지운다)');
  e.press(e.el(100, 40), 'touch'); e.fire('pointerup'); e.flush();
  assert.equal(e.calls.length, 1);
  assert.equal(e.calls[0].opts.duration, 700);
  assert.equal(e.calls[0].frames[1].scale, '0.96');
  // 누른 채로 대기 시간이 지났다 — 눌렸다가, 떼면 스프링
  e.press(e.el(100, 40), 'touch'); e.flush();
  assert.equal(e.calls.length, 2);
  assert.equal(e.calls[1].opts.duration, 100);
  assert.equal(e.calls[1].opts.fill, 'forwards');
  e.fire('pointerdown', { isPrimary: false, button: 0, pointerType: 'touch', target: e.el(100, 40) });
  assert.equal(e.calls.length, 2, '둘째 손가락이 닿아도 첫 누름은 그대로');
  e.fire('pointerup', { isPrimary: false });
  assert.equal(e.calls.length, 2, '둘째 손가락이 뗀 것으로는 풀리지 않는다');
  e.fire('pointerup');
  assert.equal(e.calls.at(-1).opts.duration, 600);
}
// 4. 모션 줄이기 · 꺼진 버튼은 움직이지 않는다. 문장 속 글자 링크는 흐려진다
{
  const r = makeEnv({ reduced: true });
  r.press(r.el(100, 40)); r.fire('click'); r.ctx.gust([r.el(10, 10)]);
  assert.equal(r.calls.length, 0);
  const e = makeEnv();
  // 꺼진 것 셋과 누를 수 없는 상자는 안 눌린다
  for (const is of [['button', ':disabled'], ['a[href]', '[aria-disabled="true"]'], ['button', '[data-press="off"]'], ['div']]) e.press(e.el(100, 40, { is }));
  e.fire('pointerdown', { isPrimary: true, button: 2, pointerType: 'mouse', target: e.el(100, 40) });   // 오른쪽 버튼은 누름이 아니다
  assert.equal(e.calls.length, 0);
  e.press(e.el(60, 20, { is: ['a[href]'], display: 'inline' }));
  assert.equal(last(e.calls[0]).opacity, '0.6');
  // 누를 수 있는 것 넷은 전부 눌린다
  for (const s of ['a[href]', 'button', 'summary', '[data-press]']) {
    const t = e.el(100, 40, { is: [s] });
    e.press(t);
    assert.equal(e.calls.at(-1).el, t, `${s} 는 눌린다`);
  }
  // 누름은 대개 안쪽(글자 span · 아이콘)에 닿는다 — 감싼 단추가 눌린다
  const btn = e.el(100, 40);
  e.press(e.el(40, 16, { is: ['span'], parent: btn }));
  assert.equal(e.calls.at(-1).el, btn, '안쪽을 눌러도 감싼 단추가 눌린다');
}
// 5. 바람결 — 누른 직후(400ms 안)에 온 것만, 30ms 간격(9번째부터는 같이). 자리는 앞 12개만 움직이고 투명도는 전부
{
  const e = makeEnv();
  const kids = Array.from({ length: 13 }, () => e.el(10, 10));
  e.ctx.gust(kids);
  assert.equal(e.calls.length, 0, '누르지 않았으면 조용히 바뀐다');
  e.fire('click'); e.tick(100); e.ctx.gust(kids);
  const moves = e.calls.filter((c) => 'translate' in c.frames[0]);
  assert.deepEqual(moves.map((c) => c.opts.delay), [0, 30, 60, 90, 120, 150, 180, 210, 240, 240, 240, 240]);
  assert.equal(e.calls.length, 25, '자리(스프링) 12 + 투명도(짧게) 13 — 13번째도 뚝 나타나지 않는다');
  assert.equal(e.calls.at(-1).el, kids[12]);
  assert.equal(e.calls.at(-1).opts.delay, 240);
  e.calls.length = 0; e.tick(401); e.ctx.gust(kids);
  assert.equal(e.calls.length, 0, '한참 뒤에 온 것은 조용히');
  // 글자 칸을 누른 것·글자를 고친 것은 누름이 아니다(치는 동안 바뀌는 결과는 조용히). 고르는 상자는 누름이다
  const text = e.el(200, 40, { is: ['textarea'] }), input = e.el(200, 40, { is: ['input:not([type="checkbox"], [type="radio"])'] }), sel = e.el(200, 40, { is: ['select'] });
  e.fire('click', { target: text }); e.ctx.gust(kids);
  e.fire('click', { target: input }); e.ctx.gust(kids);
  e.fire('change', { target: text }); e.ctx.gust(kids);
  e.fire('change', { target: input }); e.ctx.gust(kids);
  assert.equal(e.calls.length, 0);
  e.fire('change', { target: sel }); e.ctx.gust(kids);
  assert.equal(e.calls.length, 25);
  e.calls.length = 0; e.tick(401);
  e.fire('click', { target: e.el(100, 40) }); e.ctx.gust(kids);
  assert.equal(e.calls.length, 25, '단추·링크를 누른 것은 누름이다');
}
// 6. 풀림 — 누른 채 밖으로 나가면 조용히, 못 풀고 남은 누름은 다음 누름이 푼다. 빛 테두리 카드는 머리 줄을 눌러도 카드째
{
  const e = makeEnv();
  const b = e.el(100, 40);
  e.press(b);
  assert.equal(typeof b.on.pointerleave, 'function');
  b.on.pointerleave({ type: 'pointerleave' });
  assert.equal(e.calls.at(-1).opts.duration, 240, '밖으로 나가면 출렁임 없이');
  assert.equal(b.on.pointerleave, undefined, '풀리면 듣던 것도 뗀다');
  // Ctrl+누름·길게 누름으로 뜬 메뉴 — 크로미움의 contextmenu 는 isPrimary 가 늘 false 인 PointerEvent 다. 둘째 손가락으로 읽지 않고 푼다
  e.press(b); e.fire('contextmenu', { isPrimary: false });
  assert.equal(e.calls.at(-1).opts.duration, 240, '메뉴가 뜨면 조용히 풀린다');
  assert.equal(b.on.pointerleave, undefined);
  // 3D 뷰어 틀 위에서 뗀 마우스 — pointerup 이 오지 않았다. 빈 곳을 눌러도 풀린다
  e.press(b); const n = e.calls.length;
  e.fire('pointerdown', { isPrimary: true, button: 0, pointerType: 'mouse', target: { closest: () => null } });
  assert.equal(e.calls.length, n + 1);
  assert.equal(e.calls.at(-1).el, b);
  assert.equal(e.calls.at(-1).opts.duration, 240);
  const card = e.el(400, 300), head = e.el(400, 60, { is: ['summary', '.br-glow > summary'], parent: card });
  e.press(head);
  assert.equal(e.calls.at(-1).el, card);
  assert.equal(last(e.calls.at(-1)).scale, '0.98');
}
// 7. 눌림은 press.ts 한 곳에서만 — :active 에 scale 을 다시 쓰면 두 번 눌린다. Base 가 press.ts 를 싣는다
{
  const noCss = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '');   // 막아 둔 규칙·설명글 속 글자는 세지 않는다
  const bad = [];
  for (const f of readdirSync(root, { recursive: true })) {
    if (!/\.(astro|css)$/.test(f) || f.startsWith('legacy')) continue;
    const s = noCss(readFileSync(new URL(f, root), 'utf8'));
    for (const m of s.matchAll(/[^{};]*:active[^{}]*\{[^}]*\bscale\b[^}]*\}/g)) bad.push(`${f}: ${m[0].trim().slice(0, 80)}`);
    if (f !== 'layouts/Base.astro' && /@view-transition\s*\{/.test(s)) bad.push(`${f}: @view-transition 은 Base.astro <head> 한 곳에만(아래 8)`);
    if (f !== 'styles/global.css' && /tap-highlight-color/.test(s)) bad.push(`${f}: 탭 번쩍임은 global.css 한 곳에서만 끈다`);
  }
  assert.deepEqual(bad, []);
  assert.match(readFileSync(new URL('layouts/Base.astro', root), 'utf8'), /^\s*import ['"]\.\.\/scripts\/press\.ts['"]/m, 'Base 가 press.ts 를 싣는다(// 로 막은 줄은 세지 않는다)');
  // 탭 번쩍임은 눌림 모션이 실제로 도는 경우에만 끈다 — 조건(모션 줄이기 아님 · scale 지원 · press.ts 가 남긴 표시) 셋이 다 걸려 있어야 한다
  const css = noCss(readFileSync(new URL('styles/global.css', root), 'utf8'));
  assert.match(css, /@media \(prefers-reduced-motion: no-preference\)\s*\{\s*@supports \(scale: 1\)\s*\{\s*html\.br-press\s*\{[^}]*tap-highlight-color/, '탭 번쩍임은 press.ts 가 남긴 표시로만 끈다');
  assert.equal(css.match(/tap-highlight-color/g).length, 1, '조건 없이 끄는 규칙이 따로 있으면 안 된다');
}
// 8. 화면 넘어갈 때(DESIGN.md §4) — 자리가 틀리면 오류 없이 전환만 빠진다. 화면으로는 놓치기 쉬워 자리를 여기서 지킨다
{
  const base = readFileSync(new URL('layouts/Base.astro', root), 'utf8').replace(/\{\/\*[\s\S]*?\*\/\}|<!--[\s\S]*?-->/g, '');   // 설명글·막아 둔 것 속 글자는 세지 않는다
  const head = base.slice(0, base.indexOf('</head>'));
  assert.match(head, /<style is:inline>\s*@media \(prefers-reduced-motion: no-preference\)\s*\{\s*@view-transition\s*\{\s*navigation:\s*auto;?\s*\}\s*\}\s*<\/style>/,
    '켜는 규칙은 <head> 의 인라인 <style> 에, 모션 줄이기 조건 안에 — 따로 받는 CSS 나 <body> 안에 두면 크롬에서 전환이 빠진다');
  const src = head.match(/<script is:inline>\s*(addEventListener\('pagereveal'[\s\S]*?)<\/script>/)?.[1];
  assert.ok(src, '겹치는 동안의 누름을 받는 스크립트도 <head> 인라인 — body 끝 스크립트는 pagereveal 을 놓친다');
  // 그 스크립트를 실제로 돌려 본다 — 자리만 맞고 동작이 틀린 것을 잡는다
  const node = (o) => ({ parentElement: null, contains(x) { for (; x; x = x.parentElement) if (x === this) return true; return false; }, ...o });
  const thing = (is = [], parentElement = null) => node({
    clicks: 0, focuses: 0, parentElement, click() { this.clicks++; }, focus(o) { this.focuses++; this.opt = o; },
    matches: (sel) => sel.split(',').some((s) => is.includes(s.trim())),
  });
  // at: 그 자리에 있는 것 — 물건 하나, 또는 x 좌표를 받아 물건을 돌려주는 함수
  const reveal = (at, vt = true) => {
    const on = {}, n = { skip: 0, stop: 0, html: 0 };
    const html = node({ click() { n.html++; }, matches: () => false, contains: () => true });
    const key = (t, o) => t + (o === true || o?.capture ? ':c' : '');   // 캡처로 건 듣기와 아닌 듣기는 다른 것이다 — 뗄 때도 같아야 떨어진다
    let end;
    vm.runInNewContext(src, {
      // 실제 브라우저처럼: 전환을 끝내기 전에는 어디를 짚어도 <html> 이다
      document: { documentElement: html, elementFromPoint: (x) => (!n.skip || at === 'html' ? html : typeof at === 'function' ? at(x) : at) },
      addEventListener: (t, fn, o) => { (on[key(t, o)] ||= []).push(fn); },
      removeEventListener: (t, fn, o) => { on[key(t, o)] = (on[key(t, o)] || []).filter((f) => f !== fn); },
    });
    const fire = (t, ev) => [...(on[t + ':c'] || []), ...(on[t] || [])].forEach((fn) => fn(ev));
    fire('pagereveal', { viewTransition: vt ? { skipTransition() { n.skip++; }, finished: { then(fn) { end = fn; }, finally(fn) { end = fn; } } } : null });
    // 사람의 누름: 누르기 시작(pointerdown)이 먼저 오고, 겹치는 동안의 click 은 <html> 에 닿는다
    const down = (x = 5) => fire('pointerdown', { isTrusted: true, target: html, clientX: x, clientY: 5 });
    const up = (o = {}) => fire('click', { isTrusted: true, target: html, clientX: 5, clientY: 5, stopPropagation() { n.stop++; }, ...o });
    return { on, n, down, up, tap: (o) => { down(); up(o); }, end: () => end() };
  };
  {
    const b = thing(), r = reveal(b);
    assert.equal(r.on['click:c']?.length, 1, 'click 은 캡처로 듣는다 — 바깥 누름 처리기보다 먼저 삼켜야 한다');
    r.tap();
    assert.deepEqual([r.n.skip, r.n.stop, b.clicks, b.focuses], [1, 1, 1, 0], '전환을 끝내고, 이 누름은 삼키고, 그 자리에 있는 것을 대신 누른다');
    for (const k of ['metaKey', 'ctrlKey', 'shiftKey', 'altKey']) r.tap({ [k]: true });
    assert.deepEqual([r.n.skip, r.n.stop, b.clicks], [5, 5, 1], '보조키를 누른 채 누른 것은 전환만 끝내고 대신 누르지 않는다(새 탭 열기가 같은 탭 이동으로 바뀌지 않게)');
    r.tap({ isTrusted: false }); r.tap({ target: b });
    assert.deepEqual([r.n.skip, r.n.stop, b.clicks], [5, 5, 1], '대신 누른 것·제대로 닿은 누름은 건드리지 않는다');
    // 겹치는 동안 누르기 시작해 끝난 뒤에 뗀 누름도 <html> 로 온다 — 끝난 뒤 새로 누르기 시작할 때까지는 듣는다
    r.down(); r.end(); r.up();
    assert.equal(b.clicks, 2, '겹치는 동안 누르기 시작해 끝난 뒤에 뗀 누름도 받는다');
    r.down();
    assert.deepEqual([r.on['click:c'].length, r.on['pointerdown:c'].length], [0, 0], '끝난 뒤 새로 누르기 시작하면 그만 듣는다');
    // 앞 화면에서 누르기 시작해 넘어온 누름(이 화면은 pointerdown 을 못 봤다)도 받는다
    const c = thing(); reveal(c).up();
    assert.equal(c.clicks, 1);
  }
  {
    // 끌다 뗀 것: 누르기 시작한 곳과 뗀 곳을 함께 감싼 것이 눌린다(브라우저가 하는 그대로) — 뗀 자리의 링크가 눌리면 안 된다
    const box = thing(), a1 = thing([], box), a2 = thing([], box), r = reveal((x) => (x < 20 ? a1 : a2));
    r.down(5); r.end(); r.up({ clientX: 50 });
    assert.deepEqual([a1.clicks, a2.clicks, box.clicks], [0, 0, 1], '끌다 뗀 것은 뗀 자리의 것을 누르지 않는다');
    // 단추 안 글자에서 누르기 시작해 같은 단추의 가장자리에서 뗀 것은 그 단추 누름이다
    const btn = thing(), span = thing([], btn), r2 = reveal((x) => (x < 20 ? span : btn));
    r2.down(5); r2.up({ clientX: 50 });
    assert.deepEqual([span.clicks, btn.clicks], [0, 1]);
    // 로고·아이콘: 누른 자리에 있는 것은 SVG 안쪽(path)이고 거기에는 click() 이 없다 — 링크까지 올라간다
    const a = thing(), path = node({ parentElement: node({ parentElement: a }) });
    reveal(path).tap();
    assert.equal(a.clicks, 1, 'SVG 안쪽을 눌러도 감싼 링크가 눌린다');
    // 글 칸·고르는 상자는 초점도 옮긴다(click() 만으로는 커서가 안 생긴다). 진짜 누름처럼 화면은 밀지 않는다
    for (const s of ['input', 'textarea', 'select']) { const f = thing([s]); reveal(f).tap(); assert.deepEqual([f.focuses, f.clicks, f.opt?.preventScroll], [1, 1, true], `${s} 는 초점을 받는다`); }
    // 빈 곳: 아무것도 누르지 않는다(오류도 없다)
    for (const at of ['html', null]) { const e = reveal(at); e.tap(); assert.deepEqual([e.n.skip, e.n.html], [1, 0]); }
    assert.equal(reveal(a, false).on['click:c'], undefined, '전환 없이 도착했으면(새로 고침·주소 입력) 아무것도 듣지 않는다');
  }
  // 헤더는 첫 그림부터 접혀 있어야 한다 — 한 줄 메뉴가 휴대폰 화면을 넓히면 앞 화면과 폭이 달라 전환이 취소된다
  const hdr = readFileSync(new URL('components/SiteHeader.astro', root), 'utf8');
  const at = hdr.indexOf("classList.add('has-menu')");   // 첫 번째 = 첫 그림 전에 도는 인라인 스크립트
  assert.ok(/<script is:inline>[^<]*$/.test(hdr.slice(0, at)) && at > hdr.indexOf('</button>') && at < hdr.indexOf('class="bd-header__links"'),
    '헤더를 접는 인라인 스크립트는 메뉴 단추 바로 뒤, 링크 묶음 앞에');
}
// 9. 펼침(expand.ts)은 눌려 줄어든 카드에서도 놓인 높이에서 끝난다 — 그려진 상자로 재면 그만큼 모자란 데서 멎었다가 끝에 툭 늘어난다(휴대폰 폭 실측 20px)
{
  const expand = stripTypeScriptTypes(readFileSync(new URL('scripts/expand.ts', root), 'utf8')).replace(/^export /gm, '');
  // drawn: 그려진 상자 높이 [닫힘, 열림] · laid: 브라우저가 돌려주는 놓인 높이 글자 [닫힘, 열림]. 머리 줄을 눌러 열 때의 높이 키프레임을 돌려준다
  const open = (drawn, laid) => {
    let click, frames;
    class HTMLDetailsElement {}
    const d = Object.assign(new HTMLDetailsElement(), {
      open: false, style: {}, children: [], hasAttribute: () => false, toggleAttribute() {}, removeAttribute() {},
      getBoundingClientRect() { return { height: drawn[+this.open] }; },
      animate(f) { frames ||= f; return { cancel() {} }; },
    });
    vm.runInNewContext(expand, {
      HTMLDetailsElement, matchMedia: () => ({ matches: false }), setTimeout() {},
      getComputedStyle: (e) => ({ height: laid[+e.open] }),
      document: { addEventListener: (t, fn) => { if (t === 'click') click = fn; } },
    }, { filename: 'expand.ts' });
    click({ target: { parentElement: d, closest(s) { return s === 'summary' ? this : null; } }, preventDefault() {} });
    return frames.map((k) => parseFloat(k.height));
  };
  // 눌려 0.977 로 줄어든 카드(353px 폭 실측값). 계산값 글자는 여섯 자리로 반올림돼 있어, 놓임 격자(1/64px)로 되돌린 값이어야 끝에 1/64px 도 안 튄다
  const pressed = open([71.5289, 878.1831], ['73.1875px', '898.547px']);
  assert.deepEqual([pressed[0], pressed.at(-1)], [73.1875, 898.546875], '눌린 카드도 놓인 높이에서 시작해 놓인 높이에서 끝난다');
  // 눌리지 않았으면 그려진 상자 그대로다(격자가 다른 브라우저에서도 정확)
  const rest = open([73.2, 300.41666], ['73.2px', '300.417px']);
  assert.deepEqual([rest[0], rest.at(-1)], [73.2, 300.41666], '줄지 않은 카드는 그려진 높이 그대로');
}
console.log('press: ok');
