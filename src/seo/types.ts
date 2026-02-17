/**
 * SEO Types
 * Comprehensive SEO management
 */

// Meta tags
export interface MetaTags {
  title: string;
  description: string;
  keywords?: string[];
  robots?: RobotsDirective;
  canonical?: string;
  
  // Open Graph
  og?: OpenGraphTags;
  
  // Twitter Card
  twitter?: TwitterCardTags;
  
  // Article-specific
  article?: ArticleTags;
  
  // Custom meta tags
  custom?: CustomMetaTag[];
}

export type RobotsDirective = 
  | 'index, follow'
  | 'noindex, follow'
  | 'index, nofollow'
  | 'noindex, nofollow';

export interface OpenGraphTags {
  type: 'website' | 'article' | 'product' | 'profile';
  title?: string;
  description?: string;
  image?: string;
  imageAlt?: string;
  imageWidth?: number;
  imageHeight?: number;
  url?: string;
  siteName?: string;
  locale?: string;
}

export interface TwitterCardTags {
  card: 'summary' | 'summary_large_image' | 'app' | 'player';
  site?: string;
  creator?: string;
  title?: string;
  description?: string;
  image?: string;
  imageAlt?: string;
}

export interface ArticleTags {
  publishedTime?: string;
  modifiedTime?: string;
  author?: string;
  section?: string;
  tags?: string[];
}

export interface CustomMetaTag {
  name?: string;
  property?: string;
  content: string;
}

// Structured data (JSON-LD)
export interface StructuredData {
  '@context': 'https://schema.org';
  '@type': SchemaType;
  [key: string]: any;
}

export type SchemaType =
  | 'Organization'
  | 'WebSite'
  | 'WebPage'
  | 'Article'
  | 'BlogPosting'
  | 'Course'
  | 'EducationalOrganization'
  | 'Product'
  | 'Review'
  | 'FAQPage'
  | 'HowTo'
  | 'BreadcrumbList'
  | 'Person'
  | 'VideoObject';

// Sitemap
export interface SitemapEntry {
  url: string;
  lastmod?: string;
  changefreq?: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never';
  priority?: number; // 0.0 to 1.0
  images?: SitemapImage[];
  videos?: SitemapVideo[];
  alternates?: SitemapAlternate[];
}

export interface SitemapImage {
  url: string;
  title?: string;
  caption?: string;
  geoLocation?: string;
  license?: string;
}

export interface SitemapVideo {
  thumbnailUrl: string;
  title: string;
  description: string;
  contentUrl?: string;
  playerUrl?: string;
  duration?: number;
  publicationDate?: string;
}

export interface SitemapAlternate {
  hreflang: string;
  url: string;
}

// Page configuration
export interface PageSEOConfig {
  path: string;
  meta: MetaTags;
  structuredData?: StructuredData[];
  sitemap?: Partial<SitemapEntry>;
}

// Site-wide configuration
export interface SEOConfig {
  // Site info
  siteName: string;
  siteUrl: string;
  defaultLanguage: string;
  supportedLanguages: string[];
  
  // Default meta
  defaultMeta: Partial<MetaTags>;
  
  // Social
  social?: {
    twitter?: string;
    facebook?: string;
    linkedin?: string;
    instagram?: string;
  };
  
  // Organization
  organization?: {
    name: string;
    logo: string;
    url: string;
    contactEmail?: string;
    contactPhone?: string;
    address?: {
      streetAddress: string;
      addressLocality: string;
      addressRegion: string;
      postalCode: string;
      addressCountry: string;
    };
  };
  
  // Analytics verification
  verification?: {
    google?: string;
    bing?: string;
    yandex?: string;
    baidu?: string;
  };
  
  // Robots.txt config
  robots?: {
    userAgent: string;
    rules: Array<{ directive: 'allow' | 'disallow'; path: string }>;
  }[];
}
