// 단지 검색용 색인 — /cases/ 가 검색·거르기·더 보기 때 한 번 받아 쓴다(첫 화면 HTML 에 1,500줄을 싣지 않으려고).
// [slug, 단지명, 동, 시·도 시·구, 건수, 검색 줄]
import type { APIRoute } from 'astro';
import { COMPLEXES } from '../../lib/caselog';
import { normFaq } from '../../scripts/faq-rank';

export const GET: APIRoute = () =>
  new Response(JSON.stringify(COMPLEXES.map((c) => [c.slug, c.name, c.dong, c.region, c.records.length, normFaq([c.name, c.dong, c.gu, c.region].join(' '))])),
    { headers: { 'Content-Type': 'application/json; charset=utf-8' } });
