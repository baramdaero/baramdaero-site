// 바람대로 사이트 단일 설정 소스.
// ⚠️ 연락처·채널 값(KAKAO_CHANNEL_URL, PHONE)은 실값 확정 전까지 빈 문자열 유지 — 임의 기입 금지 (CLAUDE.md 절대 규칙 2).
// 빈 값 폴백: 카카오 미개설 → 카톡 버튼 숨김, 전화 CTA로 폴백. 전화도 미정 → 복사 안내만 노출.
export const SITE_CONFIG = {
  SITE_NAME: '바람대로',
  SLOGAN: '당신의 바람대로.',
  HOME_TITLE: '바람대로 — 시스템에어컨 설치·세척·관리',
  DESCRIPTION: '시스템에어컨 설치·분해세척·유지관리. 수도권 전 지역, 사전에 말씀드리지 않은 추가금은 없습니다.',

  KAKAO_CHANNEL_URL: '', // 카카오채널 개설 후 기입 (예: https://pf.kakao.com/_xxxxx)
  PHONE: '1544-2618',    // 2026-10-02 대표 지정 대표번호
  // 사업자 정보 — 2026-10-15 발급 사업자등록증 기준. 푸터 하단에 그대로 표시하고, 전역 JSON-LD(Base.astro)의 legalName·taxID 도 여기서 읽는다.
  // 통신판매업 신고번호는 발급되면 여기에 추가한다. 법인등록번호는 표시 항목이 아니라 두지 않는다.
  BUSINESS: {
    NAME: '주식회사 어반브리즈',
    REPRESENTATIVE: '김동환',
    REG_NO: '224-86-04042',
    ADDRESS: '경기도 화성시 동탄구 메타폴리스로 42, 9층 902호-라1호(반송동, 디앤씨빌딩)',
  },
  // 쇼핑몰 주소 — 상점이 실제로 열린 뒤 기입한다. 채우면 메뉴·푸터의 '가격'이 쇼핑몰로 가고,
  // 헤더 오른쪽 위 '견적 문의' 자리에 '로그인'이 온다(견적 문의는 채팅 버튼이 맡는다).
  // 빈 값이면 '가격'은 자주 묻는 질문의 '비용' 묶음으로 가고 오른쪽 위는 '견적 문의'다.
  // 2026-07-30: shop.baramdaero.com이 DNS 미등록(NXDOMAIN) 상태로 확인돼 빈 값으로 되돌림.
  // 링크가 살아 있으면 방문자가 브라우저 오류 페이지로 빠진다.
  SHOP_URL: '',
  // 쇼핑몰 로그인 화면 경로 — SHOP_URL 뒤에 붙는다(shopHref). 빈 값이면 '로그인' 링크만 렌더되지 않는다.
  // 가입 링크는 따로 두지 않는다 — 가입은 쇼핑몰 화면에서 한다(2026-10-12).
  SHOP_LOGIN_PATH: '/login',

  // 채널톡 플러그인 키 — 개설 후 기입. 동일 키가 쇼핑몰(아임웹, 별도 관리)에도 설치될 예정.
  // 이 레포는 본진 연동만 담당하며 쇼핑몰 측 설치는 코드 범위 외.
  CHANNELTALK_PLUGIN_KEY: '7d2356f8-db95-48e7-b7a4-3108f4f4446a',
  // 챗봇 헤더 상태줄 문구 — ⚠️ 응답 시간 약속은 넣지 않는다.
  // 구 문구 '보통 영업시간 내 1시간 안에 연락드립니다'는 기간 약속이라 비웠다
  // (자사 이행 주장은 ①추가금 사전고지 ②작업 사진 전달 ③단일 창구 셋만).
  // 빈 값이면 헤더에 그 줄이 아예 안 나온다.
  RESPONSE_NOTE: '',
  // 챗봇 홈 화면 환영 문구 — 줄바꿈(\n)이 화면의 줄 나눔 그대로다
  WELCOME_MESSAGE: '안녕하세요, 바람대로입니다.\n무엇이 필요하신가요?',

  // /care/ SEO 문구 — 지역+비용 키워드 구조 (검색·AI 인용 표적)
  CARE_SEO_TITLE: '에어컨 분해세척 — 기종별 분해 범위와 표준 절차',   // 금액은 넣지 않는다 — 비용 안내는 /faq/ '비용' 묶음
  CARE_SEO_DESCRIPTION:
    '수도권 에어컨 분해세척 표준 절차와 기종별 분해 범위. 기종과 대수만 알려주시면 견적을 드립니다.',

  BRANDS_INSTALL: ['삼성', 'LG'],

  HERO_VIDEO: '/media/hero-loop.mp4',   // 사전 렌더 왕복 루프 (교체 시 이 경로만)
  HERO_POSTER: '/media/hero-still.jpg', // 영상 로드 전·폴백 정적 이미지

  // 공유 카드 기본 이미지 1200×630 (#004E64 + 로고 리버스 중앙). 페이지별 ogImage prop으로 덮어쓴다
  OG_IMAGE: '/og-default.png',

  // 검색엔진에 알리기 — 출시 전에는 false. false 면 배포 뒤 바뀐 페이지를 검색엔진에 보내지 않는다(scripts/indexnow.mjs).
  // 출시 날 true 로 바꾸고 docs/launch-search.md 순서대로 한다(2026-10-12 대표: 색인 요청은 사업 시작 때 한꺼번에).
  SEARCH_OPEN: false,

  // 사이트 인증 메타 — 발급 후 기입하면 <head>에 자동 렌더
  NAVER_SITE_VERIFICATION: '',
  GOOGLE_SITE_VERIFICATION: '',
};

/** 쇼핑몰 안쪽 주소. SHOP_URL 이나 경로가 비면 빈 문자열 — 부르는 쪽은 빈 값이면 링크를 그리지 않는다(죽은 링크 금지) */
export const shopHref = (path) =>
  SITE_CONFIG.SHOP_URL && path ? SITE_CONFIG.SHOP_URL.replace(/\/+$/, '') + path : '';
