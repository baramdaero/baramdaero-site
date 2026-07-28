import { readdirSync, readFileSync } from 'node:fs';
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// 루트 도메인 baramdaero.com — sitemap·robots·JSON-LD·OG 절대 URL 기준.
// DNS 연결 전에도 이 값 유지 (Pages 커스텀 도메인은 public/CNAME).
const site = process.env.SITE_URL ?? 'https://baramdaero.com';

// 발행된(draft: false) 가이드가 하나라도 있는지 — 없으면 빈 /guides/ 목록을 sitemap에서 제외
function hasPublishedGuides() {
  try {
    return readdirSync('src/content/guides')
      .filter((f) => f.endsWith('.md'))
      .some((f) => /draft:\s*false/.test(readFileSync(`src/content/guides/${f}`, 'utf8')));
  } catch {
    return false;
  }
}
const guidesPublished = hasPublishedGuides();

export default defineConfig({
  site,
  trailingSlash: 'ignore',
  integrations: [
    sitemap({
      filter: (page) => (guidesPublished ? true : !page.includes('/guides/')),
    }),
  ],
});
