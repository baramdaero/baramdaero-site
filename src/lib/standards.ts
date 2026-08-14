// standards.json 로더 — 기준가 철학·견적 비교 체크리스트의 유일한 콘텐츠 소스
// (빌드 타임, trust/pricing/faq와 동일 운영 원칙: 문법 오류 → 빌드 실패 / 값 누락 → 해당 항목만 스킵).
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const STANDARDS_PATH = join(process.cwd(), 'src/content/site/standards.json');

export interface ChecklistItem { q: string; why: string; ours: string }
export interface Checklist { title: string; items: ChecklistItem[] }
export interface PromiseItem { no: string; title: string; lines: string[] }
export interface PromiseBlock { heading: string; items: PromiseItem[] }
export interface StandardsData {
  baseline: {
    title: string;
    updated: string;
    bodyLines: string[];
    formulaLine: string;
    policyLines: string[];
  } | null;
  noExtra: { title: string; items: string[]; closing: string } | null;
  promise: PromiseBlock | null;
  careChecklist: Checklist | null;
  installChecklist: Checklist | null;
}

const EMPTY: StandardsData = {
  baseline: null,
  noExtra: null,
  promise: null,
  careChecklist: null,
  installChecklist: null,
};

const warn = (msg: string) => console.warn(`[standards.json 경고] ${msg}`);
const isNonEmptyString = (v: unknown): v is string => typeof v === 'string' && v.trim() !== '';
const strArray = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter(isNonEmptyString).map((s) => s.trim()) : [];

function pickChecklist(raw: any, name: string): Checklist | null {
  if (!raw) return null;
  if (!isNonEmptyString(raw.title) || !Array.isArray(raw.items)) {
    warn(`"${name}" — title과 items가 필요합니다. 섹션을 건너뜁니다.`);
    return null;
  }
  const items: ChecklistItem[] = [];
  raw.items.forEach((it: any, i: number) => {
    if (!isNonEmptyString(it?.q) || !isNonEmptyString(it?.why)) {
      if (it?.q || it?.why) warn(`${name}.items[${i}] — q와 why가 모두 필요합니다. 항목을 건너뜁니다.`);
      return;
    }
    items.push({
      q: it.q.trim(),
      why: it.why.trim(),
      ours: isNonEmptyString(it.ours) ? it.ours.trim() : '', // 빈 값 = '바람대로는' 줄 미노출
    });
  });
  return items.length ? { title: raw.title.trim(), items } : null;
}

export function loadStandards(): StandardsData {
  let rawText: string;
  try {
    rawText = readFileSync(STANDARDS_PATH, 'utf8');
  } catch {
    warn('src/content/site/standards.json 파일을 찾을 수 없습니다 — 기준가·체크리스트 섹션을 건너뜁니다.');
    return EMPTY;
  }

  let raw: any;
  try {
    raw = JSON.parse(rawText);
  } catch (e) {
    throw new Error(
      [
        '',
        '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
        '[standards.json 오류] JSON 문법이 잘못되어 빌드를 중단합니다.',
        `원인: ${(e as Error).message}`,
        '확인할 것: 항목 끝의 쉼표(,) 누락/과잉, 짝이 안 맞는 따옴표(")나 괄호({ } [ ]).',
        '수정 위치: src/content/site/standards.json',
        '팁: 파일 내용을 jsonlint.com 에 붙여넣으면 틀린 줄을 짚어 줍니다.',
        '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
      ].join('\n'),
    );
  }

  let baseline: StandardsData['baseline'] = null;
  if (raw.baseline) {
    const b = raw.baseline;
    const bodyLines = strArray(b.body_lines);
    if (isNonEmptyString(b.title) && bodyLines.length) {
      baseline = {
        title: b.title.trim(),
        updated: isNonEmptyString(b.updated) ? b.updated.trim() : '', // 빈 값 = 갱신일 줄 미노출
        bodyLines,
        formulaLine: isNonEmptyString(b.formula_line) ? b.formula_line.trim() : '',
        policyLines: strArray(b.policy_lines),
      };
    } else {
      warn('"baseline" — title과 body_lines가 필요합니다. 블록을 건너뜁니다.');
    }
  }

  let noExtra: StandardsData['noExtra'] = null;
  if (raw.no_extra) {
    const n = raw.no_extra;
    const items = strArray(n.items);
    if (isNonEmptyString(n.title) && items.length) {
      noExtra = { title: n.title.trim(), items, closing: isNonEmptyString(n.closing) ? n.closing.trim() : '' };
    } else {
      warn('"no_extra" — title과 items가 필요합니다. 블록을 건너뜁니다.');
    }
  }

  /* ---------- promise — 「바람대로가 일하는 방식」 선언 ---------- */
  let promise: PromiseBlock | null = null;
  if (raw.promise) {
    const heading = isNonEmptyString(raw.promise.heading) ? raw.promise.heading.trim() : '';
    const items: PromiseItem[] = [];
    if (Array.isArray(raw.promise.items)) {
      raw.promise.items.forEach((it: any, i: number) => {
        if (!isNonEmptyString(it?.title)) {
          if (it?.title || it?.lines) warn(`promise.items[${i}] — title이 필요합니다. 항목을 건너뜁니다.`);
          return;
        }
        items.push({
          no: isNonEmptyString(it?.no) ? it.no.trim() : String(i + 1).padStart(2, '0'),
          title: it.title.trim(),
          lines: strArray(it?.lines),
        });
      });
    }
    // 항목이 하나도 없으면 블록째 미노출 (빈 값 = 미노출 규칙)
    if (heading && items.length) promise = { heading, items };
    else if (raw.promise.heading || raw.promise.items) {
      warn('"promise" — heading과 items가 모두 필요합니다. 블록을 건너뜁니다.');
    }
  }

  return {
    baseline,
    noExtra,
    promise,
    careChecklist: pickChecklist(raw.care_checklist, 'care_checklist'),
    installChecklist: pickChecklist(raw.install_checklist, 'install_checklist'),
  };
}
