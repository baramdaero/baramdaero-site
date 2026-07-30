// 공용 모션 v2 — 스크롤 리빌 + 숫자 카운트업 (마퀴는 순수 CSS).
// no-JS 안전장치: 숨김 스타일은 html.br-js 하위에만 있으므로, 이 스크립트가
// 실행되지 않으면(또는 IO 미지원이면) 콘텐츠는 처음부터 전부 보인다.
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------- 카운트업 — [data-countup] (마크업 기본값 = 최종값이라 실패에도 안전) ---------- */
function countUp(el: HTMLElement) {
  const target = Number(el.dataset.countup);
  if (!isFinite(target)) return;
  const dur = 1200;
  const t0 = performance.now();
  const ease = (t: number) => 1 - Math.pow(1 - t, 3);
  const tick = (now: number) => {
    const p = Math.min(1, (now - t0) / dur);
    el.textContent = Math.round(target * ease(p)).toLocaleString('ko-KR');
    if (p < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

if ('IntersectionObserver' in window) {
  /* ---------- 리빌 ---------- */
  const reveals = document.querySelectorAll<HTMLElement>('.br-reveal');
  if (reveals.length) {
    document.documentElement.classList.add('br-js'); // 이 시점부터만 초기 숨김 적용
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add('br-in');
          io.unobserve(entry.target);
        });
      },
      { threshold: 0.15 },
    );
    reveals.forEach((el) => {
      // 같은 부모 안 형제 리빌 요소끼리 60ms stagger
      const sibs = el.parentElement
        ? el.parentElement.querySelectorAll(':scope > .br-reveal')
        : [];
      const idx = Array.prototype.indexOf.call(sibs, el);
      if (idx > 0 && !reduced) el.style.transitionDelay = `${idx * 60}ms`;
      io.observe(el);
    });
  }

  /* ---------- 카운트업 ---------- */
  const nums = document.querySelectorAll<HTMLElement>('[data-countup]');
  if (nums.length && !reduced) {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          io.unobserve(entry.target);
          countUp(entry.target as HTMLElement);
        });
      },
      { threshold: 0.4 },
    );
    nums.forEach((el) => io.observe(el));
  }
}
