// 시공 기록(전체) — 일정 기록에서 뽑은 현장 한 건 = 한 줄. 사진 사례(content/cases)와 별개로, 끝난 현장 전체를 날짜순으로 보여 준다.
// 원본: 비공개 현장 저장소가 만든 src/content/site/case-log.json (동·호수·고객명·팀 이름은 처음부터 들어 있지 않다).
// 단지명은 한국부동산원 공동주택 단지 목록과 맞춰 본 것만 싣는다 — 못 맞춘 현장은 지역·공간까지만 나온다.
// 숫자(건수·대수·기간)는 전부 이 파일에서 센다. 문장에 쓸 숫자를 따로 적지 않는다.
import raw from '../content/site/case-log.json';

export interface LogRecord {
  /** 마지막 단계(마감) 날짜 YYYY-MM-DD */
  d: string;
  t: '설치' | '세척' | '복원';
  b?: string;
  u?: number;
  sp?: string;
  /** 시·도 시·구 (예: 경기 성남) */
  r: string;
  apt?: string;
  slug?: string;
  dong?: string;
  gu?: string;
}
export interface Complex {
  slug: string;
  name: string;
  dong: string;
  gu: string;
  region: string;
  records: LogRecord[];
}

export const LOG_UPDATED: string = (raw as { updated: string }).updated;
export const RECORDS: LogRecord[] = (raw as { records: LogRecord[] }).records;

export const ymOf = (d: string) => d.slice(0, 7);
export const fmtDate = (d: string) => { const [y, m, dd] = d.split('-').map(Number); return `${y}년 ${m}월 ${dd}일`; };
export const fmtDay = (d: string) => { const [, m, dd] = d.split('-').map(Number); return `${m}월 ${dd}일`; };
export const fmtYm = (ym: string) => { const [y, m] = ym.split('-').map(Number); return `${y}년 ${m}월`; };
export const regionSlug = (r: string) => r.replace(/\s+/g, '-');

const group = <T, K extends string>(a: T[], key: (x: T) => K | undefined) => {
  const m = new Map<K, T[]>();
  for (const x of a) { const k = key(x); if (k == null) continue; (m.get(k) ?? m.set(k, []).get(k)!).push(x); }
  return m;
};

export const COMPLEXES: Complex[] = [...group(RECORDS, (r) => r.slug).entries()]
  .map(([slug, records]) => ({ slug, name: records[0].apt!, dong: records[0].dong!, gu: records[0].gu!, region: records[0].r, records }))
  .sort((a, b) => b.records.length - a.records.length || a.name.localeCompare(b.name, 'ko'));
export const COMPLEX_BY_SLUG = new Map(COMPLEXES.map((c) => [c.slug, c]));

export const MONTHS: { ym: string; records: LogRecord[] }[] = [...group(RECORDS, (r) => ymOf(r.d)).entries()]
  .map(([ym, records]) => ({ ym, records }))
  .sort((a, b) => b.ym.localeCompare(a.ym));

const PROV = ['서울', '경기', '인천'];
const provRank = (r: string) => { const k = PROV.indexOf(r.split(' ')[0]); return k < 0 ? 9 : k; };
export const REGIONS: { region: string; records: LogRecord[]; complexes: Complex[] }[] = [...group(RECORDS, (r) => r.r).entries()]
  .map(([region, records]) => ({ region, records, complexes: COMPLEXES.filter((c) => c.region === region) }))
  .sort((a, b) => provRank(a.region) - provRank(b.region) || b.records.length - a.records.length);

/** 한 묶음의 집계 — 문장·표에 쓰는 숫자는 여기서만 나온다 */
export function stats(records: LogRecord[]) {
  const dates = records.map((r) => r.d).sort();
  const brands = new Map<string, number>();
  for (const r of records) if (r.b) brands.set(r.b, (brands.get(r.b) ?? 0) + 1);
  const units = records.map((r) => r.u).filter((u): u is number => !!u);
  const unitCount = new Map<number, number>();
  for (const u of units) unitCount.set(u, (unitCount.get(u) ?? 0) + 1);
  const mode = [...unitCount.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0];
  return {
    n: records.length,
    first: dates[0],
    last: dates[dates.length - 1],
    brands: [...brands.entries()].sort((a, b) => b[1] - a[1]),
    unitsKnown: units.length,
    unitsTotal: units.reduce((s, u) => s + u, 0),
    unitsMin: units.length ? Math.min(...units) : 0,
    unitsMax: units.length ? Math.max(...units) : 0,
    unitsMode: mode ? { u: mode[0], n: mode[1] } : null,
  };
}

/** '삼성 5건·LG 2건' */
export const brandLine = (b: [string, number][]) => b.map(([name, n]) => `${name} ${n}건`).join(' · ');
/** 한 줄 요약 — 브랜드·대수·작업 (없는 값은 뺀다) */
export const recordLine = (r: LogRecord) => [r.b, r.u ? `${r.u}대` : '', r.t].filter(Boolean).join(' ');
/** 기록의 자리 이름 — 단지가 확인된 현장은 '동 단지명', 아니면 공간 종류 */
export const placeOf = (r: LogRecord) => (r.apt ? `${r.dong} ${r.apt}` : r.sp ?? '현장');
