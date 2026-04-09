// Centralized blog content type definitions.
// Single source of truth — imported by jobs, templates, routes, and frontend stores.

export const BLOG_CONTENT_TYPES = [
  'solved_problem', 'topic_explainer', 'exam_strategy', 'comparison',
] as const;

export type BlogContentType = typeof BLOG_CONTENT_TYPES[number];

export const CONTENT_TYPE_LABELS: Record<BlogContentType, string> = {
  solved_problem: 'Solved',
  topic_explainer: 'Guide',
  exam_strategy: 'Strategy',
  comparison: 'Compare',
};

export const CONTENT_TYPE_ACCENTS: Record<BlogContentType, string> = {
  solved_problem: '#10b981',
  topic_explainer: '#38bdf8',
  exam_strategy: '#facc15',
  comparison: '#a78bfa',
};
