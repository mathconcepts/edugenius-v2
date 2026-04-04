// @ts-nocheck
/**
 * Blog Post SSR Template
 *
 * Dark theme matching the app aesthetic. CSS-only scroll-reveal animations.
 * Sticky floating CTA pill. KaTeX pre-rendered (no client JS needed).
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
  if (/^(https?:\/\/|\/[^\/])/.test(url)) return url;
  return '/onboard';
}

function renderSection(section: BlogSection, index: number): string {
  const reveal = `class="reveal" style="animation-delay:${Math.min(index * 60, 600)}ms"`;

  switch (section.type) {
    case 'heading': {
      const tag = `h${section.level || 2}`;
      const sizes: Record<number, string> = { 1: '1.75rem', 2: '1.35rem', 3: '1.15rem' };
      return `<${tag} ${reveal} style="animation-delay:${Math.min(index * 60, 600)}ms;color:#f1f5f9;margin:2em 0 0.75em;font-family:'Satoshi',sans-serif;font-weight:700;font-size:${sizes[section.level || 2]};letter-spacing:-0.01em">${escapeHtml(section.content)}</${tag}>`;
    }
    case 'paragraph':
      return `<p ${reveal} style="animation-delay:${Math.min(index * 60, 600)}ms;color:#cbd5e1;line-height:1.8;margin:0 0 1.25em;font-size:1.05rem">${escapeHtml(section.content)}</p>`;
    case 'bullets':
      return `<ul ${reveal} style="animation-delay:${Math.min(index * 60, 600)}ms;color:#cbd5e1;line-height:1.8;margin:0 0 1.25em;padding-left:1.25em;list-style:none">${(section.items || []).map(i => `<li style="margin:0.5em 0;position:relative;padding-left:1em"><span style="position:absolute;left:0;color:#10b981">&#8250;</span>${escapeHtml(i)}</li>`).join('')}</ul>`;
    case 'numbered':
      return `<ol ${reveal} style="animation-delay:${Math.min(index * 60, 600)}ms;color:#cbd5e1;line-height:1.8;margin:0 0 1.25em;padding-left:1.5em">${(section.items || []).map(i => `<li style="margin:0.5em 0">${escapeHtml(i)}</li>`).join('')}</ol>`;
    case 'callout': {
      const colors: Record<string, { bg: string; border: string; text: string }> = {
        tip: { bg: 'rgba(16,185,129,0.08)', border: '#10b981', text: '#6ee7b7' },
        info: { bg: 'rgba(56,189,248,0.08)', border: '#38bdf8', text: '#7dd3fc' },
        warning: { bg: 'rgba(245,158,11,0.08)', border: '#f59e0b', text: '#fbbf24' },
        success: { bg: 'rgba(16,185,129,0.08)', border: '#10b981', text: '#6ee7b7' },
      };
      const c = colors[section.calloutType || 'info'];
      return `<div ${reveal} style="animation-delay:${Math.min(index * 60, 600)}ms;background:${c.bg};border-left:3px solid ${c.border};padding:1em 1.25em;border-radius:0 8px 8px 0;margin:1.5em 0;color:${c.text};font-size:0.92rem;line-height:1.6">${escapeHtml(section.content)}</div>`;
    }
    case 'code':
      return `<pre ${reveal} style="animation-delay:${Math.min(index * 60, 600)}ms;background:#111827;border:1px solid #1f2937;padding:1em;border-radius:8px;overflow-x:auto;margin:1.5em 0;font-family:'JetBrains Mono',monospace;font-size:0.88rem;color:#e2e8f0"><code>${escapeHtml(section.content)}</code></pre>`;
    case 'quote':
      return `<blockquote ${reveal} style="animation-delay:${Math.min(index * 60, 600)}ms;border-left:3px solid #10b981;padding:0.75em 1.25em;margin:1.5em 0;color:#94a3b8;font-style:italic;font-size:1.05rem">${escapeHtml(section.content)}</blockquote>`;
    case 'table':
      if (!section.tableHeaders || !section.tableRows) return '';
      return `<div ${reveal} style="animation-delay:${Math.min(index * 60, 600)}ms;overflow-x:auto;margin:1.5em 0"><table style="width:100%;border-collapse:collapse;font-size:0.92rem">
        <thead><tr>${section.tableHeaders.map(h => `<th style="background:#111827;padding:0.75em;text-align:left;border-bottom:2px solid #1f2937;color:#e2e8f0;font-weight:600">${escapeHtml(h)}</th>`).join('')}</tr></thead>
        <tbody>${section.tableRows.map(row => `<tr>${row.map(cell => `<td style="padding:0.75em;border-bottom:1px solid #1f2937;color:#cbd5e1">${escapeHtml(cell)}</td>`).join('')}</tr>`).join('')}</tbody>
      </table></div>`;
    case 'cta':
      return `<div ${reveal} style="animation-delay:${Math.min(index * 60, 600)}ms;text-align:center;margin:2em 0"><a href="${sanitizeUrl(section.ctaUrl || '/onboard')}" style="display:inline-block;background:#10b981;color:#fff;padding:12px 28px;border-radius:999px;text-decoration:none;font-weight:600;font-size:0.95rem;transition:transform 0.2s ease,box-shadow 0.2s ease" onmouseover="this.style.transform='translateY(-1px)';this.style.boxShadow='0 4px 20px rgba(16,185,129,0.3)'" onmouseout="this.style.transform='';this.style.boxShadow=''">${escapeHtml(section.ctaText || 'Start Practicing')}</a></div>`;
    case 'divider':
      return `<hr style="border:none;border-top:1px solid #1f2937;margin:2.5em 0">`;
    case 'image':
      return `<figure ${reveal} style="animation-delay:${Math.min(index * 60, 600)}ms;margin:1.5em 0;text-align:center"><img src="${sanitizeUrl(section.content)}" alt="${escapeHtml(section.content)}" style="max-width:100%;border-radius:8px"><figcaption style="color:#64748b;font-size:0.8rem;margin-top:0.5em">${escapeHtml(section.content)}</figcaption></figure>`;
    default:
      return `<p style="color:#cbd5e1">${escapeHtml(section.content || '')}</p>`;
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

function typeAccent(type: string): string {
  const accents: Record<string, string> = {
    solved_problem: '#10b981',
    topic_explainer: '#38bdf8',
    exam_strategy: '#f59e0b',
    comparison: '#a78bfa',
  };
  return accents[type] || '#10b981';
}

const APP_FEATURE_CALLOUTS: Record<string, { title: string; description: string; ctaText: string; ctaUrl: string }> = {
  solved_problem: {
    title: 'Practice Similar Problems',
    description: 'Solve more verified problems on this topic with instant feedback.',
    ctaText: 'Start Practicing',
    ctaUrl: '/practice',
  },
  topic_explainer: {
    title: 'Get Your Study Plan',
    description: 'Study Commander builds a plan based on your strengths and weaknesses.',
    ctaText: 'Create My Plan',
    ctaUrl: '/onboard',
  },
  exam_strategy: {
    title: 'Take the Diagnostic',
    description: 'Find your weak areas in under 15 minutes.',
    ctaText: 'Start Diagnostic',
    ctaUrl: '/diagnostic',
  },
  comparison: {
    title: 'Ask the AI Tutor',
    description: 'Get step-by-step explanations tailored to your level.',
    ctaText: 'Chat with Tutor',
    ctaUrl: '/chat',
  },
};

function renderAppFeatureCallout(contentType: string, topic: string | null): string {
  const callout = APP_FEATURE_CALLOUTS[contentType] || APP_FEATURE_CALLOUTS.solved_problem;
  const url = contentType === 'solved_problem' && topic
    ? `/practice/${encodeURIComponent(topic)}`
    : callout.ctaUrl;
  const accent = typeAccent(contentType);

  return `<div class="reveal app-cta" style="background:#111827;border:1px solid #1f2937;border-radius:12px;padding:20px 24px;margin:2.5em 0;display:flex;align-items:center;gap:16px;flex-wrap:wrap">
  <div style="flex:1;min-width:200px">
    <p style="color:#e2e8f0;font-weight:600;font-size:0.95rem;margin:0 0 4px">${escapeHtml(callout.title)}</p>
    <p style="color:#64748b;font-size:0.85rem;margin:0;line-height:1.5">${escapeHtml(callout.description)}</p>
  </div>
  <a href="${sanitizeUrl(url)}" style="display:inline-block;background:${accent};color:#fff;padding:10px 20px;border-radius:999px;text-decoration:none;font-weight:600;font-size:0.85rem;white-space:nowrap;transition:transform 0.2s ease" onmouseover="this.style.transform='translateY(-1px)'" onmouseout="this.style.transform=''">${escapeHtml(callout.ctaText)}</a>
</div>`;
}

export function renderBlogPost(post: BlogPost): string {
  const title = post.seo_meta?.title || post.title;
  const description = post.seo_meta?.description || post.excerpt || '';
  const keywords = post.seo_meta?.keywords || [];
  const readTime = estimateReadTime(post.sections);
  const canonical = `${BASE_URL}/blog/${post.slug}`;
  const accent = typeAccent(post.content_type);

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: title,
    description,
    url: canonical,
    datePublished: post.published_at,
    dateModified: post.updated_at || post.published_at,
    author: { '@type': 'Organization', name: 'GATE Math', url: BASE_URL },
    publisher: { '@type': 'Organization', name: 'GATE Math', url: BASE_URL },
    mainEntityOfPage: canonical,
    keywords: keywords.join(', '),
    wordCount: post.sections.reduce((acc, s) => acc + (s.content?.split(/\s+/).length || 0), 0),
    timeRequired: `PT${readTime}M`,
  };

  const sectionsHtml = post.sections.map((s, i) => renderSection(s, i)).join('\n');
  const stickyUrl = post.topic ? `/topic/${encodeURIComponent(post.topic)}` : '/onboard';

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
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:'DM Sans',sans-serif;background:#0a0f1a;color:#e2e8f0}
    .container{max-width:680px;margin:0 auto;padding:32px 20px 120px}
    .nav{padding:16px 0;margin-bottom:40px;display:flex;align-items:center;justify-content:space-between}
    .nav a{color:#64748b;text-decoration:none;font-size:0.85rem;font-weight:500;transition:color 0.2s}
    .nav a:hover{color:#10b981}
    .nav .logo{color:#e2e8f0;font-weight:700;font-size:0.95rem}
    .meta{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-bottom:32px}
    .badge{display:inline-block;padding:4px 12px;border-radius:999px;font-size:0.75rem;font-weight:600;letter-spacing:0.02em}
    .meta-text{color:#64748b;font-size:0.82rem}
    .disclaimer{background:rgba(245,158,11,0.06);border:1px solid rgba(245,158,11,0.15);padding:12px 16px;border-radius:8px;margin:2.5em 0;font-size:0.82rem;color:#fbbf24;line-height:1.5}
    .footer{margin-top:48px;padding-top:24px;border-top:1px solid #1f2937;color:#475569;font-size:0.8rem;text-align:center}
    .footer a{color:#64748b;text-decoration:none;transition:color 0.2s}
    .footer a:hover{color:#10b981}
    .sticky-cta{position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:#111827;border:1px solid #1f2937;border-radius:999px;padding:10px 12px 10px 20px;display:flex;align-items:center;gap:12px;box-shadow:0 8px 32px rgba(0,0,0,0.4);z-index:50;animation:slideUp 0.5s ease 1s both}
    .sticky-cta span{color:#cbd5e1;font-size:0.85rem;font-weight:500;white-space:nowrap}
    .sticky-cta a{background:${accent};color:#fff;padding:8px 18px;border-radius:999px;text-decoration:none;font-weight:600;font-size:0.82rem;white-space:nowrap;transition:transform 0.15s ease}
    .sticky-cta a:hover{transform:scale(1.03)}
    @keyframes fadeSlideUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
    @keyframes slideUp{from{opacity:0;transform:translate(-50%,20px)}to{opacity:1;transform:translate(-50%,0)}}
    .reveal{animation:fadeSlideUp 0.5s ease both}
    @supports(animation-timeline:view()){
      .reveal{animation:fadeSlideUp 0.4s ease both;animation-timeline:view();animation-range:entry 0% entry 30%}
    }
    @media(max-width:640px){
      .container{padding:20px 16px 120px}
      h1{font-size:1.75rem!important}
      .sticky-cta{left:16px;right:16px;transform:none;animation-name:slideUpMobile}
      @keyframes slideUpMobile{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
    }
  </style>
</head>
<body>
  <div class="container">
    <nav class="nav">
      <a href="/blog" class="logo">GATE Math</a>
      <a href="/blog">&larr; All posts</a>
    </nav>
    <article>
      <h1 class="reveal" style="font-family:'Satoshi',sans-serif;font-size:2rem;font-weight:800;color:#f8fafc;line-height:1.25;margin-bottom:16px;letter-spacing:-0.02em">${escapeHtml(post.title)}</h1>
      <div class="meta">
        <span class="badge" style="background:${accent}15;color:${accent}">${contentTypeLabel(post.content_type)}</span>
        ${post.topic ? `<span class="badge" style="background:rgba(56,189,248,0.1);color:#38bdf8">${escapeHtml(post.topic)}</span>` : ''}
        <span class="meta-text">${readTime} min</span>
        ${post.published_at ? `<time class="meta-text" datetime="${post.published_at}">${new Date(post.published_at).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' })}</time>` : ''}
      </div>
      ${sectionsHtml}
      ${renderAppFeatureCallout(post.content_type, post.topic)}
      <div class="disclaimer">
        AI-generated explanations. Problems and solutions verified through 3-tier verification (RAG cache, dual LLM, Wolfram Alpha).
      </div>
    </article>
    <footer class="footer">
      <p><a href="/blog">Blog</a> &middot; <a href="/">Start Learning</a> &middot; <a href="/rss.xml">RSS</a></p>
      <p style="margin-top:8px">&copy; ${new Date().getFullYear()} GATE Math</p>
    </footer>
  </div>
  <div class="sticky-cta">
    <span>Practice ${escapeHtml(post.topic || 'GATE Math')}</span>
    <a href="${sanitizeUrl(stickyUrl)}">Open App</a>
  </div>
</body>
</html>`;
}
