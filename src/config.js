// 바람대로 사이트 단일 설정 소스.
// ⚠️ 연락처·채널 값(KAKAO_CHANNEL_URL, PHONE)은 실값 확정 전까지 빈 문자열 유지 — 임의 기입 금지 (CLAUDE.md 절대 규칙 2).
// 빈 값 폴백: 카카오 미개설 → 카톡 버튼 숨김, 전화 CTA로 폴백. 전화도 미정 → 복사 안내만 노출.
export const SITE_CONFIG = {
  SITE_NAME: '바람대로',
  SLOGAN: '당신의 바람대로.',
  DESCRIPTION: '에어컨 설치·세척·유지관리. 수도권 시공, 바람대로.',

  KAKAO_CHANNEL_URL: '', // 카카오채널 개설 후 기입 (예: https://pf.kakao.com/_xxxxx)
  PHONE: '',             // 대표번호 확정 후 기입 (예: 0507-0000-0000)
  SHOP_URL: 'https://shop.baramdaero.com',

  // 채널톡 플러그인 키 — 개설 후 기입. 동일 키가 쇼핑몰(아임웹, 별도 관리)에도 설치될 예정.
  // 이 레포는 본진 연동만 담당하며 쇼핑몰 측 설치는 코드 범위 외.
  CHANNELTALK_PLUGIN_KEY: '7d2356f8-db95-48e7-b7a4-3108f4f4446a',
  // 챗봇 헤더 상태줄 문구
  RESPONSE_NOTE: '보통 영업시간 내 1시간 안에 연락드립니다',
  // 챗봇 홈 화면 환영 문구
  WELCOME_MESSAGE: '안녕하세요, 바람대로입니다. 무엇을 도와드릴까요?',

  // /care/ SEO 문구 — 지역+비용 키워드 구조 (검색·AI 인용 표적)
  CARE_SEO_TITLE: '에어컨 청소 비용·분해세척 기준가',
  CARE_SEO_DESCRIPTION:
    '수도권 에어컨 분해세척 기준가와 표준 절차. 벽걸이·스탠드·시스템 기종별 비용을 확인하고 사진으로 확정 견적을 받으세요.',

  BRANDS_INSTALL: ['삼성', 'LG'],

  HERO_VIDEO: '/media/hero-loop.mp4',   // 사전 렌더 왕복 루프 (교체 시 이 경로만)
  HERO_POSTER: '/media/hero-still.jpg', // 영상 로드 전·폴백 정적 이미지

  // 사이트 인증 메타 — 발급 후 기입하면 <head>에 자동 렌더
  NAVER_SITE_VERIFICATION: '',
  GOOGLE_SITE_VERIFICATION: '',
};
