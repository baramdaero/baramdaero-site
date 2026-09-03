// Specular 림 — React Bits SpecularButton(WebGL 셰이더) 을 CSS conic 링 + 각도 보간으로 이식 (2026-09-03).
// 대상: [data-specular] 요소(.br-specular 클래스가 링을 그린다). 포인터가 250px 안에 오면 빛이 켜지고(--sb-bright)
// 빛 방향(--sb-angle)은 포인터 쪽으로 감쇠 보간(7/s). 버튼 위에선 대각선에 자리 잡고 커서로 살짝 흔들린다(원본 그대로).
// hover 기기 전용, reduced-motion 시 꺼짐. rAF 루프는 빛이 켜져 있을 때만 돈다.
const fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches
  && !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
if (fine) {
  const PROX = 250, STEER = 7, FADE = 8;
  document.querySelectorAll<HTMLElement>('[data-specular]').forEach((el) => {
    let angle = 2.4, pAngle: number | null = null, prox = 0, bright = 0, last = 0, raf = 0;
    const tick = (now: number) => {
      const dt = Math.min((now - (last || now)) / 1000, 0.05); last = now;
      if (pAngle != null) {
        const diff = ((pAngle - angle + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
        angle += diff * (1 - Math.exp(-dt * STEER));
      }
      bright += (prox - bright) * (1 - Math.exp(-dt * FADE));
      el.style.setProperty('--sb-angle', `${(90 - (angle * 180) / Math.PI).toFixed(2)}deg`);
      el.style.setProperty('--sb-bright', bright.toFixed(3));
      raf = (prox > 0 || bright > 0.004) ? requestAnimationFrame(tick) : 0;
      if (!raf) last = 0;
    };
    window.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      if (r.width === 0) return; // display:none (열린 챗봇의 런처 등)
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      const dx = Math.max(r.left - e.clientX, 0, e.clientX - r.right);
      const dy = Math.max(r.top - e.clientY, 0, e.clientY - r.bottom);
      const dist = Math.hypot(dx, dy);
      if (dist === 0) {
        const nx = (e.clientX - cx) / (r.width / 2), ny = (cy - e.clientY) / (r.height / 2);
        pAngle = Math.atan2(2 / r.height, -2 / r.width) + nx * 0.3 + ny * 0.15;
      } else {
        pAngle = Math.atan2(cy - e.clientY, e.clientX - cx);
      }
      const t = Math.max(0, 1 - dist / PROX);
      prox = t * t * (3 - 2 * t);
      if (!raf) raf = requestAnimationFrame(tick);
    }, { passive: true });
  });
}
