// trust.json 로더 — 홈 신뢰 섹션의 유일한 콘텐츠 소스 (빌드 타임 실행).
// 정책 (관리자가 GitHub 웹 UI에서 JSON만 수정해 운영하는 전제):
//   - JSON 문법 오류 → 한글 에러 메시지로 빌드 실패 (원인 파악 가능해야 함)
//   - 값 누락·타입 오류 → 해당 항목/섹션만 경고 후 스킵 (빌드는 계속)
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// 빌드 번들 위치와 무관하게 프로젝트 루트 기준으로 고정 (astro는 항상 루트에서 실행)
const TRUST_PATH = join(process.cwd(), 'src/content/site/trust.json');

export interface TrustStat { label: string; value: number; suffix: string }
export interface TrustCredential { title: string; image: string; note: string }
export interface TrustPromise { number: string; label: string }
export interface TrustPrinciple { no: number; title: string; body: string }
export interface TrustData {
  stats: TrustStat[];
  credentials: TrustCredential[];
  as_promises: TrustPromise[];
  principles: TrustPrinciple[];
  /** 유효한 유튜브 영상 ID (URL 파싱 실패·빈 값이면 null → 섹션 미렌더) */
  videoId: string | null;
}

const EMPTY: TrustData = { stats: [], credentials: [], as_promises: [], principles: [], videoId: null };

const warn = (msg: string) => console.warn(`[trust.json 경고] ${msg}`);

function isNonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.trim() !== '';
}

/** 배열 섹션 공통 방어 파싱 — 배열이 아니면 경고 후 빈 배열, 항목별 검증 실패는 항목만 제외 */
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

/** 유튜브 URL → 영상 ID. watch?v= / youtu.be/ / embed/ / shorts/ 형식 지원 */
export function parseYoutubeId(url: string): string | null {
  const m = url.match(
    /(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/,
  );
  return m ? m[1] : null;
}

export function loadTrust(): TrustData {
  let rawText: string;
  try {
    rawText = readFileSync(TRUST_PATH, 'utf8');
  } catch {
    warn('src/content/site/trust.json 파일을 찾을 수 없습니다 — 신뢰 섹션 전체를 건너뜁니다.');
    return EMPTY;
  }

  let raw: any;
  try {
    raw = JSON.parse(rawText);
  } catch (e) {
    // 문법 오류는 명확한 한글 메시지로 빌드 실패 — 관리자가 웹에서 원인을 찾을 수 있어야 한다
    throw new Error(
      [
        '',
        '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
        '[trust.json 오류] JSON 문법이 잘못되어 빌드를 중단합니다.',
        `원인: ${(e as Error).message}`,
        '확인할 것: 항목 끝의 쉼표(,) 누락/과잉, 짝이 안 맞는 따옴표(")나 괄호({ } [ ]).',
        '수정 위치: src/content/site/trust.json',
        '팁: 파일 내용을 jsonlint.com 에 붙여넣으면 틀린 줄을 짚어 줍니다.',
        '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
      ].join('\n'),
    );
  }

  const stats = pickArray<TrustStat>(raw.stats, 'stats', (it, i) => {
    if (!isNonEmptyString(it?.label) || typeof it?.value !== 'number' || !isFinite(it.value)) {
      if (it?.label || it?.value) warn(`stats[${i}] — label(문자)과 value(숫자)가 모두 필요합니다. 항목을 건너뜁니다.`);
      return null;
    }
    return { label: it.label.trim(), value: it.value, suffix: isNonEmptyString(it.suffix) ? it.suffix.trim() : '' };
  });

  const credentials = pickArray<TrustCredential>(raw.credentials, 'credentials', (it, i) => {
    if (!isNonEmptyString(it?.title)) {
      if (it?.image || it?.note) warn(`credentials[${i}] — title이 비어 있어 건너뜁니다.`);
      return null;
    }
    return {
      title: it.title.trim(),
      image: isNonEmptyString(it.image) ? it.image.trim() : '',
      note: isNonEmptyString(it.note) ? it.note.trim() : '',
    };
  });

  const as_promises = pickArray<TrustPromise>(raw.as_promises, 'as_promises', (it, i) => {
    if (!isNonEmptyString(it?.number) || !isNonEmptyString(it?.label)) {
      if (it?.number || it?.label) warn(`as_promises[${i}] — number와 label이 모두 필요합니다. 항목을 건너뜁니다.`);
      return null;
    }
    return { number: it.number.trim(), label: it.label.trim() };
  });

  const principles = pickArray<TrustPrinciple>(raw.principles, 'principles', (it, i) => {
    if (typeof it?.no !== 'number' || !isNonEmptyString(it?.title) || !isNonEmptyString(it?.body)) {
      if (it?.title || it?.body) warn(`principles[${i}] — no(숫자)·title·body가 모두 필요합니다. 항목을 건너뜁니다.`);
      return null;
    }
    return { no: it.no, title: it.title.trim(), body: it.body.trim() };
  });

  let videoId: string | null = null;
  if (isNonEmptyString(raw.video_embed)) {
    videoId = parseYoutubeId(raw.video_embed.trim());
    if (!videoId) warn(`video_embed — 유튜브 주소를 인식하지 못했습니다("${raw.video_embed}"). 영상 섹션을 건너뜁니다.`);
  }

  return { stats, credentials, as_promises, principles, videoId };
}
