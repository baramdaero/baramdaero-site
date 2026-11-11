// 접수 기록 — Chatbot.astro 가 소비한다. 검사: npm run test:intake
//   intakeEnabled()       받는 곳이 있는가(INTAKE_ENDPOINT 가 비어 있지 않음). 접수번호·저장 안내는 이게 참일 때만 카드에 붙인다.
//   newReceiptId()        접수번호 'YYMMDD-XXXX' (YYMMDD 는 한국시간, 뒤 4자는 혼동 글자 뺀 32자 중 난수)
//   recordIntake(card,id) 접수 카드를 INTAKE_ENDPOINT 로 한 번 보낸다. 주소가 비면 아무 일도 하지 않는다.
// 접수 흐름(채널톡 프리필·복사·전화)을 절대 막지 않는다 — 응답은 읽지 않고, 어떤 오류도 밖으로 내지 않는다.
// 모듈을 불러올 때는 window·document 를 건드리지 않는다(정적 빌드에서 import 되어도 안전해야 한다).
import { SITE_CONFIG } from '../config.js';

// 0·O·1·I 를 뺀 32자 — 32 로 나누어떨어져 바이트 하나(& 31)가 편향 없이 한 글자가 된다
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const MAX_CARD = 4000;

/** 접수 기록을 받는 주소가 있는가. 빈 값이면 카드에 접수번호도 저장 안내도 붙이지 않는다 */
export function intakeEnabled(): boolean {
  return Boolean(SITE_CONFIG.INTAKE_ENDPOINT);
}

/** 접수번호. now 는 시험용 — 한국시간은 서머타임이 없어 +9시간 고정이다 */
export function newReceiptId(now: Date = new Date()): string {
  const day = new Date(now.getTime() + 9 * 3600_000).toISOString().slice(2, 10).replace(/-/g, '');
  const rnd = crypto.getRandomValues(new Uint8Array(4));
  return `${day}-${Array.from(rnd, (b) => ALPHABET[b & 31]).join('')}`;
}

/** 기다리지 않고 보낸다. no-cors + 본문이 문자열이면 text/plain 단순 요청이라 사전 요청(preflight)이 없다 */
export function recordIntake(card: string, id: string): void {
  try {
    if (!intakeEnabled() || card.length > MAX_CARD) return;
    fetch(SITE_CONFIG.INTAKE_ENDPOINT, {
      method: 'POST',
      mode: 'no-cors',
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
      keepalive: true,
      body: JSON.stringify({ v: 1, id, card, path: location.pathname }),
    }).catch(() => {});
  } catch {
    /* 기록이 안 남아도 접수는 계속된다 */
  }
}
