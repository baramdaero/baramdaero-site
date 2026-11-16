// 주소로 문의 챗봇 열기 — Chatbot.astro 가 읽는다. 검사: npm run test:chat
//   /install/?chat=install                       설치 문의를 연 채로 들어온다 (clean · as · etc · menu 도 같다)
//   /install/?chat=install&model=…&name=…        보던 상품이 접수 카드의 '문의 제품' 한 줄로 들어간다
// chat 값이 없거나 모르는 값이면 null — 부르는 쪽은 아무 일도 하지 않는다.

/** 주소 값은 바깥에서 온 글자다 — 줄바꿈·제어 문자를 빈칸으로 바꾸고(카드에 줄을 끼워 넣지 못하게) 길이를 자른다 */
const clean = (v: string | null, max: number) =>
  [...(v ?? '').replace(/[\s\p{C}]+/gu, ' ').trim()].slice(0, max).join('').trim();

export function readChatLink(search: string, trees: string[]): { tree: string; product: string } | null {
  const q = new URLSearchParams(search);
  const tree = q.get('chat') ?? '';
  if (!trees.includes(tree)) return null;
  const name = clean(q.get('name'), 60);
  const model = clean(q.get('model'), 30);
  return { tree, product: name && model ? `${name} (${model})` : name || model };
}
