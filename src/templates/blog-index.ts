// @ts-nocheck
/**
 * Blog Index SSR Template
 *
 * Dark Neubrutalism — Gen Z/Gen Alpha aesthetic.
 * Hard borders, colored offset shadows, bold type, sharp corners.
 * CSS-only motion: stagger entrance + hover shadow-shift.
 * Zero JS. ~4KB CSS. prefers-reduced-motion respected.
 */

import { GATE_TOPICS } from '../constants/topics';
import { CONTENT_TYPE_LABELS, CONTENT_TYPE_ACCENTS } from '../constants/content-types';

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
  content_score?: number;
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function contentTypeLabel(type: string): string {
  return (CONTENT_TYPE_LABELS as Record<string, string>)[type] || type;
}

function typeAccent(type: string): string {
  return (CONTENT_TYPE_ACCENTS as Record<string, string>)[type] || '#10b981';
}

export function renderBlogIndex(
  posts: BlogPostSummary[],
  page: number,
  totalPages: number,
  topic?: string,
  sort?: string,
  contentType?: string,
): string {
  const currentSort = sort || 'recent';

  const buildUrl = (params: Record<string, string | number | undefined>) => {
    const parts: string[] = [];
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== '' && v !== 'recent' && v !== 'all') {
        parts.push(`${k}=${encodeURIComponent(String(v))}`);
      }
    }
    if (params.page && Number(params.page) > 1) {
      // already added above
    } else {
      const idx = parts.findIndex(p => p.startsWith('page='));
      if (idx !== -1) parts.splice(idx, 1);
    }
    return `/blog${parts.length ? '?' + parts.join('&') : ''}`;
  };

  const canonical = buildUrl({ topic, sort: currentSort, type: contentType, page });

  const title = topic
    ? `${topic} — GATE Math Blog`
    : 'GATE Math Blog — Solved Problems, Study Guides, Exam Strategy';
  const description = topic
    ? `GATE Engineering Mathematics articles on ${topic}.`
    : 'GATE Engineering Mathematics blog. Verified solved problems, topic guides, and exam strategies.';

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: title,
    description,
    url: `${BASE_URL}${canonical}`,
    publisher: { '@type': 'Organization', name: 'GATE Math', url: BASE_URL },
  };

  // Topic filter pills
  const topicPillsHtml = GATE_TOPICS.map(t => {
    const isActive = topic === t;
    const label = t.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    const href = isActive
      ? buildUrl({ sort: currentSort, type: contentType, page: 1 })
      : buildUrl({ topic: t, sort: currentSort, type: contentType, page: 1 });
    return `<a href="${href}" class="pill${isActive ? ' active' : ''}">${escapeHtml(label)}</a>`;
  }).join('');

  // Sort tabs
  const sorts = [
    { key: 'recent', label: 'Recent' },
    { key: 'trending', label: 'Trending' },
    { key: 'views', label: 'Most Read' },
  ];
  const sortTabsHtml = sorts.map(s => {
    const isActive = currentSort === s.key;
    const href = buildUrl({ topic, sort: s.key, type: contentType, page: 1 });
    return `<a href="${href}" class="tab${isActive ? ' active' : ''}">${s.label}</a>`;
  }).join('');

  // Content type tabs
  const types = [
    { key: 'all', label: 'All' },
    { key: 'solved_problem', label: 'Solved' },
    { key: 'topic_explainer', label: 'Guides' },
    { key: 'exam_strategy', label: 'Strategy' },
    { key: 'comparison', label: 'Compare' },
  ];
  const typeTabsHtml = types.map(t => {
    const isActive = (contentType || 'all') === t.key;
    const href = buildUrl({ topic, sort: currentSort, type: t.key === 'all' ? undefined : t.key, page: 1 });
    return `<a href="${href}" class="tab${isActive ? ' active' : ''}">${t.label}</a>`;
  }).join('');

  // Post feed items — neubrutalist cards with colored borders + offset shadows
  const postsHtml = posts.map((post, i) => {
    const accent = typeAccent(post.content_type);
    const delay = Math.min(i * 80, 640);
    const topicLabel = post.topic ? post.topic.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) : '';
    const dateStr = post.published_at
      ? new Date(post.published_at).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })
      : '';

    return `<a href="/blog/${escapeHtml(post.slug)}" class="card" style="--accent:${accent};--delay:${delay}ms">
      <div class="card-top">
        <span class="badge" style="border-color:${accent};color:${accent}">${contentTypeLabel(post.content_type)}</span>
        ${topicLabel ? `<span class="card-meta">${escapeHtml(topicLabel)}</span>` : ''}
        ${dateStr ? `<span class="card-meta">${dateStr}</span>` : ''}
      </div>
      <h2 class="card-title">${escapeHtml(post.title)}</h2>
      ${post.excerpt ? `<p class="card-excerpt">${escapeHtml(post.excerpt)}</p>` : ''}
    </a>`;
  }).join('\n');

  // Pagination
  const prevUrl = page > 1 ? buildUrl({ topic, sort: currentSort, type: contentType, page: page - 1 }) : null;
  const nextUrl = page < totalPages ? buildUrl({ topic, sort: currentSort, type: contentType, page: page + 1 }) : null;
  const paginationHtml = totalPages > 1 ? `<nav class="pagination">
    ${prevUrl ? `<a href="${prevUrl}" class="page-btn">&larr; Newer</a>` : '<span></span>'}
    <span class="page-info">${page} / ${totalPages}</span>
    ${nextUrl ? `<a href="${nextUrl}" class="page-btn">Older &rarr;</a>` : '<span></span>'}
  </nav>` : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}">
  <link rel="canonical" href="${BASE_URL}${canonical}">
  <meta property="og:type" content="website">
  <meta property="og:title" content="${escapeHtml(title)}">
  <meta property="og:description" content="${escapeHtml(description)}">
  <meta name="twitter:card" content="summary">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&display=swap" rel="stylesheet">
  <link rel="alternate" type="application/rss+xml" title="GATE Math Blog" href="${BASE_URL}/rss.xml">
  <script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:'Space Grotesk',system-ui,sans-serif;background:#0a0f1a;color:#e2e8f0;-webkit-font-smoothing:antialiased}
    .wrap{max-width:660px;margin:0 auto;padding:32px 20px}
    nav{display:flex;align-items:center;justify-content:space-between;margin-bottom:40px}
    nav .logo{color:#f8fafc;font-weight:700;font-size:1.05rem;text-decoration:none;letter-spacing:-0.02em}
    nav a{color:#64748b;text-decoration:none;font-size:0.85rem;transition:color 0.2s}
    nav a:hover{color:#10b981}
    h1{font-size:1.8rem;font-weight:700;color:#f8fafc;letter-spacing:-0.03em;margin-bottom:6px}
    .subtitle{color:#64748b;font-size:0.9rem;margin-bottom:24px}
    .pills{display:flex;gap:6px;overflow-x:auto;padding:2px 0 18px;-webkit-overflow-scrolling:touch;scrollbar-width:none}
    .pills::-webkit-scrollbar{display:none}
    .pill{white-space:nowrap;padding:7px 14px;border-radius:4px;font-size:0.78rem;font-weight:600;color:#94a3b8;background:#111827;border:2px solid #1f2937;text-decoration:none;transition:all 0.2s ease;flex-shrink:0;text-transform:uppercase;letter-spacing:0.04em}
    .pill:hover{color:#e2e8f0;border-color:#475569;transform:translateY(-1px)}
    .pill.active{color:#10b981;background:rgba(16,185,129,0.08);border-color:#10b981}
    .controls{display:flex;gap:12px;align-items:center;margin-bottom:28px;flex-wrap:wrap}
    .tab{color:#64748b;font-size:0.8rem;font-weight:600;text-decoration:none;padding:6px 12px;border-radius:4px;border:2px solid transparent;transition:all 0.2s;text-transform:uppercase;letter-spacing:0.03em}
    .tab:hover{color:#cbd5e1;border-color:#374151}
    .tab.active{color:#f8fafc;border-color:#f8fafc;background:rgba(248,250,252,0.05)}
    .divider{width:2px;height:18px;background:#1f2937;margin:0 2px}
    .feed{display:flex;flex-direction:column;gap:16px}
    .card{display:block;padding:20px;border:2px solid var(--accent,#10b981);border-radius:4px;background:#111827;text-decoration:none;box-shadow:3px 3px 0 var(--accent,#10b981);transition:transform 0.2s ease,box-shadow 0.2s ease;animation:enterUp 0.4s ease both;animation-delay:var(--delay,0ms)}
    .card:hover{transform:translate(3px,3px);box-shadow:0 0 0 var(--accent,#10b981)}
    .card:active{transform:translate(3px,3px);box-shadow:0 0 0 var(--accent,#10b981)}
    .card-top{display:flex;align-items:center;gap:8px;margin-bottom:10px;flex-wrap:wrap}
    .badge{font-size:0.7rem;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;padding:3px 10px;border:2px solid;border-radius:2px}
    .card-meta{color:#475569;font-size:0.78rem;font-weight:500}
    .card-title{color:#f1f5f9;font-size:1.05rem;font-weight:600;line-height:1.4;margin-bottom:6px;letter-spacing:-0.01em}
    .card:hover .card-title{color:#fff}
    .card-excerpt{color:#64748b;font-size:0.88rem;line-height:1.55;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
    .empty{text-align:center;padding:64px 0;color:#475569}
    .pagination{display:flex;justify-content:space-between;align-items:center;padding:24px 0;margin-top:8px}
    .page-btn{color:#f8fafc;text-decoration:none;font-size:0.85rem;font-weight:600;padding:8px 18px;border-radius:4px;border:2px solid #f8fafc;box-shadow:3px 3px 0 #f8fafc;transition:all 0.2s;text-transform:uppercase;letter-spacing:0.03em}
    .page-btn:hover{transform:translate(3px,3px);box-shadow:0 0 0 #f8fafc}
    .page-info{color:#475569;font-size:0.82rem;font-weight:600}
    footer{margin-top:48px;padding-top:20px;border-top:2px solid #1f2937;color:#374151;font-size:0.78rem;text-align:center}
    footer a{color:#475569;text-decoration:none}
    footer a:hover{color:#10b981}
    @keyframes enterUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
    @media(prefers-reduced-motion:reduce){
      .card,.page-btn,.pill,.tab{animation:none!important;transition:none!important}
    }
    @media(max-width:640px){
      .wrap{padding:20px 16px}
      h1{font-size:1.5rem}
    }
  </style>
</head>
<body>
  <div class="wrap">
    <nav>
      <a href="/blog" class="logo">GATE Math</a>
      <a href="/">Open App &rarr;</a>
    </nav>
    <h1>${topic ? escapeHtml(topic.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())) : 'Blog'}</h1>
    <p class="subtitle">${topic ? `Articles on ${escapeHtml(topic.replace(/-/g, ' '))} for GATE` : 'Verified problems, guides, and strategy'}</p>
    <div class="pills">
      <a href="${buildUrl({ sort: currentSort, type: contentType, page: 1 })}" class="pill${!topic ? ' active' : ''}">All Topics</a>
      ${topicPillsHtml}
    </div>
    <div class="controls">
      ${sortTabsHtml}
      <div class="divider"></div>
      ${typeTabsHtml}
    </div>
    <div class="feed">
      ${postsHtml}
      ${posts.length === 0 ? '<p class="empty">No posts yet. Check back soon.</p>' : ''}
    </div>
    ${paginationHtml}
    <footer>
      <p><a href="/blog">Blog</a> &middot; <a href="/">App</a> &middot; <a href="/rss.xml">RSS</a></p>
      <p style="margin-top:6px">&copy; ${new Date().getFullYear()} GATE Math</p>
    </footer>
  </div>
</body>
</html>`;
}
