// home.json 로더 — 홈 섹션 카피의 유일한 소스
// (빌드 타임, standards/hero-worldview와 동일 원칙: 문법 오류 → 빌드 실패 / 값 누락 → 해당 항목만 스킵).
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const HOME_PATH = join(process.cwd(), 'src/content/site/home.json');

export interface HomeCta { label: string; href: string }
export interface HomeService {
  eyebrow: string;
  heading: string[];
  lines: string[];
  cta: HomeCta | null;
}
export interface HomeProcessStep { no: string; title: string; body: string }
export interface HomeData {
  services: { leadHeading: string[]; cards: HomeService[] };
  situations: { eyebrow: string; heading: string[] } | null;
  process: { eyebrow: string; heading: string[]; steps: HomeProcessStep[] } | null;
  ctaBand: {
    heading: string[];
    headingEmphasis: string;
    body: string;
    buttonLabel: string;
  } | null;
}

const EMPTY: HomeData = {
  services: { leadHeading: [], cards: [] },
  situations: null,
  process: null,
  ctaBand: null,
};

const warn = (msg: string) => console.warn(`[home.json 경고] ${msg}`);
const isNonEmptyString = (v: unknown): v is string => typeof v === 'string' && v.trim() !== '';
const strArray = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter(isNonEmptyString).map((s) => s.trim()) : [];

export function loadHome(): HomeData {
  let rawText: string;
  try {
    rawText = readFileSync(HOME_PATH, 'utf8');
  } catch {
    warn('src/content/site/home.json 파일을 찾을 수 없습니다 — 홈 섹션 문구를 건너뜁니다.');
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
        '[home.json 오류] JSON 문법이 잘못되어 빌드를 중단합니다.',
        `원인: ${(e as Error).message}`,
        '확인할 것: 항목 끝의 쉼표(,) 누락/과잉, 짝이 안 맞는 따옴표(")나 괄호({ } [ ]).',
        '수정 위치: src/content/site/home.json',
        '팁: 파일 내용을 jsonlint.com 에 붙여넣으면 틀린 줄을 짚어 줍니다.',
        '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
      ].join('\n'),
    );
  }

  /* ---------- services (도입 문장 + 카드 목록) ---------- */
  const cards: HomeService[] = [];
  const leadHeading = strArray(raw?.services?.lead_heading);
  const rawCards = Array.isArray(raw?.services?.cards) ? raw.services.cards : [];
  if (raw?.services?.cards !== undefined && !Array.isArray(raw.services.cards)) {
    warn('"services.cards"는 배열([ ])이어야 합니다 — 서비스 카드를 건너뜁니다.');
  }
  rawCards.forEach((s: any, i: number) => {
    const heading = strArray(s?.heading);
    if (!heading.length) {
      warn(`services.cards[${i}] — heading이 비어 카드를 건너뜁니다.`);
      return;
    }
    let cta: HomeCta | null = null;
    if (isNonEmptyString(s?.cta?.label) && isNonEmptyString(s?.cta?.href)) {
      cta = { label: s.cta.label.trim(), href: s.cta.href.trim() };
    } else if (s?.cta?.label || s?.cta?.href) {
      warn(`services.cards[${i}].cta — label과 href가 모두 필요합니다. 링크만 빼고 카드는 유지합니다.`);
    }
    cards.push({
      eyebrow: isNonEmptyString(s?.eyebrow) ? s.eyebrow.trim() : '',
      heading,
      lines: strArray(s?.lines),
      cta,
    });
  });

  /* ---------- situations (라벨·제목만) ---------- */
  let situations: HomeData['situations'] = null;
  if (raw?.situations) {
    const heading = strArray(raw.situations.heading);
    if (heading.length) {
      situations = {
        eyebrow: isNonEmptyString(raw.situations.eyebrow) ? raw.situations.eyebrow.trim() : '',
        heading,
      };
    } else {
      warn('"situations.heading"이 비어 기본 문구를 사용합니다.');
    }
  }

  /* ---------- process ---------- */
  let process: HomeData['process'] = null;
  if (raw?.process) {
    const heading = strArray(raw.process.heading);
    const steps: HomeProcessStep[] = [];
    if (Array.isArray(raw.process.steps)) {
      raw.process.steps.forEach((st: any, i: number) => {
        if (!isNonEmptyString(st?.title) || !isNonEmptyString(st?.body)) {
          if (st?.title || st?.body) warn(`process.steps[${i}] — title과 body가 모두 필요합니다. 단계를 건너뜁니다.`);
          return;
        }
        steps.push({
          no: isNonEmptyString(st?.no) ? st.no.trim() : String(i + 1).padStart(2, '0'),
          title: st.title.trim(),
          body: st.body.trim(),
        });
      });
    }
    if (heading.length && steps.length) {
      process = {
        eyebrow: isNonEmptyString(raw.process.eyebrow) ? raw.process.eyebrow.trim() : '',
        heading,
        steps,
      };
    } else {
      warn('"process" — heading과 steps가 모두 필요합니다. 절차 섹션을 건너뜁니다.');
    }
  }

  /* ---------- cta_band ---------- */
  let ctaBand: HomeData['ctaBand'] = null;
  if (raw?.cta_band) {
    const heading = strArray(raw.cta_band.heading);
    if (heading.length) {
      ctaBand = {
        heading,
        headingEmphasis: isNonEmptyString(raw.cta_band.heading_emphasis)
          ? raw.cta_band.heading_emphasis.trim()
          : '',
        body: isNonEmptyString(raw.cta_band.body) ? raw.cta_band.body.trim() : '',
        buttonLabel: isNonEmptyString(raw.cta_band.button_label) ? raw.cta_band.button_label.trim() : '',
      };
    } else {
      warn('"cta_band.heading"이 비어 CTA 밴드를 건너뜁니다.');
    }
  }

  return { services: { leadHeading, cards }, situations, process, ctaBand };
}
