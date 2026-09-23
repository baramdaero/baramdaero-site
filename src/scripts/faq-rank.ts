// /faq/ 묻고 답하기 — 물어본 말에 가장 가까운 문항을 고른다. 브라우저·검사 스크립트가 같은 코드를 쓴다.
// 검사: node scripts/check-faq-search.mjs
//
// 매칭: 공백으로 나눈 낱말이 전부 어딘가에 있어야 한다(AND). 하나도 안 맞으면 일부만 맞는 문항을 골라 보게 한다.
//   '에어컨 냄새' 가 '에어컨에서 냄새가 나요' 에 걸리도록 붙여 쓴 한 덩어리 부분일치를 버렸다.
// 조사·어미: '냄새가·에어컨에서' 는 조사를 떼고, '떨어져요' 는 끝 한 글자를 더 떼어 '떨어짐' 에도 걸리게 한다(낮은 점수).
// 군말: '나요·어떻게·자꾸' 같은 말은 버린다 — '하나요' 에 걸려 엉뚱한 답이 1등이 됐었다.
// 순위: 질문(4) > 검색어(3) > 한 줄 요약(2) > 본문(1) × 드문 정도(idf). '에어컨' 처럼 어디에나 있는 말은 순위를 못 끈다.
// 못 박지 않는 경우(답 대신 가까운 질문을 고르게 한다):
//   - 친 말이 전부 흔한 말(문항 30% 넘게 걸림)이거나 군말뿐일 때 — '에어컨', '왜'
//   - 드문 말의 절반 이상이 질문·검색어에 걸리지 않았을 때 — '천장형 에어컨에서 물이 떨어져요' 는
//     '천장형' 만 보양 문항 제목에 걸리고 '물·떨어' 는 본문에만 있어, 누수 고객에게 보양 답을 내놓던 것을 막는다
//   - 1등이 동점일 때 — 문항 순서가 답을 정하게 두지 않는다
//   틀린 답을 자신 있게 보여 주는 것이 답이 없는 것보다 신뢰를 더 깎는다.
// 반대로 군말 하나 때문에 AND 가 깨졌어도, 가까운 후보가 하나뿐이고 그게 확실하면 답한다.

/** 문항 하나 — 각 값은 normFaq 를 거친 것(공백 제거·소문자) */
export interface FaqDoc { id: string; q: string; kw: string; hook: string; body: string }

export type FaqDecision =
  | { kind: 'answer'; id: string; near: string[] }
  | { kind: 'pick'; ids: string[]; vague: boolean }
  | { kind: 'none' };

export const normFaq = (s: string) => s.replace(/\s+/g, '').toLowerCase();

const SUF = ['에서', '으로', '나요', '해요', '이요', '하고', '은', '는', '이', '가', '을', '를', '에', '도', '요', '로', '와', '과'];
const stem = (t: string) => { for (const x of SUF) if (t.length > x.length + 1 && t.endsWith(x)) return t.slice(0, -x.length); return t; };
const STOP = new Set(['나요', '해요', '하나요', '되나요', '있나요', '인가요', '건가요', '어떻게', '왜', '왜요', '뭐', '뭐가', '뭔가요', '무엇', '좀', '너무', '혹시', '그냥', '자꾸', '계속', '정말', '진짜', '우리', '저희', '집', '제', '내',
  // '얼마' 는 양·값을 묻는다는 신호일 뿐 주제가 아니다 — '설치비 얼마' 가 '얼마나 자주' 문항들에 끌려가던 것을 막는다
  '얼마', '얼마나', '얼마예요', '얼만가요', '얼마인가요']);
const W = [['q', 4], ['kw', 3], ['hook', 2], ['body', 1]] as const;
// 답을 못 박는 기준 — 09-23 실제 수요 상위 40문장으로 맞춤(틀린 확답 0, 확답 21). 바꾸면 npm run test:faq
const COVER = 0.5, SURE = 0.4, CLOSE = 0.7;

// 낱말 하나의 찾는 꼴 — [꼴, 배율]. 끝 글자를 뗀 꼴은 헛걸림이 많아 반만 친다
function forms(t: string): [string, number][] {
  const s = stem(t);
  const out: [string, number][] = [[t, 1]];
  if (s !== t) out.push([s, 1]);
  if (s.length >= 3) out.push([s.slice(0, -1), 0.5]);
  return out;
}
// 두 문자열이 이어서 같은 가장 긴 구간의 길이 — 동점 가르기용.
//   '에어컨에서 냄새가 나요' 는 '에어컨에서 냄새가 나는 이유는…'(9자 연속)이 '에어컨에서 타는 냄새가…'(5자)보다 가깝다
function run(a: string, b: string) {
  let best = 0;
  const prev = new Array(b.length + 1).fill(0);
  for (let i = 1; i <= a.length; i++) {
    let diag = 0;
    for (let j = 1; j <= b.length; j++) {
      const up = prev[j];
      prev[j] = a[i - 1] === b[j - 1] ? diag + 1 : 0;
      if (prev[j] > best) best = prev[j];
      diag = up;
    }
  }
  return best;
}
// ── 오타 ─────────────────────────────────────────────────────
// 한/영 전환을 잊고 친 말('dpdjzjs' → '에어컨')과 자모 한두 개 틀린 말('냄세'·'에어콘'·'실외귀')을
// 문항 질문·검색어에 실제로 있는 말로 고친다. 어디에도 안 걸리는 말에만 쓴다.
const CHO = 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ';
const JUNG = 'ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ';
const JONG = ' ㄱㄲㄳㄴㄵㄶㄷㄹㄺㄻㄼㄽㄾㄿㅀㅁㅂㅄㅅㅆㅇㅈㅊㅋㅌㅍㅎ';
const KEYS: Record<string, string> = Object.fromEntries(
  [...'rㄱsㄴeㄷfㄹaㅁqㅂtㅅdㅇwㅈcㅊzㅋxㅌvㅍgㅎkㅏoㅐiㅑjㅓpㅔuㅕhㅗyㅛnㅜbㅠmㅡlㅣ'.matchAll(/(.)(.)/gu)].map((m) => [m[1], m[2]]));
const VV: Record<string, string> = { ㅗㅏ: 'ㅘ', ㅗㅐ: 'ㅙ', ㅗㅣ: 'ㅚ', ㅜㅓ: 'ㅝ', ㅜㅔ: 'ㅞ', ㅜㅣ: 'ㅟ', ㅡㅣ: 'ㅢ' };
const FF: Record<string, string> = { ㄱㅅ: 'ㄳ', ㄴㅈ: 'ㄵ', ㄴㅎ: 'ㄶ', ㄹㄱ: 'ㄺ', ㄹㅁ: 'ㄻ', ㄹㅂ: 'ㄼ', ㄹㅅ: 'ㄽ', ㄹㅌ: 'ㄾ', ㄹㅍ: 'ㄿ', ㄹㅎ: 'ㅀ', ㅂㅅ: 'ㅄ' };
const isV = (c?: string) => !!c && JUNG.includes(c);

// 두벌식 자판 순서대로 친 자모를 글자로 모은다 — 받침은 뒤에 모음이 오면 다음 글자 초성으로 넘긴다
function compose(js: string[]): string {
  let out = '', i = 0;
  while (i < js.length) {
    const c = js[i];
    if (!CHO.includes(c) || !isV(js[i + 1])) { out += c; i++; continue; }
    let v = js[i + 1], k = i + 2;
    if (VV[v + js[k]]) v = VV[v + js[k++]];
    let f = '';
    if (js[k] && !isV(js[k]) && JONG.includes(js[k]) && !isV(js[k + 1])) {
      f = js[k++];
      if (js[k] && FF[f + js[k]] && !isV(js[k + 1])) f = FF[f + js[k++]];
    }
    out += String.fromCharCode(0xac00 + (CHO.indexOf(c) * 21 + JUNG.indexOf(v)) * 28 + (f ? JONG.indexOf(f) : 0));
    i = k;
  }
  return out;
}
function jamo(s: string) {
  let out = '';
  for (const ch of s) {
    const c = ch.charCodeAt(0) - 0xac00;
    out += c < 0 || c > 11171 ? ch : CHO[Math.floor(c / 588)] + JUNG[Math.floor((c % 588) / 28)] + (c % 28 ? JONG[c % 28] : '');
  }
  return out;
}
function lev(a: string, b: string, cap: number) {
  if (Math.abs(a.length - b.length) > cap) return cap + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    if (Math.min(...cur) > cap) return cap + 1;
    prev = cur;
  }
  return prev[b.length];
}
// 고칠 후보 = 문항 질문·검색어 속 한글 구간(길이별). 문항 목록이 같으면 한 번만 만든다
const vocabCache = new WeakMap<FaqDoc[], Map<number, Map<string, { j: string; n: number }>>>();
function vocab(docs: FaqDoc[], len: number) {
  let byLen = vocabCache.get(docs);
  if (!byLen) vocabCache.set(docs, (byLen = new Map()));
  let m = byLen.get(len);
  if (!m) {
    m = new Map();
    for (const d of docs) for (const text of [d.q, d.kw]) {
      for (let i = 0; i + len <= text.length; i++) {
        const w = text.slice(i, i + len);
        if (!/^[가-힣]+$/.test(w)) continue;
        const e = m.get(w);
        if (e) e.n++; else m.set(w, { j: jamo(w), n: 1 });
      }
    }
    byLen.set(len, m);
  }
  return m;
}
function fix(t: string, docs: FaqDoc[]): string | null {
  if (/^[a-z]+$/.test(t)) {
    const h = compose([...t].map((c) => KEYS[c] ?? c));
    return /^[가-힣]+$/.test(h) ? h : null;
  }
  const s = stem(t);
  if (!/^[가-힣]{2,}$/.test(s)) return null;
  const cap = s.length >= 3 ? 2 : 1;             // 두 글자 말은 자모 하나까지만 — 더 풀면 엉뚱한 말로 고친다
  const js = jamo(s);
  let best: string | null = null, bd = cap + 1, bn = 0;
  for (const len of [s.length - 1, s.length, s.length + 1]) {
    if (len < 2) continue;
    for (const [w, e] of vocab(docs, len)) {
      const d = lev(js, e.j, Math.min(cap, bd));
      if (d < bd || (d === bd && e.n > bn)) { best = w; bd = d; bn = e.n; }
    }
  }
  return bd <= cap ? best : null;
}

function hit(d: FaqDoc, fs: [string, number][]) {
  let best = 0;
  for (const [field, w] of W) for (const [f, k] of fs) if (d[field].includes(f)) best = Math.max(best, w * k);
  return best;
}

export function decideFaq(query: string, docs: FaqDoc[]): FaqDecision {
  // 글자·숫자 밖의 것(ㅠㅠ·ㅋ 같은 낱자, 이모지, 따옴표, 괄호, 가운뎃점)은 띄어쓰기로 바꾼다.
  //   지우면 '창(루버·갤러리창)은' 이 한 덩어리가 되어 아무 데도 안 걸린다
  const all = query.toLowerCase().replace(/[^\p{L}\p{N}]|[ㄱ-ㆎ]/gu, ' ').split(/\s+/).filter(Boolean);
  if (!all.length || !docs.length) return { kind: 'none' };
  const kept = all.filter((t) => !STOP.has(t) && !STOP.has(stem(t)));
  const tokens = kept.length ? kept : all;          // 군말만 쳤으면 그대로 찾는다

  const N = docs.length;
  const whole = normFaq(query);
  // 어느 문항에도 없는 말은 '문항 5%에 있는 말' 만큼만 친다. 버리면 '아이 건강' 처럼 질문의 핵심이 사라지고,
  //   드문 말처럼 무겁게 치면 긴 문장의 '나서부터·수십만 원씩' 같은 말 때문에 늘 고르기로 빠진다
  // 드문 정도는 온전한 꼴로만 센다 — '설치비' 를 끝 글자 뗀 '설치' 로 세면 거의 모든 문항에 걸려 흔한 말이 된다
  const count = (fs: [string, number][]) => docs.filter((d) => hit(d, fs.filter(([, k]) => k === 1))).length;
  const measured = tokens.map((t) => {
    let fs = forms(t);
    let df = count(fs);
    if (!df) {                                        // 어디에도 없으면 오타로 보고 한 번 고쳐 본다. 고친 말은 조금 덜 친다
      const f = fix(t, docs);
      const ffs = f ? forms(f) : [];
      const fdf = f ? count(ffs) : 0;
      if (fdf) { fs = ffs.map(([w, k]) => [w, k * 0.9] as [string, number]); df = fdf; }
    }
    return { fs, df };
  });
  if (!measured.some((t) => t.df > 0)) return { kind: 'none' };
  const terms = measured.map((t) => ({ fs: t.fs, common: t.df > N * 0.3, idf: Math.log(1 + (t.df ? N / t.df : 20)) }));
  const total = terms.reduce((a, t) => a + t.idf, 0);
  const rareTotal = terms.reduce((a, t) => a + (t.common ? 0 : t.idf), 0);

  // cov  = 물어본 말(드문 정도로 가중) 중 이 문항 어딘가에 있는 몫
  // sure = 드문 말 중 이 문항의 질문·검색어에 있는 몫 — 본문에만 스친 문항이 답이 되지 않게
  const scored = docs.map((d) => {
    let s = 0, got = 0, sure = 0;
    for (const t of terms) {
      const h = hit(d, t.fs);
      if (!h) continue;
      s += h * t.idf; got += t.idf;
      if (h >= 3 && !t.common) sure += t.idf;
    }
    return { id: d.id, s, cov: got / total, sure: rareTotal ? sure / rareTotal : 0, run: got ? run(whole, d.q) : 0 };
  });
  // 점수가 같으면 질문 제목과 이어서 겹치는 길이로 가른다 — 문항 순서가 답을 정하지 않게
  const ranked = scored.filter((x) => x.s > 0).sort((a, b) => b.s - a.s || b.run - a.run);
  const vague = !kept.length || rareTotal === 0;
  const [top, second] = ranked;
  // 1·2등이 둘 다 확실하고 점수가 가까우면 고르게 한다 — '청소비 얼마예요' 가 '세입자 청소비는 누가 내나요' 로 못 박히던 것.
  //   다만 물어본 말이 1등 질문 제목과 거의 그대로 겹치면(이어서 60% 이상) 그 문항이 답이다
  const exact = !!top && top.run >= Math.max(4, whole.length * 0.6);
  const close = !!second && second.sure >= Math.max(SURE, top.sure * 0.8) && second.cov >= COVER && second.s >= top.s * CLOSE;
  const tie = !!second && ((second.s === top.s && second.run === top.run) || (close && !exact));

  if (top && !vague && !tie && top.cov >= COVER && top.sure >= SURE) {
    // 관련 질문도 스친 문항은 빼고, 물어본 말을 충분히 담은 문항만 — 모자라면 페이지가 같은 분류에서 채운다
    return { kind: 'answer', id: top.id, near: ranked.slice(1).filter((x) => x.cov >= COVER && x.s >= top.s * 0.5).slice(0, 3).map((x) => x.id) };
  }
  // 고르게 할 때도 멀리 떨어진 문항은 뺀다 — 1등의 절반 점수 아래는 본문에 한 번 스친 정도다
  const near = ranked.filter((x) => x.s >= ranked[0].s * 0.5);
  if (near.length) return { kind: 'pick', ids: near.slice(0, 5).map((x) => x.id), vague };
  return { kind: 'none' };
}
