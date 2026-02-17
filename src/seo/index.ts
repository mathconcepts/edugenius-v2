/**
 * SEO Module
 * Export all SEO functionality
 */

export {
  configureSEO,
  getSEOConfig,
  registerPage,
  getPageConfig,
  generateMetaTags,
  renderMetaTags,
  generateOrganizationSchema,
  generateWebSiteSchema,
  generateBreadcrumbSchema,
  generateCourseSchema,
  generateFAQSchema,
  generateArticleSchema,
  renderStructuredData,
  generateSitemap,
  generateSitemapIndex,
  generateRobotsTxt
} from './service';

export * from './types';
