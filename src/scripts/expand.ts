// 펼침 모션 — 사이트의 모든 <details> 가 띡 열리고 닫히지 않게, 높이를 늘이고 줄이며 안 내용이 차례로 떠오른다.
// DESIGN.md §4 '--dur-expand 400ms'. 동작 안 하는 브라우저·모션 줄이기 설정이면 기본 동작(즉시 열림) 그대로.
// 빼는 것: data-no-expand(직접 모션을 다루는 곳 — /faq/ 순서대로 보기·더 보기)
const DUR = 400;
const EASE = 'cubic-bezier(0.16, 1, 0.3, 1)';
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const running = new WeakMap<HTMLDetailsElement, Animation>();

function heightWhen(d: HTMLDetailsElement, open: boolean) {
  const was = d.open;
  d.open = open;
  const h = d.getBoundingClientRect().height;
  d.open = was;
  return h;
}

function toggle(d: HTMLDetailsElement) {
  running.get(d)?.cancel();
  const opening = !d.open;
  const from = d.getBoundingClientRect().height;
  const to = heightWhen(d, opening);
  if (opening) d.open = true;
  d.style.overflow = 'hidden';
  const a = d.animate({ height: [`${from}px`, `${to}px`] }, { duration: DUR, easing: EASE });
  running.set(d, a);
  if (opening) {
    // 안 내용 — 위에서 살짝 내려오며 60ms 씩 차례로
    const kids = Array.from(d.children).filter((c) => c.tagName !== 'SUMMARY') as HTMLElement[];
    const parts = kids.length === 1 && kids[0].children.length > 1 ? Array.from(kids[0].children) as HTMLElement[] : kids;
    parts.slice(0, 8).forEach((el, i) =>
      el.animate(
        [{ opacity: 0, transform: 'translateY(-10px)' }, { opacity: 1, transform: 'none' }],
        { duration: DUR, delay: 60 + i * 60, easing: EASE, fill: 'backwards' },
      ),
    );
  }
  // 끝 처리 — 애니메이션 끝 이벤트가 안 오는 경우(탭이 가려져 프레임이 멈춤 등)에도 타이머로 한 번은 마무리한다
  let done = false;
  const finish = () => {
    if (done || running.get(d) !== a) return;
    done = true;
    a.cancel();
    if (!opening) d.open = false;
    d.style.overflow = '';
    running.delete(d);
  };
  a.onfinish = finish;
  setTimeout(finish, DUR + 80);
  a.oncancel = () => { d.style.overflow = ''; };
}

document.addEventListener('click', (e) => {
  const s = (e.target as Element | null)?.closest?.('summary');
  const d = s?.parentElement;
  if (!s || !(d instanceof HTMLDetailsElement) || d.hasAttribute('data-no-expand')) return;
  if (reduced() || typeof d.animate !== 'function') return;
  e.preventDefault();
  toggle(d);
});
