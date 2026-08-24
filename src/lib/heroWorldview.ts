// hero-worldview.json 로더 — 홈 다크 구간(스크럽) 카피의 유일한 소스
// (빌드 타임, standards/pricing/faq와 동일 운영 원칙: 문법 오류 → 빌드 실패 / 값 누락 → 해당 단계만 스킵).
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const PATH = join(process.cwd(), 'src/content/site/hero-worldview.json');

export interface WorldviewStep {
  lines: string[];
  /** 이 구간의 종착점 — 다른 단계보다 크게 표시 */
  emphasis: boolean;
}

export interface WorldviewData {
  steps: WorldviewStep[];
  /** 1단계 통계의 출처 한 줄 — 구간 하단에 작게 표시. 비면 미노출 */
  source: string;
}

const warn = (msg: string) => console.warn(`[hero-worldview.json 경고] ${msg}`);
const isNonEmptyString = (v: unknown): v is string => typeof v === 'string' && v.trim() !== '';

export function loadHeroWorldview(): WorldviewData {
  let rawText: string;
  try {
    rawText = readFileSync(PATH, 'utf8');
  } catch {
    warn('src/content/site/hero-worldview.json 파일을 찾을 수 없습니다 — 다크 구간 카피를 건너뜁니다.');
    return { steps: [], source: '' };
  }

  let raw: any;
  try {
    raw = JSON.parse(rawText);
  } catch (e) {
    throw new Error(
      [
        '',
        '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
        '[hero-worldview.json 오류] JSON 문법이 잘못되어 빌드를 중단합니다.',
        `원인: ${(e as Error).message}`,
        '확인할 것: 항목 끝의 쉼표(,) 누락/과잉, 짝이 안 맞는 따옴표(")나 괄호({ } [ ]).',
        '수정 위치: src/content/site/hero-worldview.json',
        '팁: 파일 내용을 jsonlint.com 에 붙여넣으면 틀린 줄을 짚어 줍니다.',
        '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
      ].join('\n'),
    );
  }

  const rawSteps = Array.isArray(raw?.steps) ? raw.steps : [];
  if (raw?.steps !== undefined && !Array.isArray(raw.steps)) {
    warn('"steps"는 배열([ ])이어야 합니다 — 다크 구간 카피를 건너뜁니다.');
  }

  const out: WorldviewStep[] = [];
  rawSteps.forEach((s: any, i: number) => {
    const lines = Array.isArray(s?.lines) ? s.lines.filter(isNonEmptyString).map((l: string) => l.trim()) : [];
    if (!lines.length) {
      if (s?.lines !== undefined) warn(`steps[${i}] — lines가 비어 단계를 건너뜁니다.`);
      return; // 빈 단계 = 조용히 제외
    }
    out.push({ lines, emphasis: s?.emphasis === true });
  });
  const source = isNonEmptyString(raw?.source) ? raw.source.trim() : '';
  return { steps: out, source };
}
