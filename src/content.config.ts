import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

// 시공사례 — md 1건 = 사례 1건
const cases = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/cases' }),
  schema: z.object({
    region: z.string(), // 예: 서울 강서, 경기 부천
    space: z.string(), // 아파트/상가/사무실 등
    brand: z.string(),
    type: z.enum(['설치', '세척', '복원']),
    units: z.number().int().positive(),
    date: z.coerce.date(),
    cover: z.string().optional(),
    sample: z.boolean().default(false), // 더미 표시 — 실제 사례로 교체 시 제거
  }),
});

// 가이드 — 질문형 정보 콘텐츠 (검색 롱테일·AI 인용 표적). 구 스켈레톤 frontmatter 호환.
// draft: true는 프로덕션 빌드에서 제외 — Astro 콘텐츠 컬렉션에 내장 draft 동작이 없어
// 페이지 쪽 getCollection 필터로 처리한다 (src/pages/guides/*).
const guides = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/guides' }),
  schema: z.object({
    title: z.string(),
    question: z.string().default(''),
    draft: z.boolean().default(true),
    relatedCases: z.array(z.string()).default([]),
    updated: z.coerce.date().optional(),
  }),
});

const blog = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/blog' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    date: z.coerce.date(),
    cover: z.string().optional(),
    sample: z.boolean().default(false),
  }),
});

export const collections = { cases, guides, blog };
