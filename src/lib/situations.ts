// situations.json 로더 — 상황별 안내 페이지(/situation/○○/)의 유일한 콘텐츠 소스
// (빌드 타임, standards/faq와 동일 운영 원칙: 문법 오류 → 빌드 실패 / 값 누락 → 해당 항목만 스킵).
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const SITUATIONS_PATH = join(process.cwd(), 'src/content/site/situations.json');

export interface TimelineStage {
  stage: string;
  when: string;
  todo: string[];
  caution: string;
}
export interface Situation {
  slug: string;
  meta: {
    title: string;
    description: string;
    eyebrow: string;
    /** 줄 단위 히어로 제목 — JSON의 \n 으로 분리 */
    headlineLines: string[];
    intro: string;
    cardLine: string;
  };
  timeline: TimelineStage[];
  prewired: { title: string; bodyLines: string[]; checkItems: string[] } | null;
  groupBuy: { title: string; body: string; ctaLabel: string } | null;
  faqTags: string[];
  related: { label: string; href: string }[];
}

const warn = (msg: string) => console.warn(`[situations.json 경고] ${msg}`);
const isNonEmptyString = (v: unknown): v is string => typeof v === 'string' && v.trim() !== '';
const strArray = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter(isNonEmptyString).map((s) => s.trim()) : [];

function pickTimeline(raw: unknown, slug: string): TimelineStage[] {
  if (!Array.isArray(raw)) {
    if (raw !== undefined) warn(`"${slug}.timeline"은 배열([ ])이어야 합니다 — 타임라인을 건너뜁니다.`);
    return [];
  }
  const out: TimelineStage[] = [];
  raw.forEach((st: any, i: number) => {
    const todo = strArray(st?.todo);
    if (!isNonEmptyString(st?.stage) || !todo.length) {
      if (st?.stage || todo.length) warn(`${slug}.timeline[${i}] — stage와 todo가 모두 필요합니다. 단계를 건너뜁니다.`);
      return;
    }
    out.push({
      stage: st.stage.trim(),
      when: isNonEmptyString(st.when) ? st.when.trim() : '', // 빈 값 = 시점 줄 미노출
      todo,
      caution: isNonEmptyString(st.caution) ? st.caution.trim() : '', // 빈 값 = 주의 줄 미노출
    });
  });
  return out;
}

function pickSituation(slug: string, raw: any, knownSlugs: Set<string>): Situation | null {
  const m = raw?.meta;
  if (!isNonEmptyString(m?.title)) {
    warn(`"${slug}" — meta.title이 필요합니다. 이 페이지를 만들지 않습니다.`);
    return null;
  }

  let prewired: Situation['prewired'] = null;
  if (raw.prewired) {
    const p = raw.prewired;
    const checkItems = strArray(p.check_items);
    if (isNonEmptyString(p.title) && checkItems.length) {
      prewired = { title: p.title.trim(), bodyLines: strArray(p.body_lines), checkItems };
    } else {
      warn(`"${slug}.prewired" — title과 check_items가 필요합니다. 블록을 건너뜁니다.`);
    }
  }

  let groupBuy: Situation['groupBuy'] = null;
  if (raw.group_buy) {
    const g = raw.group_buy;
    if (isNonEmptyString(g.title) && isNonEmptyString(g.body)) {
      groupBuy = {
        title: g.title.trim(),
        body: g.body.trim(),
        ctaLabel: isNonEmptyString(g.cta_label) ? g.cta_label.trim() : '', // 빈 값 = 버튼만 미노출
      };
    } else {
      warn(`"${slug}.group_buy" — title과 body가 필요합니다. 블록을 건너뜁니다.`);
    }
  }

  // 아직 만들지 않은 /situation/○○/ 링크는 숨긴다 (죽은 링크 차단 — 헤더·푸터와 동일 규칙)
  const related = (Array.isArray(raw.related) ? raw.related : [])
    .filter((r: any) => isNonEmptyString(r?.label) && isNonEmptyString(r?.href))
    .map((r: any) => ({ label: r.label.trim(), href: r.href.trim() }))
    .filter((r: { href: string }) => {
      const hit = r.href.match(/^\/situation\/([^/]+)\/?$/);
      return !hit || knownSlugs.has(hit[1]);
    });

  return {
    slug,
    meta: {
      title: m.title.trim(),
      description: isNonEmptyString(m.description) ? m.description.trim() : '',
      eyebrow: isNonEmptyString(m.eyebrow) ? m.eyebrow.trim() : '',
      headlineLines: isNonEmptyString(m.headline)
        ? m.headline.split('\n').map((s: string) => s.trim()).filter(Boolean)
        : [m.title.trim()], // headline이 비면 title로 대체
      intro: isNonEmptyString(m.intro) ? m.intro.trim() : '',
      cardLine: isNonEmptyString(m.card_line) ? m.card_line.trim() : '',
    },
    timeline: pickTimeline(raw.timeline, slug),
    prewired,
    groupBuy,
    faqTags: strArray(raw.faq_tags),
    related,
  };
}

/** JSON 키 순서 = 페이지·카드 노출 순서 */
export function loadSituations(): Situation[] {
  let rawText: string;
  try {
    rawText = readFileSync(SITUATIONS_PATH, 'utf8');
  } catch {
    warn('src/content/site/situations.json 파일을 찾을 수 없습니다 — 상황별 안내를 건너뜁니다.');
    return [];
  }

  let raw: any;
  try {
    raw = JSON.parse(rawText);
  } catch (e) {
    throw new Error(
      [
        '',
        '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
        '[situations.json 오류] JSON 문법이 잘못되어 빌드를 중단합니다.',
        `원인: ${(e as Error).message}`,
        '확인할 것: 항목 끝의 쉼표(,) 누락/과잉, 짝이 안 맞는 따옴표(")나 괄호({ } [ ]).',
        '수정 위치: src/content/site/situations.json',
        '팁: 파일 내용을 jsonlint.com 에 붙여넣으면 틀린 줄을 짚어 줍니다.',
        '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
      ].join('\n'),
    );
  }

  // "_"로 시작하는 키는 편집자용 설명 블록 (_설명) — 페이지가 아니다
  const slugs = Object.keys(raw ?? {}).filter((k) => !k.startsWith('_'));
  const knownSlugs = new Set(slugs);
  return slugs
    .map((slug) => pickSituation(slug, raw[slug], knownSlugs))
    .filter((s): s is Situation => s !== null);
}
