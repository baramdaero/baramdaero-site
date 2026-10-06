// 펼침 모션 — 사이트의 모든 <details> 가 띡 열리고 닫히지 않게, 높이를 늘이고 줄이며 안 내용이 차례로 떠오른다.
// 열릴 때는 높이가 살짝 넘었다 돌아오며 멎는다(2026-10-06 대표: '딱 열리지 않고 뚜~웅') — 넘는 양은 OVER px 까지.
// 닫힐 때는 살짝 부풀었다가 접힌다(여는 모션의 짝). DESIGN.md §4 '--dur-expand 520ms'. 동작 안 하는 브라우저·모션 줄이기 설정이면 기본 동작(즉시 열림) 그대로.
// 빼는 것: data-no-expand(직접 모션을 다루는 곳 — /faq/ 순서대로 보기·더 보기)
const DUR = 520;   // 여는 시간 — global.css --dur-expand 와 같은 값
const CLOSE = 320; // 닫는 시간 — --dur-spring-out 과 같은 값
const FADE = 400;  // 안 내용이 떠오르는 시간
const OVER = 12;   // 열릴 때 높이가 넘었다 돌아오는 양의 상한(px). 긴 답도 아래 글이 출렁이지 않게 px 로 묶는다
const ANT = 8;     // 닫힐 때 접히기 전에 부푸는 양의 상한(px)
const EASE = 'cubic-bezier(0.16, 1, 0.3, 1)';
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const running = new WeakMap<HTMLDetailsElement, { a: Animation; opening: boolean }>();

function heightWhen(d: HTMLDetailsElement, open: boolean) {
  const was = d.open;
  d.open = open;
  const h = d.getBoundingClientRect().height;
  d.open = was;
  return h;
}

function toggle(d: HTMLDetailsElement) {
  // 도는 중에 다시 누르면 지금 높이에서 반대로 간다 — 닫히는 동안에도 open 속성은 그대로라 그것만 보면 방향을 못 가린다
  const prev = running.get(d);
  const from = d.getBoundingClientRect().height;
  prev?.a.cancel();
  const opening = prev ? !prev.opening : !d.open;
  const to = heightWhen(d, opening);
  if (opening) d.open = true;
  d.style.overflow = 'hidden';
  const dur = opening ? DUR : CLOSE;
  const over = Math.min(OVER, Math.max(0, to - from) * 0.06);
  const a = opening
    // 빠르게 올라가 살짝 넘고(42% 지점) 천천히 제자리로
    ? d.animate(
        [
          { height: `${from}px`, easing: 'cubic-bezier(0.2, 0.9, 0.3, 1)' },
          { height: `${to + over}px`, offset: 0.42, easing: 'cubic-bezier(0.4, 0, 0.2, 1)' },
          { height: `${to}px` },
        ],
        { duration: dur },
      )
    // 살짝 부풀었다가(30% 지점) 접힌다
    : d.animate(
        [
          { height: `${from}px`, easing: 'cubic-bezier(0.3, 0, 0.5, 1)' },
          { height: `${from + Math.min(ANT, Math.max(0, from - to) * 0.06)}px`, offset: 0.3, easing: 'cubic-bezier(0.5, 0, 0.8, 0.4)' },
          { height: `${to}px` },
        ],
        { duration: dur },
      );
  running.set(d, { a, opening });
  if (opening && !prev) {
    // 안 내용 — 위에서 살짝 내려오며 60ms 씩 차례로(닫히다 되돌아 열릴 때는 이미 보이는 내용이라 다시 띄우지 않는다)
    const kids = Array.from(d.children).filter((c) => c.tagName !== 'SUMMARY') as HTMLElement[];
    const parts = kids.length === 1 && kids[0].children.length > 1 ? Array.from(kids[0].children) as HTMLElement[] : kids;
    parts.slice(0, 8).forEach((el, i) =>
      el.animate(
        [{ opacity: 0, transform: 'translateY(-10px)' }, { opacity: 1, transform: 'none' }],
        { duration: FADE, delay: 60 + i * 60, easing: EASE, fill: 'backwards' },
      ),
    );
  }
  // 끝 처리 — 애니메이션 끝 이벤트가 안 오는 경우(탭이 가려져 프레임이 멈춤 등)에도 타이머로 한 번은 마무리한다
  let done = false;
  const finish = () => {
    if (done || running.get(d)?.a !== a) return;
    done = true;
    a.cancel();
    if (!opening) d.open = false;
    d.style.overflow = '';
    running.delete(d);
  };
  a.onfinish = finish;
  setTimeout(finish, dur + 80);
  // 밖에서 끊겼을 때(요소가 사라짐 등)만 정리한다 — 다시 눌러 끊긴 것은 새 모션이 이어받았고, 이 이벤트는 그 뒤에 온다
  a.oncancel = () => { if (running.get(d)?.a === a) { d.style.overflow = ''; running.delete(d); } };
}

document.addEventListener('click', (e) => {
  const s = (e.target as Element | null)?.closest?.('summary');
  const d = s?.parentElement;
  if (!s || !(d instanceof HTMLDetailsElement) || d.hasAttribute('data-no-expand')) return;
  if (reduced() || typeof d.animate !== 'function') return;
  e.preventDefault();
  toggle(d);
});
