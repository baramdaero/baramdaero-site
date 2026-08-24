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
});
