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

export const collections = { cases, blog };
