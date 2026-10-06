// 공용 모션 v2 — 스크롤 리빌 + 숫자 카운트업 (마퀴는 순수 CSS).
// no-JS 안전장치: 숨김 스타일은 html.br-js 하위에만 있으므로, 이 스크립트가
// 실행되지 않으면(또는 IO 미지원이면) 콘텐츠는 처음부터 전부 보인다.
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------- 카운트업 — [data-countup] (마크업 기본값 = 최종값이라 실패에도 안전) ----------
   스프링으로 센다(2026-10-05): 처음엔 빠르게 올라가고 끝자리에서 천천히 멎는다.
   React Bits CountUp 의 느낌(과감쇠 스프링)을 라이브러리 없이 옮긴 것 —
   과감쇠라 목표를 넘어가지 않는다(숫자가 실제 값보다 커 보이는 순간이 없다) */
function countUp(el: HTMLElement) {
  const raw = el.dataset.countup ?? '';
  const target = Number(raw);
  if (!isFinite(target)) return;
  const finalText = el.textContent; // 마크업 기본값 = 최종 정적 콘텐츠. 어떤 실패에도 이 값으로 되돌린다
  const decimals = (raw.split('.')[1] ?? '').length; // 소수 자릿수는 목표값을 따른다
  const fmt = { minimumFractionDigits: decimals, maximumFractionDigits: decimals };
  const damping = 60, stiffness = 170; // 100 이면 끝자리 하나가 4초까지 끈다(644 실측) — 2.5초 안에 멎게 조였다
  const done = 0.5 / Math.pow(10, decimals); // 반올림해도 목표값이 되는 거리
  const maxMs = 6000; // 안전장치 — 어떤 경우에도 이 안에 최종값으로 끝낸다
  // 세는 동안 숫자 폭이 변해 옆 칸이 밀리지 않게 최종 폭을 잡아 둔다
  const w = el.offsetWidth;
  if (w) { el.style.display = 'inline-block'; el.style.minWidth = `${w}px`; }
  const restore = () => {
    el.textContent = finalText;
    if (w) { el.style.display = ''; el.style.minWidth = ''; }
  };
  let x = 0, v = 0, t0 = 0, prev = 0;
  const tick = (now: number) => {
    try {
      if (!t0) { t0 = now; prev = now; }
      let dt = Math.min(0.064, (now - prev) / 1000); // 탭이 쉬다 돌아와도 튀지 않게
      prev = now;
      for (; dt > 0; dt -= 0.004) { // 4ms 씩 잘라 적분(프레임률과 무관하게 같은 곡선)
        const h = Math.min(0.004, dt);
        v += (stiffness * (target - x) - damping * v) * h;
        x += v * h;
      }
      if (Math.abs(target - x) < done || now - t0 > maxMs) { restore(); return; }
      el.textContent = x.toLocaleString('ko-KR', fmt);
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
