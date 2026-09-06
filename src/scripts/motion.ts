// 공용 모션 v2 — 스크롤 리빌 + 숫자 카운트업 (마퀴는 순수 CSS).
// no-JS 안전장치: 숨김 스타일은 html.br-js 하위에만 있으므로, 이 스크립트가
// 실행되지 않으면(또는 IO 미지원이면) 콘텐츠는 처음부터 전부 보인다.
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------- 카운트업 — [data-countup] (마크업 기본값 = 최종값이라 실패에도 안전) ---------- */
function countUp(el: HTMLElement) {
  const target = Number(el.dataset.countup);
  if (!isFinite(target)) return;
  const finalText = el.textContent; // 마크업 기본값 = 최종 정적 콘텐츠. 어떤 실패에도 이 값으로 되돌린다
  const dur = 1200;
  const t0 = performance.now();
  const ease = (t: number) => 1 - Math.pow(1 - t, 3);
  const restore = () => { el.textContent = finalText; };
  const tick = (now: number) => {
    try {
      const p = Math.min(1, (now - t0) / dur);
      if (p >= 1) { restore(); return; }
      el.textContent = Math.round(target * ease(p)).toLocaleString('ko-KR');
      requestAnimationFrame(tick);
    } catch {
      restore();
    }
  };
  try { requestAnimationFrame(tick); } catch { restore(); }
}

if ('IntersectionObserver' in window) {
  /* ---------- 리빌 ---------- */
  const reveals = document.querySelectorAll<HTMLElement>('.br-reveal');
  if (reveals.length) {
    try {
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
      // 옵저버 생성·등록이 모두 성공한 뒤에만 초기 숨김 적용 — IO 콜백은 비동기라 첫 페인트 전에 숨김이 걸린다.
      document.documentElement.classList.add('br-js');
    } catch {
      // 생성자/observe 실패 → 숨김 클래스를 남기지 않는다 (콘텐츠는 계속 보인다)
      document.documentElement.classList.remove('br-js');
    }
  }

  /* ---------- 카운트업 ---------- */
  const nums = document.querySelectorAll<HTMLElement>('[data-countup]');
  if (nums.length && !reduced) {
    try {
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
    } catch {
      // 카운트업은 장식 — 실패 시 마크업 기본값(최종값)을 그대로 둔다
    }
  }
}
