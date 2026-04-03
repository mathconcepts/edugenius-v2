// @ts-nocheck
/**
 * Blog Index SSR Template
 *
 * Renders blog listing page as full HTML for SEO.
 * Light theme, card grid, pagination, topic filters.
 */

const BASE_URL = process.env.BASE_URL || 'https://gate-math-api.onrender.com';

interface BlogPostSummary {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  content_type: string;
  topic: string;
  exam_tags: string[];
  views: number;
  published_at: string;
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
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

function typeColor(type: string): { bg: string; text: string } {
  const colors: Record<string, { bg: string; text: string }> = {
    solved_problem: { bg: '#f0fdf4', text: '#10b981' },
    topic_explainer: { bg: '#eff6ff', text: '#3b82f6' },
    exam_strategy: { bg: '#fef3c7', text: '#d97706' },
    comparison: { bg: '#fae8ff', text: '#a855f7' },
  };
  return colors[type] || { bg: '#f1f5f9', text: '#64748b' };
}

export function renderBlogIndex(posts: BlogPostSummary[], page: number, totalPages: number, topic?: string): string {
  const canonical = topic
    ? `${BASE_URL}/blog?topic=${encodeURIComponent(topic)}&page=${page}`
    : `${BASE_URL}/blog${page > 1 ? `?page=${page}` : ''}`;

  const title = topic
    ? `${topic} — GATE Math Blog`
    : 'GATE Math Blog — Solved Problems, Study Guides, Exam Strategy';
  const description = topic
    ? `GATE Engineering Mathematics articles on ${topic}. Solved problems, study guides, and exam strategy.`
    : 'GATE Engineering Mathematics blog. Verified solved problems, topic guides, exam strategies, and comparison articles for GATE aspirants.';

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: title,
    description,
    url: canonical,
    publisher: { '@type': 'Organization', name: 'GATE Math', url: BASE_URL },
  };

  const postsHtml = posts.map(post => {
    const tc = typeColor(post.content_type);
    return `<article style="background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:20px;transition:box-shadow 0.2s">
      <div style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap">
        <span style="background:${tc.bg};color:${tc.text};padding:3px 10px;border-radius:999px;font-size:0.75rem;font-weight:600">${contentTypeLabel(post.content_type)}</span>
        ${post.topic ? `<span style="background:#eff6ff;color:#3b82f6;padding:3px 10px;border-radius:999px;font-size:0.75rem;font-weight:600">${escapeHtml(post.topic)}</span>` : ''}
      </div>
      <h2 style="margin:0 0 8px"><a href="/blog/${escapeHtml(post.slug)}" style="color:#0f172a;text-decoration:none;font-size:1.15rem;font-weight:700;line-height:1.3">${escapeHtml(post.title)}</a></h2>
      ${post.excerpt ? `<p style="color:#64748b;font-size:0.9rem;line-height:1.5;margin:0">${escapeHtml(post.excerpt)}</p>` : ''}
      <div style="margin-top:12px;display:flex;gap:12px;color:#94a3b8;font-size:0.8rem">
        ${post.published_at ? `<time datetime="${post.published_at}">${new Date(post.published_at).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' })}</time>` : ''}
        <span>${post.views} views</span>
      </div>
    </article>`;
  }).join('\n');

  const paginationHtml = totalPages > 1 ? `<nav style="display:flex;justify-content:center;gap:8px;margin-top:32px">
    ${page > 1 ? `<a href="/blog?page=${page - 1}${topic ? `&topic=${encodeURIComponent(topic)}` : ''}" style="padding:8px 16px;border-radius:8px;background:#fff;border:1px solid #e2e8f0;color:#0f172a;text-decoration:none;font-size:0.9rem">Previous</a>` : ''}
    <span style="padding:8px 16px;color:#64748b;font-size:0.9rem">Page ${page} of ${totalPages}</span>
    ${page < totalPages ? `<a href="/blog?page=${page + 1}${topic ? `&topic=${encodeURIComponent(topic)}` : ''}" style="padding:8px 16px;border-radius:8px;background:#10b981;color:#fff;text-decoration:none;font-size:0.9rem;font-weight:600">Next</a>` : ''}
  </nav>` : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}">
  <link rel="canonical" href="${canonical}">
  <meta property="og:type" content="website">
  <meta property="og:title" content="${escapeHtml(title)}">
  <meta property="og:description" content="${escapeHtml(description)}">
  <meta property="og:url" content="${canonical}">
  <meta name="twitter:card" content="summary">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
  <link rel="alternate" type="application/rss+xml" title="GATE Math Blog" href="${BASE_URL}/rss.xml">
  <script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'DM Sans', sans-serif; background: #f8fafc; color: #0f172a; }
    .container { max-width: 768px; margin: 0 auto; padding: 24px 16px; }
    .header { padding: 16px 0; border-bottom: 1px solid #e2e8f0; margin-bottom: 32px; display: flex; justify-content: space-between; align-items: center; }
    .header a { color: #10b981; text-decoration: none; font-weight: 600; font-size: 1.1rem; }
    .grid { display: grid; gap: 16px; }
    @media (min-width: 640px) { .grid { grid-template-columns: 1fr 1fr; } }
    .footer { margin-top: 48px; padding-top: 24px; border-top: 1px solid #e2e8f0; color: #94a3b8; font-size: 0.85rem; text-align: center; }
    .footer a { color: #10b981; text-decoration: none; }
  </style>
</head>
<body>
  <div class="container">
    <header class="header">
      <a href="/blog">GATE Math Blog</a>
      <a href="/" style="font-size:0.9rem;color:#64748b">Start Learning &rarr;</a>
    </header>
    <h1 style="font-size:1.75rem;font-weight:800;margin-bottom:8px">${topic ? escapeHtml(topic) : 'GATE Math Blog'}</h1>
    <p style="color:#64748b;margin-bottom:24px">${topic ? `Articles about ${escapeHtml(topic)} for GATE Engineering Mathematics` : 'Verified solved problems, study guides, and exam strategy for GATE aspirants'}</p>
    <div class="grid">
      ${postsHtml}
    </div>
    ${posts.length === 0 ? '<p style="text-align:center;color:#94a3b8;padding:48px 0">No blog posts yet. Check back soon!</p>' : ''}
    ${paginationHtml}
    <footer class="footer">
      <p><a href="/blog">Blog</a> &middot; <a href="/">Start Learning</a> &middot; <a href="/rss.xml">RSS Feed</a></p>
      <p style="margin-top:8px">&copy; ${new Date().getFullYear()} GATE Math</p>
    </footer>
  </div>
</body>
</html>`;
}
