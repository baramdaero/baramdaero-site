// /llms.txt — AI 검색(ChatGPT·Gemini·Perplexity)이 사이트를 한 번에 읽는 목차 (llmstxt.org 형식).
// 빌드 때 실제 공개된 페이지·사례·글·FAQ 만 모은다 — 따로 손볼 파일 없음.
import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { SITE_CONFIG } from '../config.js';
import faq from '../content/site/faq.json';

export const GET: APIRoute = async ({ site }) => {
  const u = (p: string) => new URL(p, site).href;
  const cases = (await getCollection('cases'))
    .filter((c) => !c.data.sample)
    .sort((a, b) => +b.data.date - +a.data.date);
  const posts = (await getCollection('blog')).filter((p) => !p.data.sample);
  const faqs = faq.items.filter((f) => f.status === 'live');

  const lines = [
    `# ${SITE_CONFIG.SITE_NAME}`,
    '',
    `> ${SITE_CONFIG.DESCRIPTION}`,
    '',
    '시스템에어컨(삼성·LG 1Way·2Way·4Way·360 원형) 설치, 분해세척, 상업 공간 유지관리를 합니다. 견적 문의는 사이트의 "견적 문의" 버튼으로 받습니다.',
    '',
    '## 서비스',
    `- [설치](${u('/install/')}): 입주 전·살고 있는 집·교체 조건별 설치 절차`,
    `- [세척](${u('/care/')}): 커버와 송풍팬까지 분해하는 세척 절차`,
    `- [상업용](${u('/commercial/')}): 매장·사무실·대형빌딩 에어컨 관리와 설치`,
    `- [가격](${u('/price/')}): 비용 구성, 비용이 달라지는 조건, 견적 받는 법`,
    `- [자주 묻는 질문](${u('/faq/')})`,
  ];
  if (cases.length) {
    lines.push('', '## 시공사례');
    for (const c of cases) {
      const d = c.data;
      const t = d.title || `${d.region} ${d.space} ${d.brand} ${d.type} ${d.units}대`;
      lines.push(`- [${t}](${u(`/cases/${c.id}/`)})${d.answer ? `: ${d.answer}` : ''}`);
    }
  }
  if (posts.length) {
    lines.push('', '## 글');
    for (const p of posts) lines.push(`- [${p.data.question || p.data.title}](${u(`/blog/${p.id}/`)}): ${p.data.description}`);
  }
  lines.push('', '## 자주 묻는 질문');
  for (const f of faqs) lines.push(`- [${f.q}](${u(`/faq/#${f.id}`)})`);

  return new Response(lines.join('\n') + '\n', { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};
