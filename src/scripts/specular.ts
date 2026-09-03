// Specular 림 — React Bits SpecularButton(WebGL 셰이더) 을 CSS conic 링 + 각도 보간으로 이식 (2026-09-03).
// 대상: [data-specular] 요소(.br-specular 클래스가 링을 그린다). 포인터가 250px 안에 오면 빛이 켜지고(--sb-bright)
// 빛 방향(--sb-angle)은 포인터 쪽으로 감쇠 보간(7/s). 버튼 위에선 대각선에 자리 잡고 커서로 살짝 흔들린다(원본 그대로).
// 2026-09-04: 챗봇 칩처럼 나중에 생기는 요소도 잡도록 pointermove 때마다 현재 DOM 을 훑는다(요소 수 십 개 수준, 비용 무시).
// 상태는 WeakMap — 사라진 요소는 GC. hover 기기 전용, reduced-motion 시 꺼짐. rAF 루프는 빛이 켜진 요소가 있을 때만 돈다.
const fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches
  && !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
if (fine) {
  const PROX = 250, STEER = 7, FADE = 8;
  type St = { angle: number; pAngle: number | null; prox: number; bright: number };
  const states = new WeakMap<HTMLElement, St>();
  const active = new Set<HTMLElement>();
  let last = 0, raf = 0;
  const tick = (now: number) => {
    const dt = Math.min((now - (last || now)) / 1000, 0.05); last = now;
    for (const el of active) {
      const s = states.get(el);
      if (!s || !el.isConnected) { active.delete(el); continue; }
      if (s.pAngle != null) {
        const diff = ((s.pAngle - s.angle + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
        s.angle += diff * (1 - Math.exp(-dt * STEER));
      }
      s.bright += (s.prox - s.bright) * (1 - Math.exp(-dt * FADE));
      el.style.setProperty('--sb-angle', `${(90 - (s.angle * 180) / Math.PI).toFixed(2)}deg`);
      el.style.setProperty('--sb-bright', s.bright.toFixed(3));
      if (s.prox <= 0 && s.bright <= 0.004) active.delete(el);
    }
    raf = active.size ? requestAnimationFrame(tick) : 0;
    if (!raf) last = 0;
  };
  window.addEventListener('pointermove', (e) => {
    document.querySelectorAll<HTMLElement>('[data-specular]').forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.width === 0) return; // display:none (열린 챗봇의 런처 등)
      let s = states.get(el);
      if (!s) { s = { angle: 2.4, pAngle: null, prox: 0, bright: 0 }; states.set(el, s); }
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      const dx = Math.max(r.left - e.clientX, 0, e.clientX - r.right);
      const dy = Math.max(r.top - e.clientY, 0, e.clientY - r.bottom);
      const dist = Math.hypot(dx, dy);
      if (dist === 0) {
        const nx = (e.clientX - cx) / (r.width / 2), ny = (cy - e.clientY) / (r.height / 2);
        s.pAngle = Math.atan2(2 / r.height, -2 / r.width) + nx * 0.3 + ny * 0.15;
      } else {
        s.pAngle = Math.atan2(cy - e.clientY, e.clientX - cx);
      }
      const t = Math.max(0, 1 - dist / PROX);
      s.prox = t * t * (3 - 2 * t);
      if (s.prox > 0 || s.bright > 0.004) active.add(el);
    });
    if (active.size && !raf) raf = requestAnimationFrame(tick);
  }, { passive: true });
}
