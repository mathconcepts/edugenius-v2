// @ts-nocheck
/**
 * Exam Landing Page SSR Template
 *
 * Server-rendered topic/exam landing pages for SEO.
 * Hero + sample problems + related blogs + CTA.
 */

const BASE_URL = process.env.BASE_URL || 'https://gate-math-api.onrender.com';

interface Problem {
  id: string;
  question_text: string;
  topic: string;
  difficulty: string;
  options: Record<string, string>;
}

interface BlogPostSummary {
  slug: string;
  title: string;
  content_type: string;
  excerpt: string;
}

interface ExamLandingData {
  examId: string;
  title: string;
  description: string;
  problems: Problem[];
  blogs: BlogPostSummary[];
  stats: {
    totalProblems: number;
    topics: string[];
    difficultyDistribution: Record<string, number>;
  };
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function renderExamLanding(data: ExamLandingData): string {
  const { examId, title, description, problems, blogs, stats } = data;
  const canonical = `${BASE_URL}/exams/${encodeURIComponent(examId)}`;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Course',
    name: title,
    description,
    url: canonical,
    provider: { '@type': 'Organization', name: 'GATE Math', url: BASE_URL },
    hasCourseInstance: {
      '@type': 'CourseInstance',
      courseMode: 'online',
      courseWorkload: 'PT2H',
    },
  };

  const problemsHtml = problems.slice(0, 5).map((p, i) => {
    const diffColors: Record<string, string> = { easy: '#10b981', medium: '#f59e0b', hard: '#ef4444' };
    return `<div style="background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:20px;margin-bottom:12px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
        <span style="color:#94a3b8;font-size:0.8rem">Problem ${i + 1}</span>
        <span style="color:${diffColors[p.difficulty] || '#64748b'};font-size:0.8rem;font-weight:600;text-transform:capitalize">${p.difficulty}</span>
      </div>
      <p style="color:#0f172a;line-height:1.6;margin-bottom:12px">${escapeHtml(p.question_text.substring(0, 200))}${p.question_text.length > 200 ? '...' : ''}</p>
      <a href="/practice/${p.id}" style="color:#10b981;font-size:0.9rem;font-weight:600;text-decoration:none">Solve this problem &rarr;</a>
    </div>`;
  }).join('');

  const blogsHtml = blogs.slice(0, 4).map(b => {
    return `<a href="/blog/${escapeHtml(b.slug)}" style="display:block;background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:16px;text-decoration:none;transition:box-shadow 0.2s">
      <h3 style="color:#0f172a;font-size:1rem;font-weight:600;margin-bottom:4px">${escapeHtml(b.title)}</h3>
      ${b.excerpt ? `<p style="color:#64748b;font-size:0.85rem;line-height:1.4">${escapeHtml(b.excerpt.substring(0, 100))}</p>` : ''}
    </a>`;
  }).join('');

  const topicsList = stats.topics.map(t => `<span style="background:#eff6ff;color:#3b82f6;padding:4px 12px;border-radius:999px;font-size:0.8rem;font-weight:600">${escapeHtml(t)}</span>`).join(' ');

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
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css">
  <script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'DM Sans', sans-serif; background: #f8fafc; color: #0f172a; }
    .container { max-width: 768px; margin: 0 auto; padding: 24px 16px; }
    .hero { background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); color: #fff; padding: 48px 24px; border-radius: 16px; margin-bottom: 32px; text-align: center; }
    .hero h1 { font-size: 2rem; font-weight: 800; margin-bottom: 12px; }
    .hero p { color: #94a3b8; font-size: 1.05rem; line-height: 1.5; max-width: 600px; margin: 0 auto; }
    .stats { display: flex; justify-content: center; gap: 32px; margin-top: 24px; }
    .stat { text-align: center; }
    .stat-value { font-size: 1.75rem; font-weight: 800; color: #10b981; }
    .stat-label { font-size: 0.8rem; color: #94a3b8; }
    section { margin-bottom: 32px; }
    section h2 { font-size: 1.4rem; font-weight: 700; margin-bottom: 16px; color: #0f172a; }
    .footer { margin-top: 48px; padding-top: 24px; border-top: 1px solid #e2e8f0; color: #94a3b8; font-size: 0.85rem; text-align: center; }
    .footer a { color: #10b981; text-decoration: none; }
  </style>
</head>
<body>
  <div class="container">
    <div class="hero">
      <h1>${escapeHtml(title)}</h1>
      <p>${escapeHtml(description)}</p>
      <div class="stats">
        <div class="stat"><div class="stat-value">${stats.totalProblems}</div><div class="stat-label">Problems</div></div>
        <div class="stat"><div class="stat-value">${stats.topics.length}</div><div class="stat-label">Topics</div></div>
        <div class="stat"><div class="stat-value">3-Tier</div><div class="stat-label">Verified</div></div>
      </div>
    </div>

    <section>
      <h2>Topics Covered</h2>
      <div style="display:flex;flex-wrap:wrap;gap:8px">${topicsList}</div>
    </section>

    ${problems.length > 0 ? `<section>
      <h2>Sample Problems</h2>
      ${problemsHtml}
    </section>` : ''}

    ${blogs.length > 0 ? `<section>
      <h2>Related Articles</h2>
      <div style="display:grid;gap:12px;grid-template-columns:1fr 1fr">${blogsHtml}</div>
    </section>` : ''}

    <div style="text-align:center;margin:40px 0">
      <a href="/onboard" style="display:inline-block;background:#10b981;color:#fff;padding:16px 40px;border-radius:12px;text-decoration:none;font-weight:700;font-size:1.1rem">Start Preparing for ${escapeHtml(examId.replace(/-/g, ' ').toUpperCase())}</a>
      <p style="color:#94a3b8;font-size:0.85rem;margin-top:8px">Free. No credit card required.</p>
    </div>

    <footer class="footer">
      <p><a href="/blog">Blog</a> &middot; <a href="/">Home</a> &middot; <a href="/rss.xml">RSS</a></p>
      <p style="margin-top:8px">&copy; ${new Date().getFullYear()} GATE Math</p>
    </footer>
  </div>
</body>
</html>`;
}
