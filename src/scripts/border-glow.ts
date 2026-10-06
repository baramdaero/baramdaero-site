// 엣지 글로우 — React Bits <BorderGlow /> (JS-CSS, MIT) 를 React 없이 이식 (2026-09-03).
// 원리: 포인터가 카드 중심에서 가장자리로 갈수록 --edge-proximity(0~100) ↑, 중심 기준 각도 --cursor-angle.
// CSS 가 그 두 변수로 (1) 커서 쪽 테두리를 팔레트 메시로 물들이고 (2) 바깥으로 빛을 흘린다.
// 대상: 유리 카드 전부(.br-glass) + [data-glow](유리 클래스가 없는 흰 카드 — 시공사례 카드). data-glow="off" 는 뺀다
// (2026-10-06 대표: 설치 4단계 카드의 테두리 모션을 다른 흰 카드에도 전부). 3D 무대·말풍선·긴 본문 판은 off.
// 레이어 2장은 여기서 주입한다 — no-JS·터치 기기는 글로우 없음(hover 가 없으니 의미도 없음).
const fine = window.matchMedia('(hover: hover) and (pointer: fine)');
if (fine.matches) {
  const cards = document.querySelectorAll<HTMLElement>('.br-glass, [data-glow]');
  cards.forEach((card) => {
    if (card.dataset.glow === 'off' || card.classList.contains('br-glow')) return;
    // <details> 는 닫혀 있으면 summary 밖 자식을 그리지 않는다 — 레이어를 summary 안에 넣는다.
    // summary 는 position: static 이라 기준 상자는 그대로 카드(.br-glass, relative)다. 모서리만 카드 값을 직접 준다
    const summary = card instanceof HTMLDetailsElement ? card.querySelector<HTMLElement>(':scope > summary') : null;
    const host = summary ?? card;
    const radius = summary ? getComputedStyle(card).borderRadius : '';
    for (const cls of ['br-glow__border', 'br-glow__light']) {
      const s = document.createElement('span');
      s.className = cls;
      s.setAttribute('aria-hidden', 'true');
      if (radius) s.style.borderRadius = radius;
      host.appendChild(s);
    }
    card.classList.add('br-glow');
    card.addEventListener('pointermove', (e) => {
      const r = card.getBoundingClientRect();
      const cx = r.width / 2;
      const cy = r.height / 2;
      const dx = e.clientX - r.left - cx;
      const dy = e.clientY - r.top - cy;
      // 원본 getEdgeProximity: 중심→커서 방향으로 가장자리에 닿기까지의 비율
      const kx = dx !== 0 ? cx / Math.abs(dx) : Infinity;
      const ky = dy !== 0 ? cy / Math.abs(dy) : Infinity;
      const edge = Math.min(Math.max(1 / Math.min(kx, ky), 0), 1);
      let deg = Math.atan2(dy, dx) * (180 / Math.PI) + 90;
      if (deg < 0) deg += 360;
      card.style.setProperty('--edge-proximity', (edge * 100).toFixed(2));
      card.style.setProperty('--cursor-angle', `${deg.toFixed(2)}deg`);
    });
  });
}
