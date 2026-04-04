// @ts-nocheck
/**
 * Blog Index SSR Template
 *
 * Dark theme, single-column feed layout. Topic filter pills, sort options.
 * CSS-only stagger animations. No JS dependencies.
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
  content_score?: number;
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function contentTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    solved_problem: 'Solved',
    topic_explainer: 'Guide',
    exam_strategy: 'Strategy',
    comparison: 'Compare',
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

const GATE_TOPICS = [
  'linear-algebra', 'calculus', 'differential-equations', 'complex-variables',
  'probability-statistics', 'numerical-methods', 'transform-theory',
  'discrete-mathematics', 'graph-theory', 'vector-calculus',
];

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
    // Only add page if > 1
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
    return `<a href="${href}" class="sort-tab${isActive ? ' active' : ''}">${s.label}</a>`;
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
    return `<a href="${href}" class="sort-tab${isActive ? ' active' : ''}">${t.label}</a>`;
  }).join('');

  // Post feed items
  const postsHtml = posts.map((post, i) => {
    const accent = typeAccent(post.content_type);
    const delay = Math.min(i * 50, 400);
    const topicLabel = post.topic ? post.topic.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) : '';
    const dateStr = post.published_at
      ? new Date(post.published_at).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })
      : '';

    return `<a href="/blog/${escapeHtml(post.slug)}" class="feed-item" style="animation-delay:${delay}ms">
      <div class="feed-meta">
        <span class="feed-badge" style="color:${accent}">${contentTypeLabel(post.content_type)}</span>
        ${topicLabel ? `<span class="feed-dot">&middot;</span><span class="feed-topic">${escapeHtml(topicLabel)}</span>` : ''}
        ${dateStr ? `<span class="feed-dot">&middot;</span><span class="feed-date">${dateStr}</span>` : ''}
      </div>
      <h2 class="feed-title">${escapeHtml(post.title)}</h2>
      ${post.excerpt ? `<p class="feed-excerpt">${escapeHtml(post.excerpt)}</p>` : ''}
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
  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
  <link rel="alternate" type="application/rss+xml" title="GATE Math Blog" href="${BASE_URL}/rss.xml">
  <script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:'DM Sans',sans-serif;background:#0a0f1a;color:#e2e8f0;-webkit-font-smoothing:antialiased}
    .container{max-width:640px;margin:0 auto;padding:32px 20px}
    .nav{display:flex;align-items:center;justify-content:space-between;margin-bottom:40px}
    .nav .logo{color:#f8fafc;font-weight:700;font-size:1rem;text-decoration:none}
    .nav a{color:#64748b;text-decoration:none;font-size:0.85rem;transition:color 0.2s}
    .nav a:hover{color:#10b981}
    h1{font-size:1.5rem;font-weight:800;color:#f8fafc;margin-bottom:6px;letter-spacing:-0.02em}
    .subtitle{color:#64748b;font-size:0.9rem;margin-bottom:24px}
    .pills{display:flex;gap:6px;overflow-x:auto;padding:2px 0 16px;-webkit-overflow-scrolling:touch;scrollbar-width:none}
    .pills::-webkit-scrollbar{display:none}
    .pill{white-space:nowrap;padding:6px 14px;border-radius:999px;font-size:0.78rem;font-weight:500;color:#94a3b8;background:#111827;border:1px solid #1f2937;text-decoration:none;transition:all 0.2s ease;flex-shrink:0}
    .pill:hover{color:#e2e8f0;border-color:#374151}
    .pill.active{color:#10b981;background:rgba(16,185,129,0.1);border-color:rgba(16,185,129,0.3)}
    .controls{display:flex;gap:16px;align-items:center;margin-bottom:24px;border-bottom:1px solid #1f2937;padding-bottom:12px}
    .sort-tab{color:#64748b;font-size:0.8rem;font-weight:500;text-decoration:none;padding:4px 0;transition:color 0.2s;position:relative}
    .sort-tab:hover{color:#cbd5e1}
    .sort-tab.active{color:#e2e8f0}
    .sort-tab.active::after{content:'';position:absolute;bottom:-13px;left:0;right:0;height:2px;background:#10b981;border-radius:1px}
    .divider{width:1px;height:16px;background:#1f2937;margin:0 4px}
    .feed-item{display:block;padding:20px 0;border-bottom:1px solid #111827;text-decoration:none;transition:background 0.15s ease;animation:fadeSlideUp 0.4s ease both}
    .feed-item:hover{background:rgba(17,24,39,0.5);margin:0 -20px;padding:20px;border-radius:12px;border-color:transparent}
    .feed-item:last-child{border-bottom:none}
    .feed-meta{display:flex;align-items:center;gap:6px;margin-bottom:8px}
    .feed-badge{font-size:0.72rem;font-weight:600;text-transform:uppercase;letter-spacing:0.05em}
    .feed-dot{color:#374151;font-size:0.7rem}
    .feed-topic,.feed-date{color:#475569;font-size:0.78rem}
    .feed-title{color:#f1f5f9;font-size:1.05rem;font-weight:600;line-height:1.4;margin-bottom:6px;transition:color 0.15s}
    .feed-item:hover .feed-title{color:#fff}
    .feed-excerpt{color:#64748b;font-size:0.88rem;line-height:1.5;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
    .empty{text-align:center;padding:64px 0;color:#475569}
    .pagination{display:flex;justify-content:space-between;align-items:center;padding:24px 0;margin-top:8px}
    .page-btn{color:#10b981;text-decoration:none;font-size:0.85rem;font-weight:500;padding:8px 16px;border-radius:8px;border:1px solid #1f2937;transition:all 0.2s}
    .page-btn:hover{background:#111827;border-color:#374151}
    .page-info{color:#475569;font-size:0.82rem}
    .footer{margin-top:48px;padding-top:20px;border-top:1px solid #111827;color:#374151;font-size:0.78rem;text-align:center}
    .footer a{color:#475569;text-decoration:none}
    .footer a:hover{color:#10b981}
    @keyframes fadeSlideUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
    @media(max-width:640px){
      .container{padding:20px 16px}
      h1{font-size:1.3rem}
      .feed-item:hover{margin:0 -16px;padding:20px 16px}
    }
  </style>
</head>
<body>
  <div class="container">
    <nav class="nav">
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
    <footer class="footer">
      <p><a href="/blog">Blog</a> &middot; <a href="/">App</a> &middot; <a href="/rss.xml">RSS</a></p>
      <p style="margin-top:6px">&copy; ${new Date().getFullYear()} GATE Math</p>
    </footer>
  </div>
</body>
</html>`;
}
