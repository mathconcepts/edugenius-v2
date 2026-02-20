/**
 * opportunityConnections.ts — Post-Scouting Connection Manifest
 *
 * After an opportunity discovery run, this service generates a complete list of
 * API keys, MCP servers, and infra connections required to build and run the exam.
 *
 * Each connection comes with:
 *   - Purpose (why it's needed for this exam)
 *   - Default/best-case value or naming convention
 *   - CEO-overridable priority (critical / recommended / optional)
 *   - Estimated monthly cost
 *   - Quick-start URL
 *
 * Output feeds:
 *   1. OpportunityDiscovery.tsx — "What you'll need" panel after scouting
 *   2. ConnectionRegistry.tsx  — "Apply Opportunity Defaults" pre-fills values
 *   3. .env.production.example — Authoritative reference
 */

export type ExamType = 'JEE' | 'NEET' | 'CBSE' | 'CAT' | 'UPSC' | 'GATE' | 'ICSE' | 'CLAT' | 'NDA' | 'CDS';

export type ConnectionPriority = 'critical' | 'recommended' | 'optional';

export interface RequiredConnection {
  /** Matches an id in ConnectionRegistry REGISTRY */
  connectionId: string;
  name: string;
  category: string;
  priority: ConnectionPriority;
  /** Why it's needed specifically for this exam */
  purpose: string;
  /** Default value or naming convention (pre-fills Connection Registry) */
  defaultValue?: string;
  /** Env var key this maps to */
  envKey: string;
  /** Exam-scoped env var key (e.g. PINECONE_INDEX_JEE) */
  examEnvKey?: string;
  /** Estimated monthly cost in USD */
  estimatedMonthlyCostUSD: number;
  /** Quick-start link */
  docsUrl: string;
  /** Can CEO dismiss this requirement? */
  ceoOverridable: boolean;
  /** True if this var is already configured in the registry */
  alreadyConfigured?: boolean;
}

export interface RequiredLLMSetup {
  task: string;
  provider: string;
  model: string;
  reason: string;
  envKey: string;
  docsUrl: string;
  estimatedMonthlyCostUSD: number;
}

export interface ConnectionManifest {
  exam: string;
  generatedAt: Date;
  launchReadinessScore: number;
  requiredConnections: RequiredConnection[];
  llmSetup: RequiredLLMSetup[];
  estimatedTotalMonthlyCostUSD: number;
  criticalMissing: number;
  recommendedMissing: number;
  /** Summary for CEO */
  executiveSummary: string;
}

// ─── Exam-specific defaults ────────────────────────────────────────────────────

/** Maps exam to its specific needs */
const EXAM_PROFILE: Record<string, {
  needsHighMathVerification: boolean;
  needsBiologyContent: boolean;
  needsCodingContent: boolean;
  expectedStudents: number;
  subjectCount: number;
  estimatedContentPieces: number;
  pricingTier: 'budget' | 'mid' | 'premium';
}> = {
  JEE:  { needsHighMathVerification: true,  needsBiologyContent: false, needsCodingContent: false, expectedStudents: 5000, subjectCount: 3, estimatedContentPieces: 2000, pricingTier: 'premium' },
  NEET: { needsHighMathVerification: true,  needsBiologyContent: true,  needsCodingContent: false, expectedStudents: 4000, subjectCount: 3, estimatedContentPieces: 1800, pricingTier: 'premium' },
  GATE: { needsHighMathVerification: true,  needsBiologyContent: false, needsCodingContent: true,  expectedStudents: 2000, subjectCount: 8, estimatedContentPieces: 2500, pricingTier: 'premium' },
  CAT:  { needsHighMathVerification: false, needsBiologyContent: false, needsCodingContent: false, expectedStudents: 3000, subjectCount: 3, estimatedContentPieces: 1200, pricingTier: 'mid' },
  UPSC: { needsHighMathVerification: false, needsBiologyContent: false, needsCodingContent: false, expectedStudents: 4500, subjectCount: 12, estimatedContentPieces: 5000, pricingTier: 'mid' },
  CBSE: { needsHighMathVerification: true,  needsBiologyContent: true,  needsCodingContent: false, expectedStudents: 6000, subjectCount: 6, estimatedContentPieces: 1500, pricingTier: 'budget' },
  CLAT: { needsHighMathVerification: false, needsBiologyContent: false, needsCodingContent: false, expectedStudents: 1500, subjectCount: 5, estimatedContentPieces: 800, pricingTier: 'mid' },
  NDA:  { needsHighMathVerification: true,  needsBiologyContent: false, needsCodingContent: false, expectedStudents: 1200, subjectCount: 2, estimatedContentPieces: 600, pricingTier: 'budget' },
  CDS:  { needsHighMathVerification: false, needsBiologyContent: false, needsCodingContent: false, expectedStudents: 800,  subjectCount: 3, estimatedContentPieces: 500, pricingTier: 'budget' },
  ICSE: { needsHighMathVerification: true,  needsBiologyContent: true,  needsCodingContent: false, expectedStudents: 2000, subjectCount: 6, estimatedContentPieces: 1000, pricingTier: 'budget' },
};

function getProfile(exam: string) {
  return EXAM_PROFILE[exam.toUpperCase()] ?? EXAM_PROFILE['JEE'];
}

// ─── Manifest generator ───────────────────────────────────────────────────────

/**
 * Generate a complete connection manifest for a given exam opportunity.
 * 
 * @param exam - Exam name (JEE, NEET, GATE, CAT, etc.)
 * @param launchReadinessScore - From OpportunityDiscovery (0-100)
 * @param storedConnections - Current values from ConnectionRegistry localStorage
 */
export function generateConnectionManifest(
  exam: string,
  launchReadinessScore: number,
  storedConnections: Record<string, string> = {},
): ConnectionManifest {
  const examUpper = exam.toUpperCase();
  const profile = getProfile(examUpper);

  const isConfigured = (key: string): boolean => !!storedConnections[key];

  const connections: RequiredConnection[] = [

    // ── AI (Mandatory) ──────────────────────────────────────────────────────
    {
      connectionId: 'gemini',
      name: 'Google Gemini',
      category: 'AI Providers',
      priority: 'critical',
      purpose: `Primary AI brain for all ${examUpper} tutoring sessions, content generation, and adaptive explanations. Without this, all responses are mock.`,
      defaultValue: undefined,
      envKey: 'VITE_GEMINI_API_KEY',
      estimatedMonthlyCostUSD: Math.round(profile.expectedStudents * 0.08),
      docsUrl: 'https://aistudio.google.com/',
      ceoOverridable: false,
      alreadyConfigured: isConfigured('VITE_GEMINI_API_KEY'),
    },
    {
      connectionId: 'learnlm',
      name: 'Google LearnLM',
      category: 'AI Providers',
      priority: 'recommended',
      purpose: `Pedagogically-optimised tutoring for ${examUpper}. LearnLM guides students through reasoning — not just answers. Key differentiator vs Unacademy/PW.`,
      defaultValue: undefined,
      envKey: 'LEARNLM_API_KEY',
      estimatedMonthlyCostUSD: 0, // same key as Gemini
      docsUrl: 'https://ai.google.dev/gemini-api/docs/learnlm',
      ceoOverridable: true,
      alreadyConfigured: isConfigured('LEARNLM_API_KEY'),
    },

    // ── Database (Mandatory) ──────────────────────────────────────────────────
    {
      connectionId: 'supabase',
      name: 'Supabase',
      category: 'Database',
      priority: 'critical',
      purpose: `Stores all ${examUpper} student progress, session history, scores, and subscriptions. Required for any real user data to persist.`,
      defaultValue: undefined,
      envKey: 'VITE_SUPABASE_URL',
      estimatedMonthlyCostUSD: 25,
      docsUrl: 'https://supabase.com/',
      ceoOverridable: false,
      alreadyConfigured: isConfigured('VITE_SUPABASE_URL'),
    },

    // ── Auth ──────────────────────────────────────────────────────────────────
    {
      connectionId: 'jwt',
      name: 'JWT Secret',
      category: 'Authentication',
      priority: 'critical',
      purpose: 'Required for secure student sessions. Without this, no user can authenticate.',
      defaultValue: undefined,
      envKey: 'JWT_SECRET',
      estimatedMonthlyCostUSD: 0,
      docsUrl: 'https://jwt.io/',
      ceoOverridable: false,
      alreadyConfigured: isConfigured('JWT_SECRET'),
    },

    // ── Vector Store (Exam-scoped) ─────────────────────────────────────────────
    {
      connectionId: 'pinecone',
      name: `Pinecone — ${examUpper} Index`,
      category: 'Vector Store',
      priority: 'recommended',
      purpose: `Semantic search over all ${examUpper} content. Sage uses this to find similar past questions, relevant concepts, and previous explanations. Without it, every response starts from scratch.`,
      defaultValue: `edugenius-${examUpper.toLowerCase()}`,
      envKey: 'PINECONE_INDEX',
      examEnvKey: `PINECONE_INDEX_${examUpper}`,
      estimatedMonthlyCostUSD: 20,
      docsUrl: 'https://app.pinecone.io/',
      ceoOverridable: true,
      alreadyConfigured: isConfigured(`PINECONE_INDEX_${examUpper}`) || isConfigured('PINECONE_INDEX'),
    },
    {
      connectionId: 'pinecone',
      name: 'Pinecone API Key',
      category: 'Vector Store',
      priority: 'recommended',
      purpose: 'Shared API key for all exam indexes.',
      defaultValue: undefined,
      envKey: 'PINECONE_API_KEY',
      estimatedMonthlyCostUSD: 0, // included in index cost above
      docsUrl: 'https://app.pinecone.io/',
      ceoOverridable: true,
      alreadyConfigured: isConfigured('PINECONE_API_KEY'),
    },

    // ── Content Verification ───────────────────────────────────────────────────
    ...(profile.needsHighMathVerification ? [{
      connectionId: 'wolfram',
      name: `Wolfram Alpha — ${examUpper}`,
      category: 'Content Verification',
      priority: 'recommended' as ConnectionPriority,
      purpose: `${examUpper} has heavy math/science content. Wolfram cross-checks every LLM solution before showing to students. Without it, math errors reach students undetected.`,
      defaultValue: undefined,
      envKey: 'WOLFRAM_APP_ID',
      examEnvKey: `WOLFRAM_APP_ID_${examUpper}`,
      estimatedMonthlyCostUSD: 20,
      docsUrl: 'https://developer.wolframalpha.com/',
      ceoOverridable: true,
      alreadyConfigured: isConfigured(`WOLFRAM_APP_ID_${examUpper}`) || isConfigured('WOLFRAM_APP_ID'),
    }] : []),

    // ── Payments ──────────────────────────────────────────────────────────────
    {
      connectionId: 'razorpay',
      name: 'Razorpay',
      category: 'Payments',
      priority: 'critical',
      purpose: `Collect subscription revenue from ${examUpper} students. Without this, the platform is free with no monetisation.`,
      defaultValue: undefined,
      envKey: 'RAZORPAY_KEY_ID',
      estimatedMonthlyCostUSD: 0, // Razorpay charges 2% per txn
      docsUrl: 'https://dashboard.razorpay.com/',
      ceoOverridable: false,
      alreadyConfigured: isConfigured('RAZORPAY_KEY_ID'),
    },
    {
      connectionId: 'razorpay',
      name: `Razorpay — ${examUpper} Pro Plan`,
      category: 'Payments',
      priority: 'critical',
      purpose: `Exam-specific subscription plan for ${examUpper} Pro tier. Allows ${examUpper}-specific pricing (different from JEE/NEET plans).`,
      defaultValue: undefined,
      envKey: `RAZORPAY_PLAN_PRO_${examUpper}`,
      examEnvKey: `RAZORPAY_PLAN_PRO_${examUpper}`,
      estimatedMonthlyCostUSD: 0,
      docsUrl: 'https://dashboard.razorpay.com/app/subscriptions/plans',
      ceoOverridable: false,
      alreadyConfigured: isConfigured(`RAZORPAY_PLAN_PRO_${examUpper}`),
    },
    {
      connectionId: 'razorpay',
      name: `Razorpay — ${examUpper} Premium Plan`,
      category: 'Payments',
      priority: 'recommended',
      purpose: `Premium plan for ${examUpper} — higher price point, full features.`,
      defaultValue: undefined,
      envKey: `RAZORPAY_PLAN_PREMIUM_${examUpper}`,
      examEnvKey: `RAZORPAY_PLAN_PREMIUM_${examUpper}`,
      estimatedMonthlyCostUSD: 0,
      docsUrl: 'https://dashboard.razorpay.com/app/subscriptions/plans',
      ceoOverridable: true,
      alreadyConfigured: isConfigured(`RAZORPAY_PLAN_PREMIUM_${examUpper}`),
    },

    // ── Email ──────────────────────────────────────────────────────────────────
    {
      connectionId: 'resend',
      name: 'Resend (Email)',
      category: 'Email',
      priority: 'recommended',
      purpose: `Send ${examUpper} students: OTPs, welcome emails, study reminders, weekly progress. Free tier: 3,000 emails/mo.`,
      defaultValue: undefined,
      envKey: 'RESEND_API_KEY',
      estimatedMonthlyCostUSD: 0,
      docsUrl: 'https://resend.com/',
      ceoOverridable: true,
      alreadyConfigured: isConfigured('RESEND_API_KEY'),
    },

    // ── Chat Channels (exam-scoped) ────────────────────────────────────────────
    {
      connectionId: 'telegram',
      name: `Telegram — @EduGenius${examUpper}Bot`,
      category: 'Chat Channels',
      priority: 'recommended',
      purpose: `Dedicated ${examUpper} Telegram bot. Students ask doubts, get study tips, and access mock tests via chat. Popular with ${examUpper} communities. Suggested bot username: @EduGenius${examUpper}Bot`,
      defaultValue: undefined,
      envKey: 'TELEGRAM_BOT_TOKEN',
      examEnvKey: `TELEGRAM_BOT_TOKEN_${examUpper}`,
      estimatedMonthlyCostUSD: 0,
      docsUrl: 'https://t.me/BotFather',
      ceoOverridable: true,
      alreadyConfigured: isConfigured(`TELEGRAM_BOT_TOKEN_${examUpper}`),
    },

    // ── Analytics (exam-scoped) ────────────────────────────────────────────────
    {
      connectionId: 'ga4',
      name: `GA4 — ${examUpper} Property`,
      category: 'Analytics',
      priority: 'recommended',
      purpose: `Track ${examUpper} student acquisition funnel separately. Without exam-specific GA4, JEE traffic pollutes NEET data — making optimisation impossible.`,
      defaultValue: undefined,
      envKey: 'VITE_GA4_MEASUREMENT_ID',
      examEnvKey: `VITE_GA4_MEASUREMENT_ID_${examUpper}`,
      estimatedMonthlyCostUSD: 0,
      docsUrl: 'https://analytics.google.com/',
      ceoOverridable: true,
      alreadyConfigured: isConfigured(`VITE_GA4_MEASUREMENT_ID_${examUpper}`),
    },

    // ── Storage ────────────────────────────────────────────────────────────────
    {
      connectionId: 's3',
      name: 'Cloudflare R2 / S3',
      category: 'Storage',
      priority: 'recommended',
      purpose: `Store ${examUpper} PDFs, images, and user-uploaded study material. Estimated ${profile.estimatedContentPieces} content pieces at launch.`,
      defaultValue: `edugenius-content`,
      envKey: 'S3_BUCKET',
      estimatedMonthlyCostUSD: 5,
      docsUrl: 'https://www.cloudflare.com/products/r2/',
      ceoOverridable: true,
      alreadyConfigured: isConfigured('S3_BUCKET'),
    },
  ];

  // ── LLM Setup Guide ──────────────────────────────────────────────────────────
  const llmSetup: RequiredLLMSetup[] = [
    {
      task: 'Tutoring (Sage)',
      provider: 'Google LearnLM',
      model: 'learnlm-1.5-pro',
      reason: `Pedagogically-optimised for ${examUpper} — guides students vs. just answering`,
      envKey: 'VITE_GEMINI_API_KEY',
      docsUrl: 'https://aistudio.google.com/',
      estimatedMonthlyCostUSD: Math.round(profile.expectedStudents * 0.08),
    },
    {
      task: 'Hard Problems (JEE Adv / GATE level)',
      provider: 'Google Gemini',
      model: 'gemini-1.5-pro',
      reason: 'Best-in-class multi-step math reasoning, 2M token context',
      envKey: 'VITE_GEMINI_API_KEY',
      docsUrl: 'https://aistudio.google.com/',
      estimatedMonthlyCostUSD: Math.round(profile.expectedStudents * 0.03),
    },
    {
      task: 'Real-time Hints (< 250ms)',
      provider: 'Groq (Llama 3)',
      model: 'llama-3-70b-8192',
      reason: 'Ultra-low latency — 5-10x faster than Gemini for live interactions',
      envKey: 'GROQ_API_KEY',
      docsUrl: 'https://console.groq.com/',
      estimatedMonthlyCostUSD: Math.round(profile.expectedStudents * 0.01),
    },
    {
      task: 'Content Generation (Atlas)',
      provider: 'Google Gemini',
      model: 'gemini-1.5-pro (single) / gemini-2.0-flash (bulk)',
      reason: `Generate ${profile.estimatedContentPieces} ${examUpper} content pieces at launch`,
      envKey: 'VITE_GEMINI_API_KEY',
      docsUrl: 'https://aistudio.google.com/',
      estimatedMonthlyCostUSD: Math.round(profile.estimatedContentPieces * 0.005),
    },
    {
      task: 'Emotionally-Aware Responses',
      provider: 'Anthropic Claude',
      model: 'claude-sonnet-4-20250514',
      reason: 'Best empathy + nuance for students under exam stress',
      envKey: 'VITE_ANTHROPIC_API_KEY',
      docsUrl: 'https://console.anthropic.com/',
      estimatedMonthlyCostUSD: Math.round(profile.expectedStudents * 0.005),
    },
    {
      task: 'Vector Embeddings (RAG)',
      provider: 'OpenAI',
      model: 'text-embedding-3-small',
      reason: `Embed all ${examUpper} content for semantic search — cost: $0.02/1M tokens`,
      envKey: 'VITE_OPENAI_API_KEY',
      docsUrl: 'https://platform.openai.com/',
      estimatedMonthlyCostUSD: Math.round(profile.estimatedContentPieces * 0.002),
    },
  ];

  // ── Cost estimate ─────────────────────────────────────────────────────────────
  const estimatedTotalMonthlyCostUSD = connections.reduce((sum, c) => sum + c.estimatedMonthlyCostUSD, 0)
    + llmSetup.reduce((sum, l) => sum + l.estimatedMonthlyCostUSD, 0);

  const criticalMissing = connections.filter(c => c.priority === 'critical' && !c.alreadyConfigured).length;
  const recommendedMissing = connections.filter(c => c.priority === 'recommended' && !c.alreadyConfigured).length;

  const executiveSummary = [
    `To launch ${examUpper}, you need ${criticalMissing} critical and ${recommendedMissing} recommended connections.`,
    criticalMissing === 0
      ? '✅ All critical connections are configured — you can launch.'
      : `⚠️ ${criticalMissing} critical connection${criticalMissing > 1 ? 's' : ''} missing — configure these before proceeding.`,
    `Estimated infra cost: ~$${estimatedTotalMonthlyCostUSD}/mo for ${profile.expectedStudents.toLocaleString()} students.`,
    profile.needsHighMathVerification
      ? 'Wolfram Alpha strongly recommended for math/science verification accuracy.'
      : '',
    `Exam-scoped keys follow: BASE_VAR_${examUpper} naming convention.`,
  ].filter(Boolean).join(' ');

  return {
    exam: examUpper,
    generatedAt: new Date(),
    launchReadinessScore,
    requiredConnections: connections,
    llmSetup,
    estimatedTotalMonthlyCostUSD,
    criticalMissing,
    recommendedMissing,
    executiveSummary,
  };
}

// ─── Persist manifest to localStorage (ConnectionRegistry reads it) ───────────

const MANIFEST_KEY = 'edugenius_opportunity_manifest';

export function saveConnectionManifest(manifest: ConnectionManifest): void {
  try {
    localStorage.setItem(MANIFEST_KEY, JSON.stringify({
      ...manifest,
      generatedAt: manifest.generatedAt.toISOString(),
    }));
  } catch { /* ignore */ }
}

export function loadConnectionManifest(): ConnectionManifest | null {
  try {
    const raw = localStorage.getItem(MANIFEST_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return { ...parsed, generatedAt: new Date(parsed.generatedAt) };
  } catch { return null; }
}

/** Pre-fill ConnectionRegistry stored values from a manifest's default values */
export function applyManifestDefaults(
  manifest: ConnectionManifest,
  existingStored: Record<string, string>,
): Record<string, string> {
  const updated = { ...existingStored };
  for (const conn of manifest.requiredConnections) {
    const key = conn.examEnvKey ?? conn.envKey;
    if (!updated[key] && conn.defaultValue) {
      updated[key] = conn.defaultValue;
    }
  }
  return updated;
}

// (types already exported inline above)
