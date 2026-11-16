// 숫자만 담은 작은 파일 — 쇼핑몰(아임웹) 홈이 '최근 1년 N대 · 사진 사례 N건' 줄을 이 값으로 채운다(손으로 옮겨 적지 않으려고).
// photoCases = /cases/ '사진 사례 N건'과 같은 셈(sample 제외), recentYearUnits = 홈 실적 '최근 1년 시공 대수'(trust.json).
// 이름을 바꾸면 쇼핑몰 홈 위젯의 data-bdx-stat 값도 같이 바꾼다. 검사: npm run build 뒤 npm run test:stats
import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { loadTrust } from '../lib/trust.ts';

export const GET: APIRoute = async () => {
  const body: Record<string, number> = {
    photoCases: (await getCollection('cases')).filter((e) => !e.data.sample).length,
  };
  const units = loadTrust().stats.find((s) => s.label.replace(/\s+/g, ' ') === '최근 1년 시공 대수');
  if (units) body.recentYearUnits = units.value;
  return new Response(JSON.stringify(body), { headers: { 'Content-Type': 'application/json; charset=utf-8' } });
};
