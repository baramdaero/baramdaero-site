// 채널톡 연동 계층 회귀 검사 — src/lib/channel.ts (ensureChannel · openConsult)
// 실행: node scripts/check-channel.mjs   (Node 22.13+: module.stripTypeScriptTypes)
//
// channel.ts 는 상대 import('../config.js')와 SDK 동적 import 때문에 다른 check-* 처럼 소스 한 덩이를 바로 못 불러온다.
// 두 지정자를 data: 스텁으로 바꿔 불러오고, 타임아웃은 setTimeout 을 가로채 손으로 발사한다.
// 키는 더미 값만 쓴다(실제 config.js·SDK·네트워크는 건드리지 않는다).
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import assert from 'node:assert/strict';

const CONFIG_SPEC = "'../config.js'";
const SDK_SPEC = "'@channel.io/channel-web-sdk-loader'";
const src = stripTypeScriptTypes(readFileSync(new URL('../src/lib/channel.ts', import.meta.url), 'utf8'));
// 치환이 실제로 일어나야 한다 — channel.ts 가 바뀌어 지정자가 달라지면 진짜 config·SDK 를 조용히 불러오게 된다
assert.ok(src.includes(CONFIG_SPEC) && src.includes(SDK_SPEC), 'channel.ts 의 import 지정자가 바뀌었다 — 이 검사의 치환부터 고친다');

const dataUrl = (code) => 'data:text/javascript,' + encodeURIComponent(code);
const CONFIG_STUB = dataUrl("export const SITE_CONFIG = { CHANNELTALK_PLUGIN_KEY: 'dummy-key' };");
const SDK_STUB = dataUrl(`export const loadScript = () => globalThis.__ch.loadScript();
export const boot = (opt, cb) => globalThis.__ch.boot(opt, cb);
export const openChat = (...a) => globalThis.__ch.openChat(...a);
export const showMessenger = (...a) => globalThis.__ch.showMessenger(...a);`);

let n = 0;
/** 시나리오마다 새 모듈(= 새 모듈 상태)과 새 스텁을 만든다 */
async function scenario() {
  const calls = { openChat: [], showMessenger: 0, loadScript: 0, boot: [] };
  const timers = [];
  const real = { setTimeout: globalThis.setTimeout, clearTimeout: globalThis.clearTimeout };
  globalThis.setTimeout = (fn, ms) => { const t = { fn, ms, cleared: false }; timers.push(t); return t; };
  globalThis.clearTimeout = (t) => { if (t) t.cleared = true; };
  globalThis.__ch = {
    loadScript: () => { calls.loadScript++; },
    boot: (opt, cb) => { calls.boot.push({ opt, cb }); },
    openChat: (...a) => { calls.openChat.push(a); },
    showMessenger: () => { calls.showMessenger++; },
  };
  const code = src.replace(CONFIG_SPEC, JSON.stringify(CONFIG_STUB)).replace(SDK_SPEC, JSON.stringify(SDK_STUB)) + `\n// scenario ${++n}`;
  const ch = await import(dataUrl(code));
  const restore = () => { globalThis.setTimeout = real.setTimeout; globalThis.clearTimeout = real.clearTimeout; delete globalThis.__ch; };
  // 모듈의 dynamic import 가 끝나 boot 이 불린 뒤에 돌려준다
  const booted = async () => { for (let i = 0; i < 50 && !calls.boot.length; i++) await new Promise((r) => real.setTimeout(r, 0)); assert.equal(calls.boot.length, 1, 'boot 이 불리지 않았다'); };
  return { ch, calls, timers, restore, booted };
}

// 1) 정상: 제때 boot 되면 열린다 (메시지가 있으면 접수카드 프리필, 없으면 메신저)
{
  const s = await scenario();
  try {
    assert.equal(s.ch.channelEnabled(), true);
    const p = s.ch.ensureChannel();
    await s.booted();
    assert.equal(s.calls.boot[0].opt.pluginKey, 'dummy-key');
    assert.equal(s.calls.boot[0].opt.hideChannelButtonOnBoot, true, '기본 런처는 숨긴다 — 자체 런처가 유일한 진입점');
    assert.equal(s.ch.openConsult('x'), false, 'boot 전에는 열 수 없다');
    s.calls.boot[0].cb(undefined);
    assert.equal(await p, true);
    assert.equal(s.timers[0].cleared, true, '성공하면 타임아웃을 거둔다');
    assert.equal(s.ch.channelStatus(), 'ready');
    assert.equal(await s.ch.ensureChannel(), true, '멱등');
    assert.equal(s.calls.boot.length, 1, '두 번째 ensure 는 다시 boot 하지 않는다');
    assert.equal(s.ch.openConsult('접수 내용'), true);
    assert.deepEqual(s.calls.openChat, [[undefined, '접수 내용']]);
    assert.equal(s.ch.openConsult(), true);
    assert.equal(s.calls.showMessenger, 1);
  } finally { s.restore(); }
}

// 2) 늦은 성공: 타임아웃(8초)이 먼저 지나고 boot 이 그 뒤에 성공해도, 그 페이지의 다음 ensure 는 true 여야 한다
//    (챗봇 CTA 는 `(await ensureChannel()) && openConsult(...)` 형태라 캐시된 false 면 상담이 열리지 않는다)
{
  const s = await scenario();
  try {
    const first = s.ch.ensureChannel();
    await s.booted();
    assert.equal(s.timers[0].ms, 8000, '부팅 타임아웃은 8초');
    s.timers[0].fn();                          // 8초 경과
    assert.equal(await first, false, '타임아웃 시점의 결과는 false');
    assert.equal(s.ch.channelStatus(), 'failed');
    s.calls.boot[0].cb(undefined);             // SDK 가 늦게 성공
    assert.equal(s.ch.channelStatus(), 'ready');
    assert.equal(await s.ch.ensureChannel(), true, '늦게 ready 가 되면 다음 ensure 는 true');
    assert.equal((await s.ch.ensureChannel()) && s.ch.openConsult('x'), true, '클릭 시점에 상담이 열린다');
    assert.deepEqual(s.calls.openChat, [[undefined, 'x']]);
    assert.equal(s.calls.boot.length, 1, '다시 boot 하지 않는다');
  } finally { s.restore(); }
}

// 3) 진짜 실패: boot 오류는 그대로 실패 — 폴백(카드 복사·전화)으로 간다
{
  const s = await scenario();
  try {
    const p = s.ch.ensureChannel();
    await s.booted();
    s.calls.boot[0].cb(new Error('boom'));
    assert.equal(await p, false);
    assert.equal(s.ch.channelStatus(), 'failed');
    assert.equal(await s.ch.ensureChannel(), false);
    assert.equal(s.ch.openConsult('x'), false);
    assert.deepEqual(s.calls.openChat, []);
  } finally { s.restore(); }
}

console.log('channel: 통과 (정상 · 늦은 성공 · 오류 3개 시나리오)');
