// faq.json 로더 — /faq/ 페이지와 챗봇 FAQ의 유일한 콘텐츠 소스 (빌드 타임).
//   - JSON 문법 오류 → 한글 에러 메시지로 빌드 실패
//   - 값 누락·타입 오류 → 한글 경고 후 해당 항목만 스킵
//   - status: 'hold' 항목은 페이지·챗봇·JSON-LD 모두 제외 (답이 확정되면 live로 전환)
//
// 두 개의 진입점:
//   loadFaq()     — 챗봇·/care/ faq_ref용 (구 시그니처 유지). chat_a가 있는 live 항목만,
//                   짧은 답(chat_a)으로 반환한다. 긴 마크다운 본문은 말풍선에 맞지 않는다.
//   loadFaqPage() — /faq/ 페이지용 전체 필드.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const FAQ_PATH = join(process.cwd(), 'src/content/site/faq.json');

/** next.tree 허용값 — 챗봇 TREE_START 키와 일치해야 한다 */
const VALID_TREES = ['install', 'clean', 'as', 'etc'] as const;
export const FAQ_CATEGORIES = ['비용', '세척', '설치', '진행', '사후'] as const;
export type FaqCategory = (typeof FAQ_CATEGORIES)[number];

export interface FaqItem {
  q: string;
  a: string;
  pinned: boolean;
  next: { label: string; tree: (typeof VALID_TREES)[number] } | null;
}

export interface FaqPageItem {
  id: string;
  category: FaqCategory;
  q: string;
  hook: string;
  a: string; // 마크다운 서브셋 (## / - / |표| / **굵게** / 빈 줄)
  priceNote: string;
  related: { label: string; href: string }[];
  updated: string;
}

const warn = (msg: string) => console.warn(`[faq.json 경고] ${msg}`);
const isNonEmptyString = (v: unknown): v is string => typeof v === 'string' && v.trim() !== '';

function readRaw(): any[] {
  let rawText: string;
  try {
    rawText = readFileSync(FAQ_PATH, 'utf8');
  } catch {
    warn('src/content/site/faq.json 파일을 찾을 수 없습니다 — FAQ를 건너뜁니다.');
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
        '[faq.json 오류] JSON 문법이 잘못되어 빌드를 중단합니다.',
        `원인: ${(e as Error).message}`,
        '확인할 것: 항목 끝의 쉼표(,) 누락/과잉, 짝이 안 맞는 따옴표(")나 괄호({ } [ ]).',
        '수정 위치: src/content/site/faq.json',
        '팁: 파일 내용을 jsonlint.com 에 붙여넣으면 틀린 줄을 짚어 줍니다.',
        '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
      ].join('\n'),
    );
  }
  const items = Array.isArray(raw?.items) ? raw.items : null;
  if (!items) {
    if (raw?.items !== undefined) warn('"items"는 배열([ ])이어야 합니다 — FAQ를 건너뜁니다.');
    return [];
  }
  return items;
}

/** live 판정 — hold·sample은 어디에도 노출하지 않는다 */
const isLive = (it: any) => it?.status !== 'hold' && it?.sample !== true;

/* ---------- 챗봇·/care/ 호환 (구 시그니처) ---------- */
export function loadFaq(): FaqItem[] {
  const out: FaqItem[] = [];
  readRaw().forEach((it: any, i: number) => {
    if (!isLive(it)) return;
    // 챗봇은 짧은 답만 — chat_a가 없는 항목은 페이지 전용
    const shortA = isNonEmptyString(it?.chat_a) ? it.chat_a.trim() : '';
    if (!isNonEmptyString(it?.q) || !shortA) return;
    let next: FaqItem['next'] = null;
    if (it.next !== undefined && it.next !== null) {
      if (isNonEmptyString(it.next?.label) && VALID_TREES.includes(it.next?.tree)) {
        next = { label: it.next.label.trim(), tree: it.next.tree };
      } else {
        warn(`items[${i}] — next는 label(문구)과 tree(${VALID_TREES.join('/')})가 필요합니다. next만 무시합니다.`);
      }
    }
    out.push({ q: it.q.trim(), a: shortA, pinned: it.pinned === true, next });
  });
  return out;
}

/* ---------- /faq/ 페이지용 ---------- */
export function loadFaqPage(): FaqPageItem[] {
  const out: FaqPageItem[] = [];
  readRaw().forEach((it: any, i: number) => {
    if (!isLive(it)) return; // hold = 미노출 (답 채우고 live로 바꾸면 노출)
    if (!isNonEmptyString(it?.q) || !isNonEmptyString(it?.a)) {
      // live인데 답이 비어 있으면 hold와 동일하게 스킵 (경고로 알림)
      if (isNonEmptyString(it?.q)) warn(`items[${i}] "${it.q}" — a(답변)가 비어 페이지에서 제외합니다. 답을 채우거나 status를 hold로 바꾸세요.`);
      return;
    }
    const cat = isNonEmptyString(it?.category) && (FAQ_CATEGORIES as readonly string[]).includes(it.category.trim())
      ? (it.category.trim() as FaqCategory)
      : null;
    if (!cat) {
      warn(`items[${i}] "${it.q}" — category는 ${FAQ_CATEGORIES.join('/')} 중 하나여야 합니다. 항목을 건너뜁니다.`);
      return;
    }
    const related: { label: string; href: string }[] = [];
    if (Array.isArray(it.related)) {
      it.related.forEach((r: any) => {
        if (isNonEmptyString(r?.label) && isNonEmptyString(r?.href)) related.push({ label: r.label.trim(), href: r.href.trim() });
      });
    }
    out.push({
      id: isNonEmptyString(it.id) ? it.id.trim() : `faq-${i}`,
      category: cat,
      q: it.q.trim(),
      hook: isNonEmptyString(it.hook) ? it.hook.trim() : '',
      a: it.a.trim(),
      priceNote: isNonEmptyString(it.price_note) ? it.price_note.trim() : '',
      related,
      updated: isNonEmptyString(it.updated) ? it.updated.trim() : '',
    });
  });
  return out;
}

/* ---------- 마크다운 서브셋 렌더러 (외부 라이브러리 금지) ----------
   지원: ## 소제목 / - 목록 / |표| / **굵게** / 빈 줄 문단.
   먼저 전부 이스케이프한 뒤 변환하므로 본문의 <, > 는 안전하다. */
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const bold = (s: string) => s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

export function renderFaqMd(src: string): string {
  const blocks = src.split(/\n\s*\n/);
  return blocks
    .map((block) => {
      const lines = block.split('\n').map((l) => l.trim()).filter(Boolean);
      if (!lines.length) return '';
      if (lines.every((l) => l.startsWith('|'))) {
        // 표 — 첫 행 헤더, |---| 구분행은 무시
        const rows = lines
          .filter((l) => !/^\|[\s\-|:]+\|$/.test(l))
          .map((l) => l.replace(/^\||\|$/g, '').split('|').map((c) => bold(esc(c.trim()))));
        const [head, ...body] = rows;
        return `<table><thead><tr>${head.map((c) => `<th>${c}</th>`).join('')}</tr></thead>` +
          `<tbody>${body.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
      }
      if (lines.every((l) => l.startsWith('- '))) {
        return `<ul>${lines.map((l) => `<li>${bold(esc(l.slice(2)))}</li>`).join('')}</ul>`;
      }
      if (lines[0].startsWith('## ')) {
        const rest = lines.slice(1);
        return `<h3>${bold(esc(lines[0].slice(3)))}</h3>` + (rest.length ? renderFaqMd(rest.join('\n')) : '');
      }
      return `<p>${lines.map((l) => bold(esc(l))).join('<br />')}</p>`;
    })
    .filter(Boolean)
    .join('');
}

/** JSON-LD용 — 마크다운 기호를 걷어낸 평문 */
export function faqPlainText(src: string): string {
  return src
    .replace(/^##\s+/gm, '')
    .replace(/^\-\s+/gm, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/^\|.*\|$/gm, (row) => row.replace(/\|/g, ' ').trim())
    .replace(/\s+/g, ' ')
    .trim();
}
