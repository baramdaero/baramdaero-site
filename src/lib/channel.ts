// 채널톡 연동 계층 — Chatbot.astro가 소비한다.
// 공식 로더(@channel.io/channel-web-sdk-loader) 사용. API 근거: developers.channel.io/docs/web-channelio
//   - boot(option, cb(error, user)) / hideChannelButtonOnBoot: 기본 런처 숨김 (자체 런처가 유일한 진입점)
//   - openChat(chatId?, message?): chatId 미지정 + message → 새 챗 입력창에 메시지 프리필 (클릭 이벤트 내 호출)
// 키 없음·로드 실패 → false 반환, 챗봇은 기존 폴백(카드 복사 + 전화 CTA)으로 동작.
// 동일 플러그인 키가 쇼핑몰(아임웹, 별도 관리)에도 설치될 예정 — 이 레포는 본진 연동만 담당, 쇼핑몰 측 설치는 코드 범위 외.
import { SITE_CONFIG } from '../config.js';

type ChannelStatus = 'disabled' | 'loading' | 'ready' | 'failed';
type ChannelSdk = typeof import('@channel.io/channel-web-sdk-loader');

let status: ChannelStatus = 'disabled';
let bootPromise: Promise<boolean> | null = null;
let sdk: ChannelSdk | null = null;

const BOOT_TIMEOUT_MS = 8000;

function pluginKey(): string {
  if (SITE_CONFIG.CHANNELTALK_PLUGIN_KEY) return SITE_CONFIG.CHANNELTALK_PLUGIN_KEY;
  // 개발 전용 테스트 훅 — 프로드 빌드에서는 이 분기가 제거된다 (키 더미 검증용)
  if (import.meta.env.DEV) return sessionStorage.getItem('BD_CT_KEY') ?? '';
  return '';
}

/** 플러그인 키 존재 여부 — UI가 CTA 구성을 결정할 때 사용 */
export function channelEnabled(): boolean {
  return !!pluginKey();
}

export function channelStatus(): ChannelStatus {
  return status;
}

/**
 * lazy boot — 패널 첫 오픈 시 호출. SDK 코드(dynamic import)와 스크립트 로드를 모두 지연시켜
 * 홈 초기 로드 성능에 영향을 주지 않는다. 멱등: 재호출 시 같은 promise 반환.
 */
export function ensureChannel(): Promise<boolean> {
  const key = pluginKey();
  if (!key) {
    status = 'disabled';
    return Promise.resolve(false);
  }
  if (bootPromise) return bootPromise;
  status = 'loading';
  bootPromise = import('@channel.io/channel-web-sdk-loader')
    .then(
      (mod) =>
        new Promise<boolean>((resolve) => {
          sdk = mod;
          const timer = setTimeout(() => {
            status = 'failed';
            resolve(false);
          }, BOOT_TIMEOUT_MS);
          mod.loadScript(); // 멱등 — window.ChannelIO 존재 시 no-op
          mod.boot({ pluginKey: key, hideChannelButtonOnBoot: true, language: 'ko' }, (error) => {
            clearTimeout(timer);
            status = error ? 'failed' : 'ready';
            resolve(!error);
          });
        }),
    )
    .catch(() => {
      status = 'failed';
      return false;
    });
  return bootPromise;
}

/**
 * 상담 연결 — message가 있으면 새 챗에 프리필(접수카드), 없으면 메신저만 표시.
 * ready가 아니면 false (호출측이 폴백 처리). 반드시 클릭 핸들러 안에서 호출할 것 (iOS Safari).
 */
export function openConsult(message?: string): boolean {
  if (status !== 'ready' || !sdk) return false;
  if (message) sdk.openChat(undefined, message);
  else sdk.showMessenger();
  return true;
}
