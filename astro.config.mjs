import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// 루트 도메인 baramdaero.com — sitemap·robots·JSON-LD·OG 절대 URL 기준.
// DNS 연결 전에도 이 값 유지 (Pages 커스텀 도메인은 public/CNAME).
const site = process.env.SITE_URL ?? 'https://baramdaero.com';

// guides 컬렉션 폐지(2026-08-24) — FAQ(넓게)·블로그(깊게) 2층 구조로 정리하며
// /guides/ 라우트가 사라져 sitemap 필터도 함께 제거됐다.
export default defineConfig({
  site,
  trailingSlash: 'ignore',
  integrations: [sitemap()],
  // 2026-09-30 구조 정리 — 합친 페이지의 옛 주소는 새 자리로 보낸다(외부 링크·검색 결과 보존)
  redirects: {
    '/story': '/',
    '/situation/newhome': '/install/',
    // 2026-10-12 가격 페이지 폐지 — 비용 안내는 자주 묻는 질문의 '비용' 묶음이 맡는다
    '/price': '/faq/#cat-비용',
  },
});
