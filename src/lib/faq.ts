// faq.json 로더 — 챗봇 FAQ의 유일한 콘텐츠 소스 (빌드 타임 실행, trust.ts와 동일 운영 원칙).
//   - JSON 문법 오류 → 한글 에러 메시지로 빌드 실패
//   - 값 누락·타입 오류 → 한글 경고 후 해당 항목만 스킵
// 정제된 결과는 Chatbot.astro가 <script type="application/json">으로 클라이언트에 주입한다.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const FAQ_PATH = join(process.cwd(), 'src/content/site/faq.json');

/** next.tree 허용값 — 챗봇 TREE_START 키와 일치해야 한다 */
const VALID_TREES = ['install', 'clean', 'as', 'etc'] as const;

export interface FaqItem {
  q: string;
  a: string;
  pinned: boolean;
  next: { label: string; tree: (typeof VALID_TREES)[number] } | null;
}

const warn = (msg: string) => console.warn(`[faq.json 경고] ${msg}`);
const isNonEmptyString = (v: unknown): v is string => typeof v === 'string' && v.trim() !== '';

export function loadFaq(): FaqItem[] {
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

  const out: FaqItem[] = [];
  items.forEach((it: any, i: number) => {
    // "sample": true = 형식 참고용 템플릿 → 챗봇·페이지에 노출하지 않는다 (플래그를 지우면 자동 노출)
    if (it?.sample === true) return;
    if (!isNonEmptyString(it?.q) || !isNonEmptyString(it?.a)) {
      if (it?.q || it?.a) warn(`items[${i}] — q(질문)와 a(답변)가 모두 필요합니다. 항목을 건너뜁니다.`);
      return;
    }
    let next: FaqItem['next'] = null;
    if (it.next !== undefined && it.next !== null) {
      if (isNonEmptyString(it.next?.label) && VALID_TREES.includes(it.next?.tree)) {
        next = { label: it.next.label.trim(), tree: it.next.tree };
      } else {
        warn(
          `items[${i}] — next는 label(문구)과 tree(${VALID_TREES.join('/')})가 필요합니다. ` +
            'next만 무시하고 답변은 유지합니다 (홈 메뉴 폴백).',
        );
      }
    }
    out.push({ q: it.q.trim(), a: it.a.trim(), pinned: it.pinned === true, next });
  });
  return out;
}
