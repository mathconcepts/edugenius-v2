// @ts-nocheck
/**
 * Dynamic Sitemap Generator
 *
 * Generates XML sitemap from published blog posts + topic landing pages.
 */

const BASE_URL = process.env.BASE_URL || 'https://gate-math-api.onrender.com';

interface SitemapEntry {
  loc: string;
  lastmod?: string;
  changefreq: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never';
  priority: number;
}

export function renderSitemap(entries: SitemapEntry[]): string {
  const urls = entries.map(e => `  <url>
    <loc>${BASE_URL}${e.loc}</loc>
    ${e.lastmod ? `<lastmod>${e.lastmod}</lastmod>` : ''}
    <changefreq>${e.changefreq}</changefreq>
    <priority>${e.priority.toFixed(1)}</priority>
  </url>`).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${BASE_URL}/</loc>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>${BASE_URL}/blog</loc>
    <changefreq>daily</changefreq>
    <priority>0.9</priority>
  </url>
${urls}
</urlset>`;
}

/**
 * Build sitemap entries from blog posts and topics.
 */
export function buildSitemapEntries(
  blogPosts: Array<{ slug: string; updated_at?: string }>,
  topics: string[]
): SitemapEntry[] {
  const entries: SitemapEntry[] = [];

  // Topic landing pages
  for (const topic of topics) {
    entries.push({
      loc: `/exams/${encodeURIComponent(topic.toLowerCase().replace(/\s+/g, '-'))}`,
      changefreq: 'weekly',
      priority: 0.8,
    });
  }

  // Blog posts
  for (const post of blogPosts) {
    entries.push({
      loc: `/blog/${post.slug}`,
      lastmod: post.updated_at ? new Date(post.updated_at).toISOString().split('T')[0] : undefined,
      changefreq: 'monthly',
      priority: 0.7,
    });
  }

  return entries;
}
