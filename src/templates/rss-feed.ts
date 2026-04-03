// @ts-nocheck
/**
 * RSS Feed Generator
 *
 * Standard RSS 2.0 feed from published blog posts.
 */

const BASE_URL = process.env.BASE_URL || 'https://gate-math-api.onrender.com';

interface RssItem {
  title: string;
  slug: string;
  excerpt: string;
  topic: string;
  published_at: string;
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function renderRssFeed(posts: RssItem[]): string {
  const items = posts.map(post => `    <item>
      <title>${escapeXml(post.title)}</title>
      <link>${BASE_URL}/blog/${post.slug}</link>
      <guid isPermaLink="true">${BASE_URL}/blog/${post.slug}</guid>
      <description>${escapeXml(post.excerpt || '')}</description>
      ${post.topic ? `<category>${escapeXml(post.topic)}</category>` : ''}
      <pubDate>${new Date(post.published_at).toUTCString()}</pubDate>
    </item>`).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>GATE Math Blog</title>
    <link>${BASE_URL}/blog</link>
    <description>Verified solved problems, study guides, and exam strategy for GATE Engineering Mathematics aspirants.</description>
    <language>en</language>
    <atom:link href="${BASE_URL}/rss.xml" rel="self" type="application/rss+xml"/>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
${items}
  </channel>
</rss>`;
}
