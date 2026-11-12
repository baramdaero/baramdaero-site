// 누름·바람결 — 사이트 어디서나 같은 손맛(2026-11-11 박민혁: '모든 곳에 그런 식으로, 토스 앱처럼'). DESIGN.md §4
// ① 누름: 누를 수 있는 것은 전부 살짝 눌렸다가 스프링으로 돌아온다. 예전에는 :active 규칙을 가진 일부 버튼만 그랬다
//    (393px 9쪽 실측: 누를 것 415개 중 스프링으로 돌아오는 것 172개, 아무 반응 없는 것 191개)
// ② 바람결(도착): 누른 직후 새로 온 것들은 30ms 간격으로 차례로 자리에 와 한 번 출렁이고 멎는다(헤더 메뉴 줄과 같은 값) — gust() 를 불러 쓴다
// transform 이 아니라 따로 도는 개별 속성(scale · translate)을 WAAPI 로 건다 — 요소마다 가진 hover 떠오름·열림 transition 과 겹쳐도 서로 덮지 않고,
// 클래스도 !important 도 남기지 않는다. 지원 안 하는 브라우저·모션 줄이기 설정에서는 아무 일도 하지 않는다(기능은 그대로)
const SEL = 'a[href], button, summary, [data-press]';
const OFF = ':disabled, [aria-disabled="true"], [data-press="off"]';
const HOLD = 70;   // 터치는 이만큼 지나야 눌린다 — 스크롤을 시작한 손가락에 카드가 움찔하지 않게. ponytail: 실기기에서 굼뜨면 40 까지
const DOWN = 100;  // 눌리는 시간(--dur-color 의 절반 — 예전 :active 규칙과 같은 값)
const DEPTH = 8;   // 큰 것은 긴 변 기준 8px 까지만 줄어든다(카드·넓은 줄이 꺼져 보이지 않게)
const MIN = 0.96;  // 200px 이하 버튼·칩은 0.96 (2026-09-07 toss.im 실측값)
const DIM = 0.6;   // 문장 속 글자 링크(display: inline)는 scale 이 먹지 않는다 — 대신 살짝 흐려졌다 돌아온다
// 빛 테두리(border-glow.ts, PC 만)는 카드의 머리 줄 안에 들어 있다 — 머리 줄만 줄이면 테두리가 머리 줄 크기로 어긋나므로 카드째 누른다
const GLOW = '.br-glow > summary';
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
// 이 스크립트가 실제로 돌 때만 기기 기본 탭 번쩍임을 끈다(global.css `html.br-press`) — 안 돌면 기기 기본이 눌림을 대신 보여 준다
document.documentElement.classList.add('br-press');

let SPRING = 0, UI = 0, EASE = '';
function tokens() { // 처음 쓸 때 한 번 — 시간·곡선은 global.css 토큰 그대로
  if (SPRING) return;
  const cs = getComputedStyle(document.documentElement);
  SPRING = parseFloat(cs.getPropertyValue('--dur-spring')) || 600;
  UI = parseFloat(cs.getPropertyValue('--dur-ui')) || 240;
  EASE = cs.getPropertyValue('--ease-spring').trim();
  try { new KeyframeEffect(null, null, { easing: EASE }); } catch { EASE = 'cubic-bezier(0.34, 1.6, 0.64, 1)'; } // linear() 를 모르는 브라우저
}

/* ---------- ① 누름 ---------- */
type Prop = 'scale' | 'opacity';
let el: HTMLElement | null = null, prop: Prop = 'scale', to = '1', hold = 0;
const live = new WeakMap<Element, Animation>();
const cur = (h: Element) => { const v = getComputedStyle(h)[prop]; return v === 'none' ? '1' : v; };
// 지금 값(호출하는 쪽이 먼저 읽는다)에서 이어 간다 — 앞 모션을 끊으면 값이 바닥으로 돌아가므로 읽은 뒤에 끊는다
function run(h: HTMLElement, frames: Keyframe[], opts: KeyframeAnimationOptions) {
  live.get(h)?.cancel();
  try { live.set(h, h.animate(frames, opts)); } catch { /* 끝 프레임을 비운 키프레임을 모르는 옛 브라우저 */ }
}
function down(h: HTMLElement) {
  hold = 0;
  run(h, [{ [prop]: cur(h), offset: 0 }, { [prop]: to }], { duration: DOWN, easing: 'ease-out', fill: 'forwards' });
}
function up(e?: Event) {
  // 둘째 손가락이 뗀 것 — 누르고 있는 첫 손가락은 그대로. pointer* 만 본다: 크로미움의 contextmenu 는 isPrimary 가 늘 false 인 PointerEvent 라, 가리지 않으면 Ctrl+누름·길게 누름 메뉴에서 눌린 채 남는다
  if (e?.type.startsWith('pointer') && (e as PointerEvent).isPrimary === false) return;
  const h = el; if (!h) return; el = null;
  h.removeEventListener('pointerleave', up);
  const waiting = !!hold; clearTimeout(hold); hold = 0;
  const done = e?.type === 'pointerup';
  if (waiting && !done) return;                                   // 스크롤로 끊긴 터치 — 눌린 적 없다
  // 뗐을 때만 스프링(DESIGN.md '사람이 누른 직후에만'). 끊긴 누름(스크롤·끌기·창 전환)은 넘지 않고 조용히 돌아온다
  const spring = done && prop === 'scale';
  // 톡 치고 뗀 손가락도 끝까지 눌린 뒤에 돌아온다. 남은 길이는 시계가 아니라 '실제로 그려진 만큼'으로 잰다 — 화면이 버벅여 눌림이 아직 안 그려졌으면 처음부터
  const left = !done ? 0 : waiting ? DOWN : Math.max(0, DOWN - Number(live.get(h)?.currentTime ?? DOWN));
  const back = spring ? SPRING : UI, ease = spring ? EASE : 'ease-out';
  const frames: Keyframe[] = [{ [prop]: cur(h), offset: 0, easing: left ? 'ease-out' : ease }];
  if (left) frames.push({ [prop]: to, offset: left / (left + back), easing: ease });
  run(h, frames, { duration: left + back });                      // 끝 프레임은 비운다 = 원래 값. fill 이 없어 눌린 채 남지 않는다
}
addEventListener('pointerdown', (e) => {
  if (!e.isPrimary || e.button !== 0 || reduced.matches) return;
  up();                                                           // 풀리지 않고 남은 앞 누름은 어디를 누르든 여기서 푼다
  const hit = (e.target as Element | null)?.closest?.<HTMLElement>(SEL);
  if (!hit || hit.matches(OFF)) return;
  const h = hit.matches(GLOW) ? hit.parentElement! : hit;
  tokens();
  const cs = getComputedStyle(h), r = h.getBoundingClientRect();
  // 가장자리를 누르면 그만큼 덜 눌린다 — 줄어든 상자 밖에 포인터가 남으면 뗄 때 click 이 그 요소로 가지 않는다(누른 곳과 뗀 곳이 달라진다)
  const fx = Math.abs(e.clientX - r.left - r.width / 2) / (r.width / 2 || 1), fy = Math.abs(e.clientY - r.top - r.height / 2) / (r.height / 2 || 1);
  const edge = Math.min(1, Math.max(fx, fy) + 0.01);
  el = h;
  prop = cs.display === 'inline' ? 'opacity' : 'scale';
  to = String(prop === 'opacity' ? (parseFloat(cs.opacity) || 1) * DIM : Math.max(MIN, 1 - DEPTH / Math.max(r.width, r.height, 1), edge));
  // 누른 채 밖으로 나가면 조용히 풀린다(up 이 다시 떼어 낸다) — 3D 뷰어 틀 위에서 떼면 pointerup 이 이 문서로 오지 않아 눌린 채 남는다
  h.addEventListener('pointerleave', up);
  if (e.pointerType === 'touch') hold = window.setTimeout(() => down(h), HOLD); else down(h);
}, { passive: true });
for (const t of ['pointerup', 'pointercancel', 'dragstart', 'contextmenu', 'blur']) addEventListener(t, up, { passive: true });

// 뒤로 가기로 되살아난 화면(bfcache)에 눌린 채 남지 않게 — 떠날 때 걸린 누름을 푼다
addEventListener('pagehide', () => { const h = el; up(); if (h) live.get(h)?.cancel(); });

/* ---------- ② 바람결(도착) ---------- */
const GATE = 400;  // 누른 뒤 이 안에 온 것만 — 타자·늦게 도착한 응답으로 바뀐 것은 조용히 바뀐다(DESIGN.md '스프링은 사람이 누른 직후에만')
const STEP = 30;   // 사이 간격 — 헤더 메뉴 줄과 같다
const FROM = 12;   // 떠오르는 거리(px)
let pressedAt = -1e9;
// 글자 칸을 누른 것(커서 놓기)과 글자를 고친 것(change)은 누름으로 세지 않는다 — 치는 동안 바뀌는 결과는 조용히 바뀐다. change 는 고르는 상자(select)만
addEventListener('click', (e) => { if (!(e.target as Element | null)?.closest?.('input:not([type="checkbox"], [type="radio"]), textarea')) pressedAt = performance.now(); }, true);
addEventListener('change', (e) => { if ((e.target as Element | null)?.matches?.('select')) pressedAt = performance.now(); }, true);
/** 누른 직후 새로 온 것들(목록 줄·카드·판)이 차례로 자리에 와 한 번 출렁이고 멎는다. 부르는 쪽은 '새로 온 것'만 넘긴다 */
export function gust(kids: Element[], y = FROM) {
  if (reduced.matches || performance.now() - pressedAt > GATE) return;
  tokens();
  // ponytail: 자리는 앞 12개만 움직인다(나머지는 대개 화면 밖). 투명도는 넘겨받은 전부 — 13번째부터 뚝 나타나지 않게. 수백 개를 한 번에 넘기는 곳이 생기면 보이는 것만 고르기
  kids.forEach((c, i) => {
    const o = { delay: Math.min(i, 8) * STEP, fill: 'backwards' as const };
    try { // 끝 프레임은 비운다 = 그 요소의 원래 값
      if (i < 12) c.animate([{ translate: `0 ${y}px`, offset: 0 }], { ...o, duration: SPRING, easing: EASE });
      c.animate([{ opacity: 0, offset: 0 }], { ...o, duration: UI, easing: 'ease' });
    } catch { /* 옛 브라우저: 그냥 바뀐다 */ }
  });
}
