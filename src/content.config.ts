import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

// 시공사례 — md 1건 = 사례 레코드 1건. 글이 아니라 데이터로 쌓아
// 사례 목록·마퀴·블로그 related_cases·상황 페이지에서 재사용한다.
// 신규 필드는 전부 선택 — 기존 사례 md와 소비처(마퀴·목록·상세)는 그대로 동작한다.
// ⚠️ 개인정보 규칙은 src/content/cases/README.txt 참조 (단지명·동호수·상세주소·고객명 기재 금지).
const cases = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/cases' }),
  schema: z.object({
    region: z.string(), // 시·구까지만 (예: 서울 강서, 경기 부천) — 단지명 금지
    space: z.string(), // 아파트/상가/사무실 등
    brand: z.string(),
    type: z.enum(['설치', '세척', '복원']),
    units: z.number().int().positive(),
    date: z.coerce.date(),
    cover: z.string().optional(),
    sample: z.boolean().default(false), // 더미 표시 — 실제 사례로 교체 시 제거
    // ---- 레코드 확장 (전부 선택 — 값이 없으면 관련 블록이 조용히 빠진다) ----
    building: z.string().default(''), // 건물 유형 상세 (예: 구축 아파트 30평형대) — 단지명 금지
    size: z.string().default(''), // 평형·면적 (예: 24평)
    model: z.string().default(''), // 기종 (예: 4way 카세트)
    condition: z.string().default(''), // 작업 전 상태 요약
    work: z
      .object({
        duration: z.string().default(''), // 실측 소요 시간 (예: 4시간 30분)
        crew: z.number().int().positive().optional(), // 투입 인원
        scope: z.array(z.string()).default([]), // 작업 범위 목록
      })
      .default({ duration: '', scope: [] }),
    photos: z.array(z.object({ file: z.string(), caption: z.string().default('') })).default([]),
    note: z.string().default(''), // 현장 특이사항
    tags: z.array(z.string()).default([]),
    related_articles: z.array(z.string()).default([]), // 블로그 글 id
    related_situations: z.array(z.string()).default([]), // situation slug
  }),
});

// 블로그 — 구조화 지식 저장소. 프론트매터가 데이터(챗봇·GEO 재료)이고 본문이 화면이다.
// 신규 필드는 전부 선택 — 기존 글은 그대로 동작하고, 값이 없는 블록은 조용히 빠진다.
const blog = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/blog' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    date: z.coerce.date(),
    cover: z.string().optional(),
    sample: z.boolean().default(false),
    // ---- GEO 확장 ----
    question: z.string().default(''), // 검색어형 제목 (비면 title 사용)
    answer: z.string().default(''), // 결론 2~3문장 — 본문 최상단 별도 블록
    topic: z.enum(['세척', '설치', '비용', '상황', '문의']).optional(),
    qa: z.array(z.object({ q: z.string(), a: z.string() })).default([]), // 이 글이 커버하는 하위 질문
    facts: z
      .array(z.object({ key: z.string(), value: z.string(), source: z.string() }))
      .default([]), // 출처 있는 사실만
    claims: z.array(z.string()).default([]), // 자사 기준 — 확정 전엔 빈 배열
    related_checklist: z.string().default(''), // 체크리스트 경로 (예: /install/)
    related_situation: z.string().default(''), // situation slug
    related_cases: z.array(z.string()).default([]), // cases id
    sources: z
      .array(z.object({ label: z.string(), url: z.string().default(''), year: z.string().default('') }))
      .default([]),
    updated: z.coerce.date().optional(),
  }),
});

export const collections = { cases, blog };
