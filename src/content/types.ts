/**
 * Content Delivery Types
 * Blog, Vlog, and Landing Page configurations
 */

// ============================================================================
// Blog Types
// ============================================================================

export type BlogPlatform = 'self-hosted' | 'medium' | 'substack' | 'wordpress' | 'hashnode';
export type BlogStatus = 'draft' | 'review' | 'scheduled' | 'published' | 'archived';
export type BlogCategory = 'educational' | 'exam-tips' | 'news' | 'success-stories' | 'tutorials' | 'comparison' | 'how-to';

export interface BlogPost {
  id: string;
  
  // Content
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  contentHtml?: string;
  
  // Metadata
  category: BlogCategory;
  tags: string[];
  author: string;
  
  // Targeting
  examTypes: string[];
  targetAudience: string[];
  
  // SEO
  seo: BlogSEO;
  
  // Media
  featuredImage?: string;
  images: BlogImage[];
  
  // Publishing
  status: BlogStatus;
  platforms: BlogPublishConfig[];
  
  // Scheduling
  scheduledAt?: number;
  publishedAt?: number;
  
  // Metrics
  metrics?: BlogMetrics;
  
  // AI Generation
  promptTemplateId?: string;
  promptModifiers?: string[];
  generatedAt?: number;
  
  // Version control
  version: number;
  createdAt: number;
  updatedAt: number;
}

export interface BlogSEO {
  metaTitle: string;
  metaDescription: string;
  keywords: string[];
  canonicalUrl?: string;
  ogImage?: string;
  structuredData?: Record<string, unknown>;
}

export interface BlogImage {
  id: string;
  url: string;
  alt: string;
  caption?: string;
  width?: number;
  height?: number;
}

export interface BlogPublishConfig {
  platform: BlogPlatform;
  enabled: boolean;
  platformId?: string;       // ID on external platform
  customTitle?: string;      // Platform-specific title
  customContent?: string;    // Platform-specific content
  publishedUrl?: string;
}

export interface BlogMetrics {
  views: number;
  uniqueVisitors: number;
  avgTimeOnPage: number;
  bounceRate: number;
  shares: number;
  comments: number;
  backlinks: number;
  searchImpressions: number;
  searchClicks: number;
  conversionRate: number;
}

// ============================================================================
// Vlog Types
// ============================================================================

export type VlogPlatform = 'youtube' | 'instagram-reels' | 'tiktok' | 'linkedin-video' | 'shorts';
export type VlogStatus = 'script' | 'recording' | 'editing' | 'review' | 'scheduled' | 'published';
export type VlogFormat = 'tutorial' | 'explainer' | 'tips' | 'qa' | 'shorts' | 'live' | 'interview';

export interface VlogPost {
  id: string;
  
  // Content
  title: string;
  description: string;
  script: VlogScript;
  
  // Metadata
  format: VlogFormat;
  tags: string[];
  
  // Targeting
  examTypes: string[];
  targetAudience: string[];
  duration: number;          // seconds
  
  // Thumbnails
  thumbnails: VlogThumbnail[];
  
  // Publishing
  status: VlogStatus;
  platforms: VlogPublishConfig[];
  
  // Scheduling
  scheduledAt?: number;
  publishedAt?: number;
  
  // Metrics
  metrics?: VlogMetrics;
  
  // AI Generation
  promptTemplateId?: string;
  promptModifiers?: string[];
  
  // Version control
  version: number;
  createdAt: number;
  updatedAt: number;
}

export interface VlogScript {
  introduction: string;
  sections: VlogSection[];
  conclusion: string;
  callToAction: string;
  
  // Timing markers
  timing: ScriptTiming[];
  
  // B-roll suggestions
  bRollSuggestions: string[];
  
  // Graphics/animations needed
  graphics: GraphicSpec[];
}

export interface VlogSection {
  title: string;
  content: string;
  visualNotes: string;
  durationSeconds: number;
}

export interface ScriptTiming {
  timestamp: string;         // "00:00:30"
  event: string;
  notes: string;
}

export interface GraphicSpec {
  type: 'text-overlay' | 'diagram' | 'animation' | 'screenshot';
  description: string;
  timestamp: string;
  duration: number;
}

export interface VlogThumbnail {
  id: string;
  url: string;
  variant: 'main' | 'alternate' | 'platform-specific';
  platform?: VlogPlatform;
}

export interface VlogPublishConfig {
  platform: VlogPlatform;
  enabled: boolean;
  videoId?: string;
  customTitle?: string;
  customDescription?: string;
  visibility: 'public' | 'unlisted' | 'private';
  publishedUrl?: string;
  
  // Platform-specific settings
  settings: Record<string, unknown>;
}

export interface VlogMetrics {
  views: number;
  watchTime: number;         // total seconds
  avgViewDuration: number;
  likes: number;
  comments: number;
  shares: number;
  subscribers: number;       // gained from this video
  clickThroughRate: number;
  retentionRate: number;
}

// ============================================================================
// Landing Page Types
// ============================================================================

export type LandingPageTemplate = 
  | 'hero-features-cta'
  | 'comparison'
  | 'free-tool'
  | 'waitlist'
  | 'exam-specific'
  | 'course-promo'
  | 'testimonials'
  | 'pricing';

export type LandingPageStatus = 'draft' | 'review' | 'active' | 'paused' | 'archived';

export interface LandingPage {
  id: string;
  
  // Basic info
  name: string;
  slug: string;
  template: LandingPageTemplate;
  
  // Content sections
  sections: LandingSection[];
  
  // Targeting
  examTypes: string[];
  campaign?: string;
  
  // SEO
  seo: LandingPageSEO;
  
  // Status
  status: LandingPageStatus;
  
  // A/B Testing
  variants?: LandingPageVariant[];
  activeVariant?: string;
  
  // Deployment
  deploymentMode: 'pilot' | 'full';
  
  // Metrics
  metrics?: LandingPageMetrics;
  
  // Version control
  version: number;
  createdAt: number;
  updatedAt: number;
}

export interface LandingSection {
  id: string;
  type: SectionType;
  order: number;
  content: SectionContent;
  style?: SectionStyle;
  visible: boolean;
}

export type SectionType =
  | 'hero'
  | 'features'
  | 'benefits'
  | 'testimonials'
  | 'pricing'
  | 'faq'
  | 'comparison'
  | 'cta'
  | 'stats'
  | 'video'
  | 'form'
  | 'countdown'
  | 'social-proof';

export interface SectionContent {
  // Hero section
  headline?: string;
  subheadline?: string;
  heroImage?: string;
  heroVideo?: string;
  
  // Features/Benefits
  items?: FeatureItem[];
  
  // Testimonials
  testimonials?: Testimonial[];
  
  // Pricing
  plans?: PricingPlan[];
  
  // FAQ
  faqs?: FAQItem[];
  
  // Comparison
  comparisonTable?: ComparisonTable;
  
  // CTA
  ctaText?: string;
  ctaUrl?: string;
  ctaStyle?: 'primary' | 'secondary' | 'outline';
  
  // Stats
  stats?: StatItem[];
  
  // Form
  formFields?: FormField[];
  submitText?: string;
  
  // Countdown
  countdownTarget?: number;
  countdownLabel?: string;
  
  // Generic
  title?: string;
  description?: string;
  image?: string;
}

export interface SectionStyle {
  backgroundColor?: string;
  textColor?: string;
  padding?: string;
  alignment?: 'left' | 'center' | 'right';
  layout?: string;
}

export interface FeatureItem {
  icon?: string;
  title: string;
  description: string;
  image?: string;
}

export interface Testimonial {
  id: string;
  name: string;
  role?: string;
  avatar?: string;
  quote: string;
  rating?: number;
  exam?: string;
}

export interface PricingPlan {
  id: string;
  name: string;
  price: number;
  period: 'monthly' | 'yearly' | 'lifetime';
  features: string[];
  highlighted?: boolean;
  ctaText: string;
}

export interface FAQItem {
  question: string;
  answer: string;
}

export interface ComparisonTable {
  competitors: string[];
  features: ComparisonFeature[];
}

export interface ComparisonFeature {
  name: string;
  values: Record<string, boolean | string>;
}

export interface StatItem {
  value: string;
  label: string;
  icon?: string;
}

export interface FormField {
  name: string;
  type: 'text' | 'email' | 'phone' | 'select' | 'checkbox';
  label: string;
  placeholder?: string;
  required: boolean;
  options?: string[];
}

export interface LandingPageSEO {
  title: string;
  description: string;
  keywords: string[];
  ogImage?: string;
  noIndex?: boolean;
}

export interface LandingPageVariant {
  id: string;
  name: string;
  changes: Record<string, unknown>;
  weight: number;
  metrics?: LandingPageMetrics;
}

export interface LandingPageMetrics {
  pageViews: number;
  uniqueVisitors: number;
  avgTimeOnPage: number;
  bounceRate: number;
  conversions: number;
  conversionRate: number;
  formSubmissions: number;
  ctaClicks: number;
}

// ============================================================================
// Content Calendar Types
// ============================================================================

export interface ContentCalendar {
  id: string;
  examId: string;
  month: number;
  year: number;
  
  entries: CalendarEntry[];
  
  // Quotas
  blogQuota: number;
  vlogQuota: number;
  socialQuota: number;
  
  // Progress
  blogPublished: number;
  vlogPublished: number;
  socialPublished: number;
}

export interface CalendarEntry {
  id: string;
  contentType: 'blog' | 'vlog' | 'social' | 'email';
  contentId?: string;
  
  scheduledDate: number;
  title: string;
  status: 'planned' | 'in-progress' | 'ready' | 'published';
  
  assignee?: string;
  platform?: string;
}

// ============================================================================
// Layout Types
// ============================================================================

export interface LayoutTemplate {
  id: string;
  name: string;
  type: 'blog' | 'landing' | 'email';
  
  // Structure
  structure: LayoutStructure;
  
  // Styles
  styles: LayoutStyles;
  
  // Customization
  customizable: CustomizableField[];
  
  // Preview
  previewUrl?: string;
  thumbnailUrl?: string;
}

export interface LayoutStructure {
  header: LayoutZone;
  main: LayoutZone[];
  sidebar?: LayoutZone;
  footer: LayoutZone;
}

export interface LayoutZone {
  id: string;
  name: string;
  allowedComponents: string[];
  defaultComponent?: string;
  minComponents?: number;
  maxComponents?: number;
}

export interface LayoutStyles {
  primaryColor: string;
  secondaryColor: string;
  fontFamily: string;
  headingFont: string;
  spacing: 'compact' | 'normal' | 'spacious';
  borderRadius: string;
  shadows: boolean;
}

export interface CustomizableField {
  id: string;
  name: string;
  type: 'color' | 'font' | 'spacing' | 'image' | 'text';
  path: string;
  defaultValue: unknown;
}
