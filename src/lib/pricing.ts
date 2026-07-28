// pricing.json 로더 — /care/ 세척 페이지의 유일한 가격·문구 소스 (빌드 타임, trust/faq와 동일 운영 원칙).
//   - JSON 문법 오류 → 한글 에러 메시지로 빌드 실패
//   - 값 누락·타입 오류 → 한글 경고 후 해당 항목/섹션만 스킵
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const PRICING_PATH = join(process.cwd(), 'src/content/site/pricing.json');

export const SYMPTOM_ICONS = ['smell', 'wind', 'stain', 'drip'] as const;

export interface PriceRow { type: string; base: number; unit: string; note: string }
export interface ProcessStep { step: number; title: string; body: string; image: string }
export interface SymptomCard { icon: (typeof SYMPTOM_ICONS)[number] | ''; title: string; body: string }
export interface SeasonCard { season: string; body: string }
export interface PricingData {
  headline: string;
  intro: string;
  prices: PriceRow[];
  conditions: string[];
  process: ProcessStep[];
  symptoms: SymptomCard[];
  seasons: SeasonCard[];
  faqRef: boolean;
}

const EMPTY: PricingData = {
  headline: '', intro: '', prices: [], conditions: [], process: [], symptoms: [], seasons: [], faqRef: false,
};

const warn = (msg: string) => console.warn(`[pricing.json 경고] ${msg}`);
const isNonEmptyString = (v: unknown): v is string => typeof v === 'string' && v.trim() !== '';

function pickArray<T>(raw: unknown, name: string, validate: (item: any, idx: number) => T | null): T[] {
  if (raw === undefined || raw === null) return [];
  if (!Array.isArray(raw)) {
    warn(`"${name}"는 배열([ ])이어야 합니다 — 섹션을 건너뜁니다.`);
    return [];
  }
  const out: T[] = [];
  raw.forEach((item, idx) => {
    const v = validate(item, idx);
    if (v !== null) out.push(v);
  });
  return out;
}

export function loadPricing(): PricingData {
  let rawText: string;
  try {
    rawText = readFileSync(PRICING_PATH, 'utf8');
  } catch {
    warn('src/content/site/pricing.json 파일을 찾을 수 없습니다 — 가격·문구 섹션을 건너뜁니다.');
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
        '[pricing.json 오류] JSON 문법이 잘못되어 빌드를 중단합니다.',
        `원인: ${(e as Error).message}`,
        '확인할 것: 항목 끝의 쉼표(,) 누락/과잉, 짝이 안 맞는 따옴표(")나 괄호({ } [ ]).',
        '수정 위치: src/content/site/pricing.json',
        '팁: 파일 내용을 jsonlint.com 에 붙여넣으면 틀린 줄을 짚어 줍니다.',
        '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
      ].join('\n'),
    );
  }

  const prices = pickArray<PriceRow>(raw.prices, 'prices', (it, i) => {
    if (!isNonEmptyString(it?.type) || typeof it?.base !== 'number' || !isFinite(it.base) || it.base <= 0 || !isNonEmptyString(it?.unit)) {
      if (it?.type || it?.base) warn(`prices[${i}] — type(문자)·base(양수)·unit(문자)이 모두 필요합니다. 항목을 건너뜁니다.`);
      return null;
    }
    return { type: it.type.trim(), base: it.base, unit: it.unit.trim(), note: isNonEmptyString(it.note) ? it.note.trim() : '' };
  });

  const conditions = pickArray<string>(raw.conditions, 'conditions', (it) =>
    isNonEmptyString(it) ? it.trim() : null,
  );

  const process = pickArray<ProcessStep>(raw.process, 'process', (it, i) => {
    if (typeof it?.step !== 'number' || !isNonEmptyString(it?.title) || !isNonEmptyString(it?.body)) {
      if (it?.title || it?.body) warn(`process[${i}] — step(숫자)·title·body가 모두 필요합니다. 항목을 건너뜁니다.`);
      return null;
    }
    return { step: it.step, title: it.title.trim(), body: it.body.trim(), image: isNonEmptyString(it.image) ? it.image.trim() : '' };
  });

  const symptoms = pickArray<SymptomCard>(raw.symptoms, 'symptoms', (it, i) => {
    if (!isNonEmptyString(it?.title) || !isNonEmptyString(it?.body)) {
      if (it?.title || it?.body) warn(`symptoms[${i}] — title과 body가 모두 필요합니다. 항목을 건너뜁니다.`);
      return null;
    }
    let icon: SymptomCard['icon'] = '';
    if (isNonEmptyString(it.icon)) {
      if ((SYMPTOM_ICONS as readonly string[]).includes(it.icon.trim())) icon = it.icon.trim() as SymptomCard['icon'];
      else warn(`symptoms[${i}] — icon "${it.icon}"을 모릅니다 (${SYMPTOM_ICONS.join('/')}). 아이콘 없이 표시합니다.`);
    }
    return { icon, title: it.title.trim(), body: it.body.trim() };
  });

  const seasons = pickArray<SeasonCard>(raw.seasons, 'seasons', (it, i) => {
    if (!isNonEmptyString(it?.season) || !isNonEmptyString(it?.body)) {
      if (it?.season || it?.body) warn(`seasons[${i}] — season과 body가 모두 필요합니다. 항목을 건너뜁니다.`);
      return null;
    }
    return { season: it.season.trim(), body: it.body.trim() };
  });

  return {
    headline: isNonEmptyString(raw.headline) ? raw.headline.trim() : '',
    intro: isNonEmptyString(raw.intro) ? raw.intro.trim() : '',
    prices,
    conditions,
    process,
    symptoms,
    seasons,
    faqRef: raw.faq_ref === true,
  };
}
