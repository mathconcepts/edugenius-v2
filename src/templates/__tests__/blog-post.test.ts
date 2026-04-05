import { describe, it, expect } from 'vitest';
import { renderBlogPost } from '../blog-post';

const mockPost = {
  id: 'test-id',
  slug: 'gate-linear-algebra-solved-1',
  title: 'GATE 2024 Linear Algebra Q17 — Full Solution',
  excerpt: 'Step-by-step solution for eigenvalue decomposition problem.',
  content_type: 'solved_problem',
  sections: [
    { type: 'heading' as const, level: 2 as const, content: 'Problem Statement' },
    { type: 'paragraph' as const, content: 'Find the eigenvalues of the matrix <span class="katex">A = \\begin{bmatrix} 1 & 2 \\\\ 3 & 4 \\end{bmatrix}</span>.' },
    { type: 'bullets' as const, content: '', items: ['Step 1: Compute determinant', 'Step 2: Solve characteristic equation'] },
    { type: 'callout' as const, content: 'AI-generated explanation. Verified by 3-tier system.', calloutType: 'info' as const },
    { type: 'cta' as const, content: '', ctaText: 'Practice Linear Algebra', ctaUrl: '/topic/linear-algebra' },
  ],
  seo_meta: {
    title: 'GATE 2024 Linear Algebra Q17 Solution | GATE Math',
    description: 'Detailed solution for GATE 2024 Linear Algebra eigenvalue problem.',
    keywords: ['GATE', 'linear algebra', 'eigenvalues', '2024'],
  },
  topic: 'Linear Algebra',
  exam_tags: ['GATE'],
  views: 42,
  published_at: '2026-03-15T10:00:00Z',
  updated_at: '2026-03-16T10:00:00Z',
  created_at: '2026-03-14T10:00:00Z',
};

describe('renderBlogPost', () => {
  it('produces valid HTML with DOCTYPE and lang attribute', () => {
    const html = renderBlogPost(mockPost);
    expect(html).toMatch(/^<!DOCTYPE html>/);
    expect(html).toContain('<html lang="en">');
    expect(html).toContain('</html>');
  });

  it('includes meta tags for SEO', () => {
    const html = renderBlogPost(mockPost);
    expect(html).toContain('<meta name="description"');
    expect(html).toContain('<meta name="keywords"');
    expect(html).toContain('<link rel="canonical"');
    expect(html).toContain('<meta property="og:type" content="article">');
    expect(html).toContain('<meta property="og:title"');
    expect(html).toContain('<meta name="twitter:card" content="summary_large_image">');
  });

  it('includes JSON-LD BlogPosting schema', () => {
    const html = renderBlogPost(mockPost);
    expect(html).toContain('<script type="application/ld+json">');

    const jsonLdMatch = html.match(/<script type="application\/ld\+json">(.*?)<\/script>/s);
    expect(jsonLdMatch).toBeTruthy();

    const jsonLd = JSON.parse(jsonLdMatch![1]);
    expect(jsonLd['@type']).toBe('BlogPosting');
    expect(jsonLd['@context']).toBe('https://schema.org');
    expect(jsonLd.headline).toBe(mockPost.seo_meta.title);
    expect(jsonLd.datePublished).toBe(mockPost.published_at);
    expect(jsonLd.dateModified).toBe(mockPost.updated_at);
    expect(jsonLd.author['@type']).toBe('Organization');
    expect(jsonLd.timeRequired).toMatch(/^PT\d+M$/);
  });

  it('renders KaTeX HTML without client JS', () => {
    const html = renderBlogPost(mockPost);
    // KaTeX CSS included for pre-rendered math display
    expect(html).toContain('katex');
    expect(html).toContain('katex.min.css');
    // No katex JS script — math is pre-rendered
    expect(html).not.toContain('katex.min.js');
  });

  it('includes AI disclaimer', () => {
    const html = renderBlogPost(mockPost);
    expect(html).toContain('AI-generated');
    expect(html).toContain('3-tier verification');
    expect(html).toContain('class="disclaimer"');
  });

  it('renders all section types correctly', () => {
    const html = renderBlogPost(mockPost);
    // heading
    expect(html).toContain('<h2');
    expect(html).toContain('Problem Statement');
    // paragraph
    expect(html).toContain('Find the eigenvalues');
    // bullets
    expect(html).toContain('<ul');
    expect(html).toContain('Compute determinant');
    // callout
    expect(html).toContain('border-left-width:4px');
    // CTA
    expect(html).toContain('Practice Linear Algebra');
    expect(html).toContain('/topic/linear-algebra');
  });

  it('renders topic and content type badges', () => {
    const html = renderBlogPost(mockPost);
    expect(html).toContain('Solved Problem');
    expect(html).toContain('Linear Algebra');
    expect(html).toContain('class="badge"');
  });

  it('includes RSS feed link', () => {
    const html = renderBlogPost(mockPost);
    expect(html).toContain('type="application/rss+xml"');
    expect(html).toContain('/rss.xml');
  });

  it('uses dark theme colors', () => {
    const html = renderBlogPost(mockPost);
    expect(html).toContain('background:#0a0f1a');
    expect(html).toContain('color:#e2e8f0');
    expect(html).toContain("font-family:'Space Grotesk'");
  });

  it('escapes HTML in title to prevent XSS', () => {
    const xssPost = { ...mockPost, title: '<script>alert("xss")</script>' };
    const html = renderBlogPost(xssPost);
    expect(html).not.toContain('<script>alert("xss")</script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('includes read time estimate', () => {
    const html = renderBlogPost(mockPost);
    expect(html).toMatch(/\d+ min/);
  });
});
