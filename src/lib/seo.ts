// 검색 결과에 보이는 <title>·meta description 다듬기. 화면 제목(H1)과 JSON-LD 는 원문을 그대로 쓴다. 검사: npm run test:seo

/** Base 가 붙이는 ' — 바람대로'(6자)까지 60자 안에 들어가는 제목 길이 */
const MAX_TITLE = 54;

/** 설명문을 max 자 안으로 — 문장 끝에서 자르고, 문장이 너무 길면 낱말 끝에서 자른다 */
export function clipMeta(text: string, max = 155): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const sentence = cut.lastIndexOf('다.');
  if (sentence >= 60) return cut.slice(0, sentence + 2);
  const space = cut.lastIndexOf(' ');
  return `${cut.slice(0, space >= 60 ? space : max - 1)}…`;
}

/**
 * 사례 제목의 ' · ' 뒤 설명을 덜어 검색 결과에서 잘리지 않게 한다.
 * 덜어서 다른 사례와 같아지면 시공일을 붙이고, 그래도 같으면 원문을 쓴다.
 */
export function shortTitles(items: { id: string; title: string; date: Date }[]): Map<string, string> {
  const short = (t: string) => (t.length > MAX_TITLE ? t.split(' · ')[0] : t);
  const tally = (list: string[]) => list.reduce((m, t) => m.set(t, (m.get(t) ?? 0) + 1), new Map<string, number>());
  const withDate = (i: { title: string; date: Date }) =>
    `${short(i.title)} (${i.date.getUTCFullYear()}.${i.date.getUTCMonth() + 1}.${i.date.getUTCDate()})`;

  const shortCount = tally(items.map((i) => short(i.title)));
  const first = items.map((i) => ((shortCount.get(short(i.title)) ?? 0) > 1 ? withDate(i) : short(i.title)));
  const firstCount = tally(first);
  return new Map(items.map((i, k) => [i.id, (firstCount.get(first[k]) ?? 0) > 1 ? i.title : first[k]]));
}
