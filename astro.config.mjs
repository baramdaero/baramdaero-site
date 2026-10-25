import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import { SITE_CONFIG } from './src/config.js';

// 루트 도메인 baramdaero.com — sitemap·robots·JSON-LD·OG 절대 URL 기준.
// DNS 연결 전에도 이 값 유지 (Pages 커스텀 도메인은 public/CNAME).
const site = process.env.SITE_URL ?? 'https://baramdaero.com';

// 사례 본문(md)의 사진은 `<img>` 속성 없이 나와 페이지당 5~8장이 한꺼번에 내려왔다(첫 화면 사진은 템플릿의 cover 가 맡는다).
// 본문 사진은 보일 때 받고 디코딩은 뒤로 미룬다. 지정된 속성은 건드리지 않는다
function rehypeLazyImages() {
  const walk = (node) => {
    if (node.type === 'element' && node.tagName === 'img') {
      node.properties.loading ??= 'lazy';
      node.properties.decoding ??= 'async';
    }
    node.children?.forEach(walk);
  };
  return walk;
}

// guides 컬렉션 폐지(2026-08-24) — FAQ(넓게)·블로그(깊게) 2층 구조로 정리하며
// /guides/ 라우트가 사라져 sitemap 필터도 함께 제거됐다.
export default defineConfig({
  site,
  trailingSlash: 'ignore',
  integrations: [sitemap()],
  markdown: { rehypePlugins: [rehypeLazyImages] },
  // 2026-09-30 구조 정리 — 합친 페이지의 옛 주소는 새 자리로 보낸다(외부 링크·검색 결과 보존)
  redirects: {
    '/story': '/',
    '/situation/newhome': '/install/',
    // 2026-10-12 가격 페이지 폐지 — 비용 안내는 자주 묻는 질문의 '비용' 묶음이 맡는다.
    // 쇼핑몰 주소가 있으면 옛 주소도 쇼핑몰로 보낸다(메뉴·푸터 '가격'과 같은 규칙, 2026-10-19)
    '/price': SITE_CONFIG.SHOP_URL || '/faq/#cat-비용',
  },
});
