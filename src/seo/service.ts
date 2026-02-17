/**
 * SEO Service
 * Generate meta tags, structured data, sitemaps
 */

import {
  MetaTags, StructuredData, SitemapEntry, PageSEOConfig, SEOConfig,
  OpenGraphTags, TwitterCardTags, SchemaType
} from './types';

// Default configuration
let seoConfig: SEOConfig = {
  siteName: 'EduGenius',
  siteUrl: process.env.SITE_URL || 'https://edugenius.ai',
  defaultLanguage: 'en',
  supportedLanguages: ['en', 'hi'],
  defaultMeta: {
    title: 'EduGenius - AI-Powered Learning Platform',
    description: 'Master any exam with personalized AI tutoring. JEE, NEET, CBSE, and more.',
    robots: 'index, follow'
  },
  organization: {
    name: 'EduGenius',
    logo: 'https://edugenius.ai/logo.png',
    url: 'https://edugenius.ai'
  }
};

// Page configurations store
const pageConfigs = new Map<string, PageSEOConfig>();

/**
 * Configure SEO settings
 */
export function configureSEO(config: Partial<SEOConfig>): void {
  seoConfig = { ...seoConfig, ...config };
}

/**
 * Get current SEO config
 */
export function getSEOConfig(): SEOConfig {
  return seoConfig;
}

/**
 * Register page SEO configuration
 */
export function registerPage(config: PageSEOConfig): void {
  pageConfigs.set(config.path, config);
}

/**
 * Get page SEO configuration
 */
export function getPageConfig(path: string): PageSEOConfig | null {
  return pageConfigs.get(path) || null;
}

// ============ META TAGS ============

/**
 * Generate full meta tags for a page
 */
export function generateMetaTags(
  pageMeta: Partial<MetaTags>,
  path: string = '/'
): MetaTags {
  const defaults = seoConfig.defaultMeta;
  const fullUrl = `${seoConfig.siteUrl}${path}`;
  
  const title = pageMeta.title || defaults.title || seoConfig.siteName;
  const description = pageMeta.description || defaults.description || '';
  
  return {
    title: `${title} | ${seoConfig.siteName}`,
    description,
    keywords: pageMeta.keywords || defaults.keywords,
    robots: pageMeta.robots || defaults.robots || 'index, follow',
    canonical: pageMeta.canonical || fullUrl,
    og: {
      type: 'website',
      title,
      description,
      url: fullUrl,
      siteName: seoConfig.siteName,
      locale: seoConfig.defaultLanguage,
      ...seoConfig.defaultMeta.og,
      ...pageMeta.og
    },
    twitter: {
      card: 'summary_large_image',
      site: seoConfig.social?.twitter,
      title,
      description,
      ...seoConfig.defaultMeta.twitter,
      ...pageMeta.twitter
    },
    article: pageMeta.article,
    custom: [
      ...(seoConfig.verification?.google ? [{ name: 'google-site-verification', content: seoConfig.verification.google }] : []),
      ...(seoConfig.verification?.bing ? [{ name: 'msvalidate.01', content: seoConfig.verification.bing }] : []),
      ...(pageMeta.custom || [])
    ]
  };
}

/**
 * Generate HTML meta tags string
 */
export function renderMetaTags(meta: MetaTags): string {
  const tags: string[] = [];
  
  // Basic meta
  tags.push(`<title>${escapeHtml(meta.title)}</title>`);
  tags.push(`<meta name="description" content="${escapeHtml(meta.description)}">`);
  
  if (meta.keywords?.length) {
    tags.push(`<meta name="keywords" content="${escapeHtml(meta.keywords.join(', '))}">`);
  }
  
  if (meta.robots) {
    tags.push(`<meta name="robots" content="${meta.robots}">`);
  }
  
  if (meta.canonical) {
    tags.push(`<link rel="canonical" href="${escapeHtml(meta.canonical)}">`);
  }
  
  // Open Graph
  if (meta.og) {
    const og = meta.og;
    tags.push(`<meta property="og:type" content="${og.type}">`);
    if (og.title) tags.push(`<meta property="og:title" content="${escapeHtml(og.title)}">`);
    if (og.description) tags.push(`<meta property="og:description" content="${escapeHtml(og.description)}">`);
    if (og.url) tags.push(`<meta property="og:url" content="${escapeHtml(og.url)}">`);
    if (og.siteName) tags.push(`<meta property="og:site_name" content="${escapeHtml(og.siteName)}">`);
    if (og.image) tags.push(`<meta property="og:image" content="${escapeHtml(og.image)}">`);
    if (og.imageAlt) tags.push(`<meta property="og:image:alt" content="${escapeHtml(og.imageAlt)}">`);
    if (og.imageWidth) tags.push(`<meta property="og:image:width" content="${og.imageWidth}">`);
    if (og.imageHeight) tags.push(`<meta property="og:image:height" content="${og.imageHeight}">`);
    if (og.locale) tags.push(`<meta property="og:locale" content="${og.locale}">`);
  }
  
  // Twitter Card
  if (meta.twitter) {
    const tw = meta.twitter;
    tags.push(`<meta name="twitter:card" content="${tw.card}">`);
    if (tw.site) tags.push(`<meta name="twitter:site" content="${escapeHtml(tw.site)}">`);
    if (tw.creator) tags.push(`<meta name="twitter:creator" content="${escapeHtml(tw.creator)}">`);
    if (tw.title) tags.push(`<meta name="twitter:title" content="${escapeHtml(tw.title)}">`);
    if (tw.description) tags.push(`<meta name="twitter:description" content="${escapeHtml(tw.description)}">`);
    if (tw.image) tags.push(`<meta name="twitter:image" content="${escapeHtml(tw.image)}">`);
    if (tw.imageAlt) tags.push(`<meta name="twitter:image:alt" content="${escapeHtml(tw.imageAlt)}">`);
  }
  
  // Article meta
  if (meta.article) {
    const art = meta.article;
    if (art.publishedTime) tags.push(`<meta property="article:published_time" content="${art.publishedTime}">`);
    if (art.modifiedTime) tags.push(`<meta property="article:modified_time" content="${art.modifiedTime}">`);
    if (art.author) tags.push(`<meta property="article:author" content="${escapeHtml(art.author)}">`);
    if (art.section) tags.push(`<meta property="article:section" content="${escapeHtml(art.section)}">`);
    art.tags?.forEach(tag => {
      tags.push(`<meta property="article:tag" content="${escapeHtml(tag)}">`);
    });
  }
  
  // Custom meta
  meta.custom?.forEach(custom => {
    if (custom.name) {
      tags.push(`<meta name="${escapeHtml(custom.name)}" content="${escapeHtml(custom.content)}">`);
    } else if (custom.property) {
      tags.push(`<meta property="${escapeHtml(custom.property)}" content="${escapeHtml(custom.content)}">`);
    }
  });
  
  return tags.join('\n');
}

// ============ STRUCTURED DATA ============

/**
 * Generate Organization schema
 */
export function generateOrganizationSchema(): StructuredData {
  const org = seoConfig.organization;
  return {
    '@context': 'https://schema.org',
    '@type': 'EducationalOrganization',
    name: org?.name || seoConfig.siteName,
    url: org?.url || seoConfig.siteUrl,
    logo: org?.logo,
    contactPoint: org?.contactEmail ? {
      '@type': 'ContactPoint',
      email: org.contactEmail,
      telephone: org.contactPhone,
      contactType: 'customer service'
    } : undefined,
    address: org?.address ? {
      '@type': 'PostalAddress',
      ...org.address
    } : undefined,
    sameAs: [
      seoConfig.social?.twitter ? `https://twitter.com/${seoConfig.social.twitter.replace('@', '')}` : null,
      seoConfig.social?.facebook ? `https://facebook.com/${seoConfig.social.facebook}` : null,
      seoConfig.social?.linkedin ? `https://linkedin.com/company/${seoConfig.social.linkedin}` : null,
      seoConfig.social?.instagram ? `https://instagram.com/${seoConfig.social.instagram}` : null
    ].filter(Boolean)
  };
}

/**
 * Generate WebSite schema with search action
 */
export function generateWebSiteSchema(): StructuredData {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: seoConfig.siteName,
    url: seoConfig.siteUrl,
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${seoConfig.siteUrl}/search?q={search_term_string}`
      },
      'query-input': 'required name=search_term_string'
    }
  };
}

/**
 * Generate BreadcrumbList schema
 */
export function generateBreadcrumbSchema(
  breadcrumbs: Array<{ name: string; url: string }>
): StructuredData {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: breadcrumbs.map((crumb, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: crumb.name,
      item: crumb.url
    }))
  };
}

/**
 * Generate Course schema
 */
export function generateCourseSchema(course: {
  name: string;
  description: string;
  provider?: string;
  url?: string;
  image?: string;
  rating?: { value: number; count: number };
}): StructuredData {
  return {
    '@context': 'https://schema.org',
    '@type': 'Course',
    name: course.name,
    description: course.description,
    provider: {
      '@type': 'Organization',
      name: course.provider || seoConfig.organization?.name || seoConfig.siteName,
      url: seoConfig.siteUrl
    },
    url: course.url,
    image: course.image,
    aggregateRating: course.rating ? {
      '@type': 'AggregateRating',
      ratingValue: course.rating.value,
      reviewCount: course.rating.count
    } : undefined
  };
}

/**
 * Generate FAQPage schema
 */
export function generateFAQSchema(
  faqs: Array<{ question: string; answer: string }>
): StructuredData {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map(faq => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.answer
      }
    }))
  };
}

/**
 * Generate Article schema
 */
export function generateArticleSchema(article: {
  headline: string;
  description: string;
  image?: string;
  author?: string;
  datePublished: string;
  dateModified?: string;
  url: string;
}): StructuredData {
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: article.headline,
    description: article.description,
    image: article.image,
    author: {
      '@type': 'Person',
      name: article.author || 'EduGenius Team'
    },
    publisher: {
      '@type': 'Organization',
      name: seoConfig.organization?.name || seoConfig.siteName,
      logo: {
        '@type': 'ImageObject',
        url: seoConfig.organization?.logo
      }
    },
    datePublished: article.datePublished,
    dateModified: article.dateModified || article.datePublished,
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': article.url
    }
  };
}

/**
 * Render structured data as script tag
 */
export function renderStructuredData(data: StructuredData | StructuredData[]): string {
  const items = Array.isArray(data) ? data : [data];
  return items.map(item => 
    `<script type="application/ld+json">${JSON.stringify(item, null, 2)}</script>`
  ).join('\n');
}

// ============ SITEMAP ============

/**
 * Generate XML sitemap
 */
export function generateSitemap(entries: SitemapEntry[]): string {
  const urlset = entries.map(entry => {
    let url = `  <url>\n    <loc>${escapeXml(entry.url)}</loc>`;
    
    if (entry.lastmod) {
      url += `\n    <lastmod>${entry.lastmod}</lastmod>`;
    }
    if (entry.changefreq) {
      url += `\n    <changefreq>${entry.changefreq}</changefreq>`;
    }
    if (entry.priority !== undefined) {
      url += `\n    <priority>${entry.priority.toFixed(1)}</priority>`;
    }
    
    // Images
    entry.images?.forEach(img => {
      url += `\n    <image:image>`;
      url += `\n      <image:loc>${escapeXml(img.url)}</image:loc>`;
      if (img.title) url += `\n      <image:title>${escapeXml(img.title)}</image:title>`;
      if (img.caption) url += `\n      <image:caption>${escapeXml(img.caption)}</image:caption>`;
      url += `\n    </image:image>`;
    });
    
    // Alternates (hreflang)
    entry.alternates?.forEach(alt => {
      url += `\n    <xhtml:link rel="alternate" hreflang="${alt.hreflang}" href="${escapeXml(alt.url)}"/>`;
    });
    
    url += '\n  </url>';
    return url;
  }).join('\n');
  
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
${urlset}
</urlset>`;
}

/**
 * Generate sitemap index for large sites
 */
export function generateSitemapIndex(sitemaps: Array<{ url: string; lastmod?: string }>): string {
  const entries = sitemaps.map(sm => {
    let entry = `  <sitemap>\n    <loc>${escapeXml(sm.url)}</loc>`;
    if (sm.lastmod) {
      entry += `\n    <lastmod>${sm.lastmod}</lastmod>`;
    }
    entry += '\n  </sitemap>';
    return entry;
  }).join('\n');
  
  return `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries}
</sitemapindex>`;
}

// ============ ROBOTS.TXT ============

/**
 * Generate robots.txt content
 */
export function generateRobotsTxt(): string {
  const rules = seoConfig.robots || [
    { userAgent: '*', rules: [{ directive: 'allow' as const, path: '/' }] }
  ];
  
  let content = '';
  
  rules.forEach(section => {
    content += `User-agent: ${section.userAgent}\n`;
    section.rules.forEach(rule => {
      content += `${rule.directive === 'allow' ? 'Allow' : 'Disallow'}: ${rule.path}\n`;
    });
    content += '\n';
  });
  
  content += `Sitemap: ${seoConfig.siteUrl}/sitemap.xml\n`;
  
  return content;
}

// ============ UTILITIES ============

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// Export types
export * from './types';
