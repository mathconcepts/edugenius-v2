// @ts-nocheck
/**
 * Blog Post SSR Template
 *
 * Renders a blog post as full HTML for Google indexing.
 * Light theme for public pages. KaTeX pre-rendered (no client JS needed).
 * Includes JSON-LD BlogPosting schema, OG tags, canonical URL.
 */

const BASE_URL = process.env.BASE_URL || 'https://gate-math-api.onrender.com';

interface BlogSection {
  type: 'heading' | 'paragraph' | 'bullets' | 'numbered' | 'callout' | 'code' | 'image' | 'cta' | 'table' | 'quote' | 'divider';
  level?: 1 | 2 | 3;
  content: string;
  items?: string[];
  calloutType?: 'info' | 'warning' | 'tip' | 'success';
  ctaText?: string;
  ctaUrl?: string;
  tableHeaders?: string[];
  tableRows?: string[][];
}

interface BlogPost {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  content_type: string;
  sections: BlogSection[];
  seo_meta: { title?: string; description?: string; keywords?: string[] };
  topic: string;
  exam_tags: string[];
  views: number;
  published_at: string;
  updated_at: string;
  created_at: string;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function sanitizeUrl(url: string): string {
  // Only allow relative paths and http(s) URLs — block javascript: and data: URIs
  if (/^(https?:\/\/|\/[^\/])/.test(url)) return url;
  return '/onboard';
}

function renderSection(section: BlogSection): string {
  switch (section.type) {
    case 'heading': {
      const tag = `h${section.level || 2}`;
      const sizes: Record<number, string> = { 1: '2rem', 2: '1.5rem', 3: '1.25rem' };
      return `<${tag} style="color:#0f172a;margin:1.5em 0 0.5em;font-family:'Satoshi',sans-serif;font-weight:700;font-size:${sizes[section.level || 2]}">${escapeHtml(section.content)}</${tag}>`;
    }
    case 'paragraph':
      return `<p style="color:#334155;line-height:1.75;margin:0 0 1em;font-size:1.05rem">${escapeHtml(section.content)}</p>`;
    case 'bullets':
      return `<ul style="color:#334155;line-height:1.75;margin:0 0 1em;padding-left:1.5em">${(section.items || []).map(i => `<li style="margin:0.25em 0">${escapeHtml(i)}</li>`).join('')}</ul>`;
    case 'numbered':
      return `<ol style="color:#334155;line-height:1.75;margin:0 0 1em;padding-left:1.5em">${(section.items || []).map(i => `<li style="margin:0.25em 0">${escapeHtml(i)}</li>`).join('')}</ol>`;
    case 'callout': {
      const colors: Record<string, { bg: string; border: string; text: string }> = {
        tip: { bg: '#f0fdf4', border: '#10b981', text: '#065f46' },
        info: { bg: '#eff6ff', border: '#38bdf8', text: '#1e40af' },
        warning: { bg: '#fffbeb', border: '#f59e0b', text: '#92400e' },
        success: { bg: '#f0fdf4', border: '#10b981', text: '#065f46' },
      };
      const c = colors[section.calloutType || 'info'];
      return `<div style="background:${c.bg};border-left:4px solid ${c.border};padding:1em 1.25em;border-radius:8px;margin:1em 0;color:${c.text};font-size:0.95rem">${escapeHtml(section.content)}</div>`;
    }
    case 'code':
      return `<pre style="background:#f1f5f9;padding:1em;border-radius:8px;overflow-x:auto;margin:1em 0;font-family:'JetBrains Mono',monospace;font-size:0.9rem;color:#334155"><code>${escapeHtml(section.content)}</code></pre>`;
    case 'quote':
      return `<blockquote style="border-left:4px solid #10b981;padding:0.5em 1.25em;margin:1em 0;color:#475569;font-style:italic">${escapeHtml(section.content)}</blockquote>`;
    case 'table':
      if (!section.tableHeaders || !section.tableRows) return '';
      return `<div style="overflow-x:auto;margin:1em 0"><table style="width:100%;border-collapse:collapse;font-size:0.95rem">
        <thead><tr>${section.tableHeaders.map(h => `<th style="background:#f1f5f9;padding:0.75em;text-align:left;border-bottom:2px solid #e2e8f0;color:#0f172a;font-weight:600">${escapeHtml(h)}</th>`).join('')}</tr></thead>
        <tbody>${section.tableRows.map(row => `<tr>${row.map(cell => `<td style="padding:0.75em;border-bottom:1px solid #e2e8f0;color:#334155">${escapeHtml(cell)}</td>`).join('')}</tr>`).join('')}</tbody>
      </table></div>`;
    case 'cta':
      return `<div style="text-align:center;margin:2em 0"><a href="${sanitizeUrl(section.ctaUrl || '/onboard')}" style="display:inline-block;background:#10b981;color:#fff;padding:14px 32px;border-radius:12px;text-decoration:none;font-weight:600;font-size:1.05rem">${escapeHtml(section.ctaText || 'Start Practicing')}</a></div>`;
    case 'divider':
      return `<hr style="border:none;border-top:1px solid #e2e8f0;margin:2em 0">`;
    case 'image':
      return `<figure style="margin:1.5em 0;text-align:center"><img src="${sanitizeUrl(section.content)}" alt="${escapeHtml(section.content)}" style="max-width:100%;border-radius:8px"><figcaption style="color:#94a3b8;font-size:0.85rem;margin-top:0.5em">${escapeHtml(section.content)}</figcaption></figure>`;
    default:
      return `<p style="color:#334155">${escapeHtml(section.content || '')}</p>`;
  }
}

function estimateReadTime(sections: BlogSection[]): number {
  const words = sections.reduce((acc, s) => {
    const text = s.content + (s.items?.join(' ') || '');
    return acc + text.split(/\s+/).length;
  }, 0);
  return Math.max(1, Math.ceil(words / 200));
}

function contentTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    solved_problem: 'Solved Problem',
    topic_explainer: 'Topic Guide',
    exam_strategy: 'Exam Strategy',
    comparison: 'Comparison',
  };
  return labels[type] || type;
}

export function renderBlogPost(post: BlogPost): string {
  const title = post.seo_meta?.title || post.title;
  const description = post.seo_meta?.description || post.excerpt || '';
  const keywords = post.seo_meta?.keywords || [];
  const readTime = estimateReadTime(post.sections);
  const canonical = `${BASE_URL}/blog/${post.slug}`;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: title,
    description,
    url: canonical,
    datePublished: post.published_at,
    dateModified: post.updated_at || post.published_at,
    author: {
      '@type': 'Organization',
      name: 'GATE Math',
      url: BASE_URL,
    },
    publisher: {
      '@type': 'Organization',
      name: 'GATE Math',
      url: BASE_URL,
    },
    mainEntityOfPage: canonical,
    keywords: keywords.join(', '),
    wordCount: post.sections.reduce((acc, s) => acc + (s.content?.split(/\s+/).length || 0), 0),
    timeRequired: `PT${readTime}M`,
  };

  const sectionsHtml = post.sections.map(renderSection).join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}">
  ${keywords.length > 0 ? `<meta name="keywords" content="${escapeHtml(keywords.join(', '))}">` : ''}
  <link rel="canonical" href="${canonical}">
  <meta property="og:type" content="article">
  <meta property="og:title" content="${escapeHtml(title)}">
  <meta property="og:description" content="${escapeHtml(description)}">
  <meta property="og:url" content="${canonical}">
  <meta property="og:site_name" content="GATE Math">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escapeHtml(title)}">
  <meta name="twitter:description" content="${escapeHtml(description)}">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css">
  <link rel="alternate" type="application/rss+xml" title="GATE Math Blog" href="${BASE_URL}/rss.xml">
  <script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'DM Sans', sans-serif; background: #f8fafc; color: #0f172a; }
    .container { max-width: 768px; margin: 0 auto; padding: 24px 16px; }
    .header { padding: 16px 0; border-bottom: 1px solid #e2e8f0; margin-bottom: 32px; }
    .header a { color: #10b981; text-decoration: none; font-weight: 600; font-size: 1.1rem; }
    .meta { display: flex; gap: 12px; align-items: center; flex-wrap: wrap; margin-bottom: 24px; color: #64748b; font-size: 0.9rem; }
    .badge { display: inline-block; background: #f0fdf4; color: #10b981; padding: 4px 12px; border-radius: 999px; font-size: 0.8rem; font-weight: 600; }
    .topic-badge { background: #eff6ff; color: #3b82f6; }
    .disclaimer { background: #fffbeb; border: 1px solid #fde68a; padding: 12px 16px; border-radius: 8px; margin: 32px 0; font-size: 0.85rem; color: #92400e; }
    .footer { margin-top: 48px; padding-top: 24px; border-top: 1px solid #e2e8f0; color: #94a3b8; font-size: 0.85rem; text-align: center; }
    .footer a { color: #10b981; text-decoration: none; }
    .related { margin-top: 32px; }
    .related h3 { color: #0f172a; font-size: 1.25rem; margin-bottom: 16px; }
    @media (max-width: 640px) { .container { padding: 16px 12px; } }
  </style>
</head>
<body>
  <div class="container">
    <header class="header">
      <a href="/blog">GATE Math Blog</a>
    </header>
    <article>
      <h1 style="font-family:'Satoshi',sans-serif;font-size:2.25rem;font-weight:900;color:#0f172a;line-height:1.2;margin-bottom:16px">${escapeHtml(post.title)}</h1>
      <div class="meta">
        <span class="badge">${contentTypeLabel(post.content_type)}</span>
        ${post.topic ? `<span class="badge topic-badge">${escapeHtml(post.topic)}</span>` : ''}
        <span>${readTime} min read</span>
        ${post.published_at ? `<time datetime="${post.published_at}">${new Date(post.published_at).toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' })}</time>` : ''}
      </div>
      ${sectionsHtml}
      <div class="disclaimer">
        Explanations in this article are AI-generated. Problems and solutions are verified through our 3-tier verification system (RAG cache, dual LLM solve, Wolfram Alpha).
      </div>
      <div style="text-align:center;margin:32px 0">
        <a href="/${post.topic ? `topic/${encodeURIComponent(post.topic)}` : 'onboard'}" style="display:inline-block;background:#10b981;color:#fff;padding:14px 32px;border-radius:12px;text-decoration:none;font-weight:600;font-size:1.05rem">Practice ${post.topic || 'GATE Math'}</a>
      </div>
    </article>
    <footer class="footer">
      <p><a href="/blog">GATE Math Blog</a> &middot; <a href="/">Start Learning</a> &middot; <a href="/rss.xml">RSS Feed</a></p>
      <p style="margin-top:8px">&copy; ${new Date().getFullYear()} GATE Math. Built for GATE aspirants.</p>
    </footer>
  </div>
</body>
</html>`;
}
