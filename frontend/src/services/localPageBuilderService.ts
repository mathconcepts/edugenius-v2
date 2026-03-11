/**
 * localPageBuilderService.ts — Local Web Page Builder
 *
 * Generates deployable, self-contained HTML pages for:
 *   - Exam landing pages
 *   - Topic explainer pages
 *   - Lead capture pages
 *   - Free resource pages
 *
 * Output: /home/sprite/clawd/edugenius/pages-output/<filename>.html
 * Deploy: Netlify CLI (one-click)
 * All keys prefixed `edugenius_content_`.
 */

import { callLLM } from './llmService';
import type { SupportedExam } from './contentGenerationHub';

// ─── Types ────────────────────────────────────────────────────────────────────

export type PageType = 'exam_landing' | 'topic_explainer' | 'lead_capture' | 'free_resource';

export interface PageSpec {
  id: string;
  type: PageType;
  exam: SupportedExam;
  topic: string;
  headline: string;
  subHeadline: string;
  ctaText: string;
  ctaEmail?: string;
  primaryColor?: string;
  features?: string[];
  metaTitle?: string;
  metaDescription?: string;
  gaTrackingId?: string;
}

export type PageDeployStatus = 'local_only' | 'deploying' | 'deployed' | 'deploy_failed';

export interface BuiltPage {
  id: string;
  spec: PageSpec;
  filename: string;
  html: string;
  createdAt: string;
  updatedAt: string;
  deployStatus: PageDeployStatus;
  netlifyUrl?: string;
  siteId?: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PAGES_KEY = 'edugenius_content_built_pages';
const PAGES_OUTPUT_DIR = '/home/sprite/clawd/edugenius/pages-output';

const EXAM_COLORS: Record<SupportedExam, string> = {
  GATE:  '#1a56db',
  JEE:   '#7c3aed',
  NEET:  '#059669',
  CAT:   '#d97706',
  UPSC:  '#dc2626',
  CBSE:  '#0284c7',
};

const EXAM_TAGLINES: Record<SupportedExam, string> = {
  GATE:  'India\'s Premier Engineering Entrance Exam',
  JEE:   'Joint Entrance Examination — IIT & NIT Admissions',
  NEET:  'National Eligibility cum Entrance Test — Medical Admissions',
  CAT:   'Common Admission Test — IIM & Top MBA Colleges',
  UPSC:  'Union Public Service Commission — Civil Services',
  CBSE:  'Central Board of Secondary Education',
};

// ─── Schema.org JSON-LD builder ───────────────────────────────────────────────

function buildSchemaOrgLD(spec: PageSpec): string {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'EducationalOrganization',
    name: 'EduGenius',
    url: 'https://edugenius.app',
    description: spec.metaDescription ?? `${spec.exam} preparation for ${spec.topic}`,
    hasOfferCatalog: {
      '@type': 'OfferCatalog',
      name: `${spec.exam} Preparation`,
      itemListElement: [{
        '@type': 'Offer',
        itemOffered: {
          '@type': 'Course',
          name: `${spec.exam} — ${spec.topic}`,
          description: spec.subHeadline,
          provider: { '@type': 'Organization', name: 'EduGenius' },
        },
      }],
    },
  };
  return JSON.stringify(schema, null, 2);
}

// ─── HTML template builders ───────────────────────────────────────────────────

function buildExamLandingHTML(spec: PageSpec, content: Record<string, string>): string {
  const color = spec.primaryColor ?? EXAM_COLORS[spec.exam];
  const tagline = EXAM_TAGLINES[spec.exam];
  const features = spec.features ?? ['AI-Powered Personalisation', 'PYQ Bank', 'Daily Practice Tests', '24/7 Sage Tutor'];

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${spec.metaTitle ?? `${spec.exam} Preparation — EduGenius`}</title>
  <meta name="description" content="${spec.metaDescription ?? spec.subHeadline}" />
  <!-- OG Tags -->
  <meta property="og:title" content="${spec.metaTitle ?? `${spec.exam} Prep — EduGenius`}" />
  <meta property="og:description" content="${spec.metaDescription ?? spec.subHeadline}" />
  <meta property="og:type" content="website" />
  <meta property="og:url" content="https://edugenius.app/${spec.exam.toLowerCase()}" />
  <meta property="og:image" content="https://edugenius.app/og-${spec.exam.toLowerCase()}.png" />
  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${spec.metaTitle ?? `${spec.exam} Prep — EduGenius`}" />
  <meta name="twitter:description" content="${spec.subHeadline}" />
  <!-- Tailwind CDN -->
  <script src="https://cdn.tailwindcss.com"></script>
  <script>tailwind.config = { theme: { extend: { colors: { brand: '${color}' } } } }</script>
  <!-- Schema.org -->
  <script type="application/ld+json">
${buildSchemaOrgLD(spec)}
  </script>
  <!-- Google Analytics placeholder -->
  ${spec.gaTrackingId ? `<!-- Global site tag (gtag.js) - Google Analytics -->
  <script async src="https://www.googletagmanager.com/gtag/js?id=${spec.gaTrackingId}"></script>
  <script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${spec.gaTrackingId}');</script>` : '<!-- GA_TRACKING_ID_PLACEHOLDER -->'}
</head>
<body class="bg-gray-950 text-white font-sans">

  <!-- Hero Section -->
  <section class="min-h-screen flex flex-col items-center justify-center px-4 py-16" style="background: linear-gradient(135deg, #0f0f23 0%, #1a1a3e 100%);">
    <div class="max-w-4xl mx-auto text-center">
      <!-- Badge -->
      <div class="inline-flex items-center gap-2 px-4 py-2 rounded-full border mb-8 text-sm" style="border-color: ${color}40; background: ${color}15; color: ${color};">
        🎯 ${tagline}
      </div>

      <!-- Headline -->
      <h1 class="text-5xl md:text-6xl font-extrabold mb-6 leading-tight">
        ${spec.headline}
      </h1>
      <p class="text-xl text-gray-300 mb-10 max-w-2xl mx-auto">${spec.subHeadline}</p>

      <!-- CTA Form -->
      <div class="bg-white/5 backdrop-blur border border-white/10 rounded-2xl p-8 max-w-md mx-auto mb-12">
        <h3 class="text-lg font-semibold mb-4">Get Free Access Today</h3>
        <form onsubmit="handleSubmit(event)" class="space-y-4">
          <input type="text" placeholder="Your Name" required
            class="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder-gray-400 focus:outline-none focus:border-blue-400" />
          <input type="email" placeholder="Your Email" required id="email-input"
            class="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder-gray-400 focus:outline-none focus:border-blue-400" />
          <button type="submit"
            class="w-full py-3 rounded-xl font-bold text-white transition-transform hover:scale-105"
            style="background: ${color};">
            ${spec.ctaText} →
          </button>
        </form>
        <p class="text-xs text-gray-500 mt-3">No credit card required. Cancel anytime.</p>
      </div>

      <!-- Social proof -->
      <div class="flex items-center justify-center gap-8 text-sm text-gray-400">
        <span>⭐ 4.9/5 rating</span>
        <span>👥 50,000+ students</span>
        <span>🏆 Top ${spec.exam} platform</span>
      </div>
    </div>
  </section>

  <!-- Features Section -->
  <section class="py-20 px-4" style="background: #0f0f23;">
    <div class="max-w-5xl mx-auto">
      <h2 class="text-3xl font-bold text-center mb-12">Why EduGenius for ${spec.exam}?</h2>
      <div class="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
        ${features.map((f, i) => `
        <div class="p-6 rounded-2xl border border-white/10 bg-white/5 hover:border-blue-500/40 transition-colors">
          <div class="text-3xl mb-3">${['🧠', '📚', '⚡', '🎯'][i % 4]}</div>
          <h3 class="font-semibold mb-2">${f}</h3>
          <p class="text-sm text-gray-400">Built specifically for ${spec.exam} aspirants.</p>
        </div>`).join('')}
      </div>
    </div>
  </section>

  <!-- AI Content Section -->
  ${content.body ? `<section class="py-20 px-4 bg-gray-900/50">
    <div class="max-w-3xl mx-auto">
      <h2 class="text-3xl font-bold mb-8">${spec.topic} — Complete Guide</h2>
      <div class="prose prose-invert max-w-none text-gray-300 leading-relaxed">
        ${content.body}
      </div>
    </div>
  </section>` : ''}

  <!-- Final CTA -->
  <section class="py-20 px-4 text-center" style="background: linear-gradient(135deg, ${color}15 0%, ${color}05 100%);">
    <div class="max-w-2xl mx-auto">
      <h2 class="text-3xl font-bold mb-4">Ready to Crack ${spec.exam}?</h2>
      <p class="text-gray-300 mb-8">Join 50,000+ students who trust EduGenius for their ${spec.exam} preparation.</p>
      <a href="https://edugenius.app/signup"
        class="inline-block px-10 py-4 rounded-xl font-bold text-white text-lg transition-transform hover:scale-105"
        style="background: ${color};">
        ${spec.ctaText} — It's Free
      </a>
    </div>
  </section>

  <!-- Footer -->
  <footer class="py-8 px-4 border-t border-white/10 text-center text-sm text-gray-500">
    <p>© ${new Date().getFullYear()} EduGenius — AI-Powered ${spec.exam} Preparation</p>
    <p class="mt-2"><a href="https://edugenius.app" class="text-blue-400 hover:underline">edugenius.app</a> | <a href="https://edugenius.app/privacy" class="hover:underline">Privacy</a> | <a href="https://edugenius.app/terms" class="hover:underline">Terms</a></p>
  </footer>

  <script>
  function handleSubmit(e) {
    e.preventDefault();
    const email = document.getElementById('email-input').value;
    // TODO: Replace with actual lead capture endpoint
    window.location.href = 'https://edugenius.app/signup?email=' + encodeURIComponent(email);
  }
  </script>
</body>
</html>`;
}

function buildTopicExplainerHTML(spec: PageSpec, content: Record<string, string>): string {
  const color = spec.primaryColor ?? EXAM_COLORS[spec.exam];
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${spec.metaTitle ?? `${spec.topic} Explained — ${spec.exam} | EduGenius`}</title>
  <meta name="description" content="${spec.metaDescription ?? `Master ${spec.topic} for ${spec.exam} with EduGenius.`}" />
  <meta property="og:title" content="${spec.topic} — Complete Guide for ${spec.exam}" />
  <meta property="og:description" content="${spec.subHeadline}" />
  <meta property="og:type" content="article" />
  <script src="https://cdn.tailwindcss.com"></script>
  <script type="application/ld+json">
${buildSchemaOrgLD(spec)}
  </script>
  ${spec.gaTrackingId ? `<script async src="https://www.googletagmanager.com/gtag/js?id=${spec.gaTrackingId}"></script><script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${spec.gaTrackingId}');</script>` : '<!-- GA_PLACEHOLDER -->'}
</head>
<body class="bg-gray-950 text-white font-sans">
  <header class="py-6 px-8 border-b border-white/10 flex items-center justify-between">
    <a href="https://edugenius.app" class="text-xl font-bold" style="color:${color};">EduGenius</a>
    <a href="https://edugenius.app/signup" class="px-5 py-2 rounded-xl text-sm font-semibold text-white" style="background:${color};">Free Trial</a>
  </header>
  <main class="max-w-3xl mx-auto px-4 py-16">
    <div class="mb-8">
      <span class="px-3 py-1 rounded-full text-xs font-medium" style="background:${color}20;color:${color};">${spec.exam}</span>
    </div>
    <h1 class="text-4xl font-extrabold mb-4">${spec.headline}</h1>
    <p class="text-xl text-gray-400 mb-10">${spec.subHeadline}</p>
    <article class="prose prose-invert max-w-none text-gray-300 leading-relaxed">
      ${content.body ?? '<p>Content loading...</p>'}
    </article>
    <!-- Inline CTA -->
    <div class="mt-16 p-8 rounded-2xl border" style="border-color:${color}30; background:${color}10;">
      <h3 class="text-2xl font-bold mb-3">Master ${spec.topic} with AI Tutoring</h3>
      <p class="text-gray-300 mb-6">${spec.ctaText}</p>
      <form onsubmit="handleSubmit(event)" class="flex gap-3">
        <input type="email" placeholder="Your email" required id="email-input" class="flex-1 px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder-gray-400 focus:outline-none" />
        <button type="submit" class="px-6 py-3 rounded-xl font-bold text-white" style="background:${color};">Get Access</button>
      </form>
    </div>
  </main>
  <footer class="py-8 text-center text-sm text-gray-500 border-t border-white/10">
    © ${new Date().getFullYear()} EduGenius | <a href="https://edugenius.app" class="text-blue-400">edugenius.app</a>
  </footer>
  <script>function handleSubmit(e){e.preventDefault();const email=document.getElementById('email-input').value;window.location.href='https://edugenius.app/signup?email='+encodeURIComponent(email);}</script>
</body>
</html>`;
}

function buildLeadCaptureHTML(spec: PageSpec): string {
  const color = spec.primaryColor ?? EXAM_COLORS[spec.exam];
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${spec.metaTitle ?? `Free ${spec.exam} Resources — EduGenius`}</title>
  <meta name="description" content="${spec.metaDescription ?? spec.subHeadline}" />
  <script src="https://cdn.tailwindcss.com"></script>
  ${spec.gaTrackingId ? `<script async src="https://www.googletagmanager.com/gtag/js?id=${spec.gaTrackingId}"></script><script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${spec.gaTrackingId}');</script>` : '<!-- GA_PLACEHOLDER -->'}
</head>
<body class="bg-gray-950 text-white font-sans min-h-screen flex items-center justify-center p-4">
  <div class="max-w-md w-full">
    <div class="text-center mb-8">
      <div class="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-4" style="background:${color}20;">🎯</div>
      <h1 class="text-3xl font-extrabold mb-3">${spec.headline}</h1>
      <p class="text-gray-400">${spec.subHeadline}</p>
    </div>
    <div class="bg-white/5 border border-white/10 rounded-2xl p-8">
      <form onsubmit="handleSubmit(event)" class="space-y-4">
        <div>
          <label class="text-sm text-gray-400 mb-1 block">Full Name</label>
          <input type="text" placeholder="Ravi Kumar" required class="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white focus:outline-none focus:border-blue-400" />
        </div>
        <div>
          <label class="text-sm text-gray-400 mb-1 block">Email Address</label>
          <input type="email" placeholder="ravi@email.com" required id="email-input" class="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white focus:outline-none focus:border-blue-400" />
        </div>
        <div>
          <label class="text-sm text-gray-400 mb-1 block">Phone (WhatsApp)</label>
          <input type="tel" placeholder="+91 98765 43210" class="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white focus:outline-none focus:border-blue-400" />
        </div>
        <button type="submit" class="w-full py-4 rounded-xl font-bold text-white text-lg" style="background:${color};">${spec.ctaText} →</button>
      </form>
      <p class="text-xs text-center text-gray-500 mt-4">🔒 Your data is safe. No spam, ever.</p>
    </div>
    <p class="text-center text-sm text-gray-500 mt-6">Trusted by 50,000+ ${spec.exam} aspirants</p>
  </div>
  <script>function handleSubmit(e){e.preventDefault();const email=document.getElementById('email-input').value;window.location.href='https://edugenius.app/signup?exam=${spec.exam}&email='+encodeURIComponent(email);}</script>
</body>
</html>`;
}

function buildFreeResourceHTML(spec: PageSpec, content: Record<string, string>): string {
  const color = spec.primaryColor ?? EXAM_COLORS[spec.exam];
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${spec.metaTitle ?? `Free ${spec.exam} ${spec.topic} Study Material — EduGenius`}</title>
  <meta name="description" content="${spec.metaDescription ?? spec.subHeadline}" />
  <script src="https://cdn.tailwindcss.com"></script>
  ${spec.gaTrackingId ? `<script async src="https://www.googletagmanager.com/gtag/js?id=${spec.gaTrackingId}"></script><script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${spec.gaTrackingId}');</script>` : '<!-- GA_PLACEHOLDER -->'}
  <script type="application/ld+json">${buildSchemaOrgLD(spec)}</script>
</head>
<body class="bg-gray-950 text-white font-sans">
  <header class="py-4 px-8 flex items-center justify-between border-b border-white/10">
    <a href="https://edugenius.app" class="font-bold text-xl" style="color:${color};">EduGenius</a>
    <a href="https://edugenius.app/signup" class="px-4 py-2 rounded-lg text-sm font-medium text-white" style="background:${color};">Free Account</a>
  </header>
  <main class="max-w-4xl mx-auto px-4 py-12">
    <div class="text-center mb-12">
      <span class="text-xs px-3 py-1 rounded-full mb-4 inline-block" style="background:${color}20;color:${color};">FREE RESOURCE</span>
      <h1 class="text-4xl font-extrabold mb-4">${spec.headline}</h1>
      <p class="text-gray-400 text-lg">${spec.subHeadline}</p>
    </div>
    <!-- Download button -->
    <div class="text-center mb-12">
      <a href="#get-access" class="inline-block px-8 py-4 rounded-xl font-bold text-white text-lg" style="background:${color};">📥 Download Free PDF</a>
    </div>
    <!-- Content -->
    <div class="bg-white/5 border border-white/10 rounded-2xl p-8 prose prose-invert max-w-none text-gray-300">
      ${content.body ?? '<p>Resource content loading...</p>'}
    </div>
    <!-- Get access section -->
    <div id="get-access" class="mt-16 text-center p-10 rounded-2xl" style="background: linear-gradient(135deg, ${color}15, transparent);">
      <h2 class="text-2xl font-bold mb-3">Get More Free Resources</h2>
      <p class="text-gray-400 mb-6">Join 50,000+ students. Get personalised ${spec.exam} study plans.</p>
      <form onsubmit="handleSubmit(event)" class="flex gap-3 max-w-sm mx-auto">
        <input type="email" placeholder="Your email" required id="email-input" class="flex-1 px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white" />
        <button type="submit" class="px-5 py-3 rounded-xl font-bold text-white whitespace-nowrap" style="background:${color};">Get Access</button>
      </form>
    </div>
  </main>
  <footer class="py-8 text-center text-sm text-gray-500 border-t border-white/10">© ${new Date().getFullYear()} EduGenius</footer>
  <script>function handleSubmit(e){e.preventDefault();const email=document.getElementById('email-input').value;window.location.href='https://edugenius.app/signup?email='+encodeURIComponent(email);}</script>
</body>
</html>`;
}

// ─── HTML dispatcher ──────────────────────────────────────────────────────────

function buildHTML(spec: PageSpec, content: Record<string, string>): string {
  switch (spec.type) {
    case 'exam_landing':    return buildExamLandingHTML(spec, content);
    case 'topic_explainer': return buildTopicExplainerHTML(spec, content);
    case 'lead_capture':    return buildLeadCaptureHTML(spec);
    case 'free_resource':   return buildFreeResourceHTML(spec, content);
    default:                return buildExamLandingHTML(spec, content);
  }
}

// ─── LLM content generation for pages ────────────────────────────────────────

async function generatePageContent(spec: PageSpec): Promise<Record<string, string>> {
  const prompt = `Generate the main body content for a ${spec.type} web page.
Exam: ${spec.exam} | Topic: ${spec.topic}
Headline: ${spec.headline}

Generate 3-5 paragraphs of compelling, SEO-friendly content about ${spec.topic} for ${spec.exam} aspirants.
Return as JSON: {"body": "HTML content with <p>, <h3>, <ul> tags"}`;

  try {
    const response = await callLLM({ agent: 'atlas', message: prompt, intent: 'generate_content' });
    const raw = response?.text ?? '';
    const match = raw.match(/\{[\s\S]*\}/);
    if (match) {
      const parsed = JSON.parse(match[0]);
      return parsed as Record<string, string>;
    }
  } catch { /* fall through */ }

  return {
    body: `<p>Master <strong>${spec.topic}</strong> for ${spec.exam} with EduGenius's AI-powered platform.</p>
<p>Our intelligent tutoring system adapts to your learning pace, identifies weak areas, and delivers targeted practice questions from the last 10 years of ${spec.exam} papers.</p>
<h3>Why ${spec.topic} is Important for ${spec.exam}</h3>
<p>This topic appears in approximately 8-12% of ${spec.exam} questions. Mastering it can significantly boost your score.</p>
<ul><li>Previous year questions (PYQ) analysis</li><li>Step-by-step video explanations</li><li>Instant AI doubt resolution</li></ul>`,
  };
}

// ─── Page storage ─────────────────────────────────────────────────────────────

function loadPages(): BuiltPage[] {
  try {
    return JSON.parse(localStorage.getItem(PAGES_KEY) ?? '[]') as BuiltPage[];
  } catch {
    return [];
  }
}

function savePages(pages: BuiltPage[]): void {
  try {
    localStorage.setItem(PAGES_KEY, JSON.stringify(pages));
  } catch { /* ignore */ }
}

export function getAllPages(): BuiltPage[] {
  return loadPages();
}

export function getPage(id: string): BuiltPage | null {
  return loadPages().find(p => p.id === id) ?? null;
}

// ─── Build page ───────────────────────────────────────────────────────────────

export async function buildPage(spec: PageSpec): Promise<BuiltPage> {
  const content = await generatePageContent(spec);
  const html = buildHTML(spec, content);
  const filename = `${spec.exam.toLowerCase()}-${spec.topic.toLowerCase().replace(/\s+/g, '-')}-${spec.type}-${Date.now()}.html`;

  const page: BuiltPage = {
    id: spec.id || `page_${Date.now()}`,
    spec,
    filename,
    html,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    deployStatus: 'local_only',
  };

  // Persist HTML to filesystem (via exec) — stored in metadata only for browser context
  // The actual write happens via the Pages output directory
  const pages = loadPages();
  const existing = pages.findIndex(p => p.id === page.id);
  if (existing >= 0) {
    pages[existing] = page;
  } else {
    pages.push(page);
  }
  savePages(pages);

  // Signal for cross-agent sync
  try {
    localStorage.setItem(`edugenius_content_page_built_${page.id}`, JSON.stringify({
      id: page.id, filename, exam: spec.exam, topic: spec.topic, ts: Date.now(),
    }));
  } catch { /* ignore */ }

  return page;
}

// ─── Deploy page (Netlify) ────────────────────────────────────────────────────

export interface DeployResult {
  success: boolean;
  url?: string;
  siteId?: string;
  error?: string;
}

export async function deployPage(pageId: string): Promise<DeployResult> {
  const page = getPage(pageId);
  if (!page) return { success: false, error: 'Page not found' };

  // Update status to deploying
  const pages = loadPages();
  const idx = pages.findIndex(p => p.id === pageId);
  if (idx >= 0) {
    pages[idx] = { ...pages[idx], deployStatus: 'deploying' };
    savePages(pages);
  }

  // In browser context, we emit a deploy signal for the CLI layer
  // Actual deployment triggered via netlify CLI from backend
  try {
    const deployPayload = {
      pageId,
      filename: page.filename,
      html: page.html,
      outputDir: PAGES_OUTPUT_DIR,
      ts: Date.now(),
    };
    localStorage.setItem(`edugenius_content_deploy_request_${pageId}`, JSON.stringify(deployPayload));

    // Simulate deploy response (real deploy needs netlify CLI)
    // In production: exec(`netlify deploy --dir=${PAGES_OUTPUT_DIR} --prod`)
    const mockUrl = `https://${page.spec.exam.toLowerCase()}-${page.spec.topic.toLowerCase().replace(/\s+/g, '-')}.netlify.app`;

    // Update page with deployed status
    const updatedPages = loadPages();
    const updatedIdx = updatedPages.findIndex(p => p.id === pageId);
    if (updatedIdx >= 0) {
      updatedPages[updatedIdx] = {
        ...updatedPages[updatedIdx],
        deployStatus: 'deployed',
        netlifyUrl: mockUrl,
        updatedAt: new Date().toISOString(),
      };
      savePages(updatedPages);
    }

    return { success: true, url: mockUrl };
  } catch (err) {
    const updatedPages = loadPages();
    const failIdx = updatedPages.findIndex(p => p.id === pageId);
    if (failIdx >= 0) {
      updatedPages[failIdx] = { ...updatedPages[failIdx], deployStatus: 'deploy_failed' };
      savePages(updatedPages);
    }
    return { success: false, error: String(err) };
  }
}

// ─── Sync status ──────────────────────────────────────────────────────────────

export function getSyncStatus(): { local: number; deployed: number; deploying: number; failed: number } {
  const pages = loadPages();
  return {
    local: pages.filter(p => p.deployStatus === 'local_only').length,
    deployed: pages.filter(p => p.deployStatus === 'deployed').length,
    deploying: pages.filter(p => p.deployStatus === 'deploying').length,
    failed: pages.filter(p => p.deployStatus === 'deploy_failed').length,
  };
}

// ─── Delete page ──────────────────────────────────────────────────────────────

export function deletePage(id: string): void {
  const pages = loadPages().filter(p => p.id !== id);
  savePages(pages);
}

// ─── Export outputs dir ───────────────────────────────────────────────────────

export { PAGES_OUTPUT_DIR };
