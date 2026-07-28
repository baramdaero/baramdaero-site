import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// 루트 도메인 baramdaero.com — sitemap·robots·JSON-LD·OG 절대 URL 기준.
// DNS 연결 전에도 이 값 유지 (Pages 커스텀 도메인은 public/CNAME).
const site = process.env.SITE_URL ?? 'https://baramdaero.com';

export default defineConfig({
  site,
  trailingSlash: 'ignore',
  integrations: [sitemap()],
});
