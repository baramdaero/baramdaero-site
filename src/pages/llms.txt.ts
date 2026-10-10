// /llms.txt — AI 검색(ChatGPT·Gemini·Perplexity)이 사이트를 한 번에 읽는 목차 (llmstxt.org 형식).
// 빌드 때 실제 공개된 페이지·사례·글·FAQ 만 모은다 — 따로 손볼 파일 없음.
import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { SITE_CONFIG } from '../config.js';
import faq from '../content/site/faq.json';
import { RECORDS, COMPLEXES, REGIONS, stats, fmtYm, ymOf, regionSlug, brandLine } from '../lib/caselog';

export const GET: APIRoute = async ({ site }) => {
  const u = (p: string) => new URL(p, site).href;
  const cases = (await getCollection('cases'))
    .filter((c) => !c.data.sample)
    .sort((a, b) => +b.data.date - +a.data.date || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)); // 같은 날짜끼리는 id 순 — 빌드하는 기계마다 순서가 달라지지 않게
  const posts = (await getCollection('blog')).filter((p) => !p.data.sample).sort((a, b) => +b.data.date - +a.data.date || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
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
  // 시공 기록(전체) — 숫자는 기록에서 센다. 단지는 기록이 많은 순으로 40곳, 나머지는 지역 페이지에서 이어진다
  if (RECORDS.length) {
    const t = stats(RECORDS);
    lines.push('', '## 시공 기록', `${fmtYm(ymOf(t.first))}부터 ${fmtYm(ymOf(t.last))}까지 마친 현장 ${t.n}건(${brandLine(t.brands)}), 단지명이 확인된 단지 ${COMPLEXES.length}곳. 날짜·지역·단지·브랜드·대수를 날짜순으로 공개합니다.`);
    lines.push(`- [전체 기록·단지 찾기](${u('/cases/')})`);
    for (const g of REGIONS.slice(0, 40)) lines.push(`- [${g.region} 시스템에어컨 시공 기록 ${g.records.length}건](${u(`/cases/region/${regionSlug(g.region)}/`)})`);
    lines.push('', '### 단지별');
    for (const c of COMPLEXES.slice(0, 40)) lines.push(`- [${c.name} (${c.gu} ${c.dong}) 시스템에어컨 설치 사례 ${c.records.length}건](${u(`/cases/apt/${c.slug}/`)})`);
  }
  if (posts.length) {
    lines.push('', '## 글');
    for (const p of posts) lines.push(`- [${p.data.question || p.data.title}](${u(`/blog/${p.id}/`)}): ${p.data.description}`);
  }
  lines.push('', '## 자주 묻는 질문');
  for (const f of faqs) lines.push(`- [${f.q}](${u(`/faq/#${f.id}`)})`);

  return new Response(lines.join('\n') + '\n', { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};
