// 마크다운 본문의 단일 틸다(~)를 글자 그대로 돌려놓는 rehype 플러그인 (astro.config.mjs 의 markdown.rehypePlugins).
//
// 마크다운(GFM)은 '~텍스트~' 한 쌍짜리도 취소선으로 읽는다. 그래서 사례 본문의 '130mm~150mm … 150mm~180mm',
// '5~5.5cm 와 8~10cm' 같은 범위가 '130mm<del>150mm … 150mm</del>180mm' 로 나가 치수가 취소선으로 보였다.
// 이 플러그인은 원문이 '~~' 로 시작하지 않는 <del> 만 풀어 '~' + 안쪽 + '~' 로 되돌린다.
// '~~진짜 취소선~~' 은 그대로 둔다. 원문 위치를 못 알면(position 없음) 건드리지 않는다.
// 마크다운 원문(md)은 고치지 않는다. 의존성은 쓰지 않는다. 검사: node scripts/check-render-leaks.mjs --selfcheck
export default function rehypeLiteralTilde() {
  return (tree, file) => {
    const src = String(file?.value ?? '');
    const fix = (node) => {
      if (!Array.isArray(node.children)) return;
      for (let i = 0; i < node.children.length; i++) {
        const child = node.children[i];
        fix(child);   // 안쪽부터 — 중첩된 del 도 풀린다
        if (child.type !== 'element' || child.tagName !== 'del') continue;
        const at = child.position?.start?.offset;
        if (at == null || src.slice(at, at + 2) === '~~') continue;
        node.children.splice(i, 1, { type: 'text', value: '~' }, ...child.children, { type: 'text', value: '~' });
        i += child.children.length + 1;   // 방금 끼운 노드들은 다시 보지 않는다
      }
    };
    fix(tree);
  };
}
