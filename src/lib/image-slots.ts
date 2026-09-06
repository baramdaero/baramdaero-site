import { readFileSync, realpathSync, statSync } from 'node:fs';
import { join, resolve, sep } from 'node:path';

const IMAGE_SLOTS_PATH = join(process.cwd(), 'src/content/site/image-slots.json');
const PUBLIC_MEDIA_DIR = realpathSync(resolve(process.cwd(), 'public/media'));

export interface ImageSlotEntry {
  src: string;
  alt: string;
}

interface ImageSlotRegistry {
  slots: Record<string, ImageSlotEntry>;
}

const EMPTY_ENTRY: ImageSlotEntry = { src: '', alt: '' };
const PRICING_IMAGE_SLOTS = new Set(
  Array.from({ length: 6 }, (_, index) => `care-process-${String(index + 1).padStart(2, '0')}`),
);
let cachedRegistry: ImageSlotRegistry | null = null;

// 빌드 전용 플래그다. PUBLIC_ 접두사 없이 브라우저 번들에 노출하지 않는다.
export const SHOW_EMPTY_SLOTS = process.env.SHOW_EMPTY_SLOTS === 'true';

const cleanString = (value: unknown): string => typeof value === 'string' ? value.trim() : '';

/** 파일만 떨어뜨리면 붙는다 — public/media/<슬롯id>.jpg 를 빌드 때 찾아 쓴다.
 *  JSON을 함께 고치지 않아도 되게 하려는 것이다(2026-08-27). 확장자는 아래 순서로 본다. */
const AUTO_EXTS = ['jpg', 'jpeg', 'png', 'webp'] as const;
const missingAlt = new Set<string>();

function findDroppedFile(id: string): string {
  for (const ext of AUTO_EXTS) {
    const rel = `/media/${id}.${ext}`;
    try {
      const abs = resolve(process.cwd(), 'public', `.${rel}`);
      if (abs.startsWith(`${PUBLIC_MEDIA_DIR}${sep}`) && statSync(abs).isFile()) return rel;
    } catch {
      /* 없으면 다음 확장자 */
    }
  }
  return '';
}

function validateImagePath(id: string, src: string): void {
  if (!src) return;
  if (!src.startsWith('/media/')) {
    throw new Error(`[이미지 슬롯 오류] "${id}"의 src는 /media/ 경로여야 합니다: ${src}`);
  }

  const assetPath = resolve(process.cwd(), 'public', `.${src}`);
  if (!assetPath.startsWith(`${PUBLIC_MEDIA_DIR}${sep}`)) {
    throw new Error(`[이미지 슬롯 오류] "${id}"의 src가 public/media 밖을 가리킵니다: ${src}`);
  }

  try {
    const realAssetPath = realpathSync(assetPath);
    if (!realAssetPath.startsWith(`${PUBLIC_MEDIA_DIR}${sep}`) || !statSync(realAssetPath).isFile()) {
      throw new Error('public/media 내부의 파일이 아닙니다.');
    }
  } catch (error) {
    throw new Error(`[이미지 슬롯 오류] "${id}"의 src 파일을 사용할 수 없습니다: ${src} (${(error as Error).message})`);
  }
}

function loadImageSlotRegistry(): ImageSlotRegistry {
  if (cachedRegistry) return cachedRegistry;

  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(IMAGE_SLOTS_PATH, 'utf8'));
  } catch (error) {
    throw new Error(`[image-slots.json 오류] 파일을 읽거나 해석하지 못했습니다: ${(error as Error).message}`);
  }

  const source = typeof raw === 'object' && raw !== null && 'slots' in raw
    ? (raw as { slots?: unknown }).slots
    : null;
  if (typeof source !== 'object' || source === null || Array.isArray(source)) {
    throw new Error('[image-slots.json 오류] "slots"는 식별자를 키로 쓰는 객체여야 합니다.');
  }

  const slots: Record<string, ImageSlotEntry> = {};
  Object.entries(source).forEach(([id, value]) => {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      throw new Error(`[image-slots.json 오류] slots.${id}는 src·alt 객체여야 합니다.`);
    }
    const entry = value as { src?: unknown; alt?: unknown };
    if (typeof entry.src !== 'string' || typeof entry.alt !== 'string') {
      throw new Error(`[image-slots.json 오류] slots.${id}의 src와 alt는 문자열이어야 합니다.`);
    }

    const src = cleanString(entry.src);
    const alt = cleanString(entry.alt);
    if (!src && alt) {
      throw new Error(`[image-slots.json 오류] slots.${id}에 alt만 있습니다. src와 함께 채우세요.`);
    }
    validateImagePath(id, src);
    slots[id] = { src, alt };
  });

  cachedRegistry = { slots };
  return cachedRegistry;
}

export function getImageSlot(id: string): ImageSlotEntry {
  const registered = loadImageSlotRegistry().slots[id];
  if (registered) return registered;
  if (PRICING_IMAGE_SLOTS.has(id)) return EMPTY_ENTRY;
  throw new Error(`[image-slots.json 오류] 정적 슬롯 "${id}"가 레지스트리에 없습니다.`);
}

export function resolveImageSlot(id: string, src = '', alt = ''): ImageSlotEntry {
  const registered = getImageSlot(id);
  const chosen = cleanString(src) || registered.src || findDroppedFile(id);
  const chosenAlt = cleanString(alt) || registered.alt;
  // 떨어뜨린 파일에 alt가 없으면 빌드를 깨지 않고 경고만 남긴다 —
  // 파일을 올린 순간 사이트가 멈추면 '올리기만 하면 된다'가 성립하지 않는다.
  if (chosen && !chosenAlt && !missingAlt.has(id)) {
    missingAlt.add(id);
    console.warn(`[이미지 슬롯 경고] "${id}" 사진에 alt가 없습니다. image-slots.json 의 slots.${id}.alt 를 채우세요.`);
  }
  const resolved = { src: chosen, alt: chosenAlt };
  validateImagePath(id, resolved.src);
  return resolved;
}

/** 슬롯은 사진이 없어도 자리를 잡는다(2026-08-27). 빈 상태를 설계된 면으로 만들었기 때문이다 —
 *  숨기면 어디에 사진이 빠졌는지 아무도 못 보고, 사진 유무로 레이아웃이 흔들린다. */
export function isImageSlotVisible(_id: string, _src = ''): boolean {
  return true;
}
