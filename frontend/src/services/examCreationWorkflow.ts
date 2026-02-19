/**
 * examCreationWorkflow.ts
 *
 * Deep multi-agent workflow for CEO Exam Creation.
 *
 * Full pipeline:
 *   Phase 0: CEO Intent Capture (exam name, target audience, pilot vs full)
 *   Phase 1: Market Research & Viability (Scout + Oracle)
 *   Phase 2: Competitive Intelligence (Scout sub-agents)
 *   Phase 3: Content Architecture (Scout → Atlas)
 *   Phase 4: Source Ingestion (PDF / Wolfram / Web scrape / PYQ DB)
 *   Phase 5: Content Generation (Atlas multi-source synthesis)
 *   Phase 6: Accuracy Verification (Sage + Wolfram + SymPy)
 *   Phase 7: SEO & Marketing Prep (Herald + Scout)
 *   Phase 8: Infrastructure Setup (Forge)
 *   Phase 9: Analytics & Tracking (Oracle)
 *   Phase 10: Launch & Monitor (All agents)
 *
 * Edge cases covered:
 *   - CEO aborts mid-pipeline (checkpoint saves)
 *   - Wolfram unavailable → SymPy → LLM consensus fallback chain
 *   - PDF parse fails → OCR fallback → manual upload prompt
 *   - Market research returns low viability → CEO decision gate
 *   - Competitor already dominates → blue-ocean suggestion branch
 *   - PYQ database empty → web scrape NTA/CBSE official sources
 *   - Parallel execution: PDF ingestion || Web research (independent)
 *   - Content quality below threshold → re-generate with higher params
 *   - Deploy fails → rollback + Forge alert
 */

export type ExamCreationAgentId =
  | 'scout' | 'atlas' | 'sage' | 'mentor' | 'herald' | 'forge' | 'oracle';

export type StepCategory =
  | 'research'     // Market, competitor, demand analysis
  | 'ingestion'    // PDF, web scrape, API data pull
  | 'generation'   // Content creation, synthesis
  | 'verification' // Wolfram, SymPy, LLM fact-check
  | 'marketing'    // SEO, campaign prep
  | 'deployment'   // Infrastructure, CDN
  | 'analytics'    // Tracking, dashboards
  | 'decision';    // CEO gate — requires human approval

export type StepExecution = 'sequential' | 'parallel' | 'conditional';

export interface ExamCreationStep {
  id: string;
  phase: number;
  phaseLabel: string;
  agentId: ExamCreationAgentId;
  agentName: string;
  agentEmoji: string;
  action: string;
  category: StepCategory;
  execution: StepExecution;
  /** If parallel, list of step IDs that run alongside this one */
  parallelWith?: string[];
  /** If conditional, condition description */
  condition?: string;
  inputFrom?: string[];
  outputTo?: string[];
  estimatedMs: number;
  description: string;
  subAgentsInvolved: string[];
  connectionsRequired: string[];
  fallbackChain?: string[];
  /** If this step is a decision gate, CEO must approve before proceeding */
  requiresCEOApproval?: boolean;
  sampleOutput: (inputs: Record<string, unknown>, prevOutputs: Record<string, string>) => string;
}

// ─────────────────────────────────────────────────────────────────────────────
// All 27 steps across 10 phases
// ─────────────────────────────────────────────────────────────────────────────

export const EXAM_CREATION_STEPS: ExamCreationStep[] = [

  // ═══════════════════════════════════════════════════════════════════════════
  // PHASE 1 — MARKET RESEARCH & VIABILITY
  // ═══════════════════════════════════════════════════════════════════════════

  {
    id: 'demand_analysis',
    phase: 1, phaseLabel: 'Market Research',
    agentId: 'scout', agentName: 'Scout', agentEmoji: '🔍',
    action: 'Demand & Trend Analysis',
    category: 'research', execution: 'parallel', parallelWith: ['competitor_deep_dive'],
    inputFrom: [], outputTo: ['viability_gate'],
    estimatedMs: 4500,
    description: 'Scout scans Google Trends, Brave Search, Reddit, YouTube, and Telegram groups to quantify real demand for this exam. Measures search volume, subreddit activity, YouTube view trends, and WhatsApp group sizes.',
    subAgentsInvolved: ['TrendSpotter', 'KeywordHunter', 'SentimentScanner'],
    connectionsRequired: ['Brave Search API', 'Google Trends (scrape)'],
    fallbackChain: ['Google Trends scrape', 'Reddit API', 'manual estimate'],
    sampleOutput: (inputs) => {
      const exam = (inputs.examName as string) || 'JEE Main';
      return `✅ Demand Analysis — ${exam}\n\n📊 Search Volume\n• Primary keyword: "${exam} preparation" — 48,200/mo\n• Long-tail: "${exam} 2026 mock test" — 12,400/mo (+31% YoY)\n• "${exam} PYQ with solutions" — 9,800/mo (KD: 28 — easy win)\n\n📈 Trend Signal\n• Google Trends: 🔥 Trending UP +22% vs same month last year\n• YouTube: 3.2M views/mo on ${exam} content — rising\n• Reddit r/JEEPreparation: 94K members, 840 posts/week\n• Telegram groups: 12 found, avg 4,200 members each\n\n🎯 Demand Score: 87/100 (Strong — recommend PROCEED)\n• Aspirant pool: ~880,000 active in India\n• Peak preparation window: Oct–Mar (6 months)\n• Underserved formats: Daily adaptive mock + AI explanations`;
    },
  },

  {
    id: 'competitor_deep_dive',
    phase: 1, phaseLabel: 'Market Research',
    agentId: 'scout', agentName: 'Scout', agentEmoji: '🔍',
    action: 'Competitor Deep Dive',
    category: 'research', execution: 'parallel', parallelWith: ['demand_analysis'],
    inputFrom: [], outputTo: ['viability_gate'],
    estimatedMs: 5000,
    description: 'Scout maps every major competitor: Unacademy, BYJU\'S, PW, Vedantu, Embibe, Allen. Extracts their pricing, feature set, content depth, UX gaps, and student complaints from Play Store reviews and Reddit threads.',
    subAgentsInvolved: ['CompetitorTracker', 'SentimentScanner', 'KeywordHunter'],
    connectionsRequired: ['Brave Search API', 'Play Store scrape'],
    fallbackChain: ['Manual competitor audit', 'LLM-based analysis from known data'],
    sampleOutput: (inputs) => {
      const exam = (inputs.examName as string) || 'JEE Main';
      return `✅ Competitor Map — ${exam}\n\n🏆 Top 5 Competitors\n1. Unacademy — ₹8,999/yr | Content: Rich | AI: Basic | Gap: No adaptive difficulty\n2. BYJU's — ₹18,000/yr | Content: Rich | AI: Weak | Gap: Poor UX, expensive\n3. Physics Wallah — ₹999/yr | Content: Good | AI: None | Gap: No personalisation\n4. Embibe — ₹4,999/yr | Content: Good | AI: Strong | Gap: No vernacular\n5. Allen Online — ₹6,500/yr | Content: Very Rich | AI: None | Gap: No AI tutor\n\n💡 Blue Ocean Opportunities\n• AI Socratic tutor (none offer this properly)\n• Vernacular + Hinglish explanations (ignored by all)\n• Sub-₹2,000/yr with AI = 10x value gap\n• Daily adaptive mocks with Wolfram-verified solutions\n\n⚔️ Competitive Score vs EduGenius: 7.2/10 (favourable entry conditions)`;
    },
  },

  {
    id: 'audience_profiling',
    phase: 1, phaseLabel: 'Market Research',
    agentId: 'scout', agentName: 'Scout', agentEmoji: '🔍',
    action: 'Audience Segmentation & ICP',
    category: 'research', execution: 'sequential',
    inputFrom: ['demand_analysis', 'competitor_deep_dive'], outputTo: ['viability_gate'],
    estimatedMs: 3000,
    description: 'Synthesises demand + competitor data to build the Ideal Customer Profile (ICP): geography (Tier 1/2/3 cities), grade, income bracket, device usage, channel preferences, parental involvement level.',
    subAgentsInvolved: ['SentimentScanner', 'TrendSpotter'],
    connectionsRequired: ['Brave Search API'],
    fallbackChain: ['LLM-generated ICP from known exam context'],
    sampleOutput: (inputs) => {
      const exam = (inputs.examName as string) || 'JEE Main';
      return `✅ Audience Profile — ${exam}\n\n🎯 Primary ICP\n• Age: 16–18 | Class 11–12 | Gender: 65% male, 35% female\n• City tier: Tier 2–3 cities (68% of aspirants underserved)\n• Income: ₹4–12L/yr household (mid-range, price-sensitive)\n• Device: Mobile-first (82% Android)\n• Preferred channel: WhatsApp > Telegram > Email\n• Parental involvement: High (70% parents monitor progress)\n• Study time: 6–8 hours/day, peak 10pm–1am\n\n📍 Top Districts: Kota, Patna, Hyderabad, Lucknow, Indore\n• Drop: Urban metros (well-served), rural (connectivity gap)\n\n💡 Positioning: "AI-powered JEE prep at PW price, BYJU quality" resonates best`;
    },
  },

  {
    id: 'viability_gate',
    phase: 1, phaseLabel: 'Market Research',
    agentId: 'oracle', agentName: 'Oracle', agentEmoji: '📊',
    action: 'Viability Score & CEO Decision Gate',
    category: 'decision', execution: 'sequential',
    requiresCEOApproval: true,
    inputFrom: ['demand_analysis', 'competitor_deep_dive', 'audience_profiling'], outputTo: ['pyq_ingestion', 'pdf_ingestion', 'web_scrape_ingestion'],
    estimatedMs: 2000,
    description: 'Oracle synthesises all Phase 1 data into a single Viability Score (0–100) with a go/no-go recommendation. CEO reviews and approves before content investment begins. If score < 50, Oracle surfaces blue-ocean alternatives.',
    subAgentsInvolved: ['FunnelAnalyzer', 'ReportGenerator'],
    connectionsRequired: [],
    fallbackChain: [],
    sampleOutput: (inputs) => {
      const exam = (inputs.examName as string) || 'JEE Main';
      return `✅ Viability Report — ${exam}\n\n🎯 OVERALL VIABILITY SCORE: 84/100 — STRONG GO ✅\n\n📊 Score Breakdown\n• Demand strength:       87/100 🟢\n• Competitive advantage:  81/100 🟢\n• ICP clarity:            89/100 🟢\n• Revenue potential:      78/100 🟡\n• Time to market:         82/100 🟢\n\n💰 Revenue Projection (12 months)\n• Conservative: ₹18L (600 users × ₹3,000 avg)\n• Realistic:    ₹45L (1,500 users × ₹3,000 avg)\n• Optimistic:   ₹1.2Cr (4,000 users × ₹3,000 avg)\n\n⚠️ Risk Flags\n• Kota coaching market is offline-dominant (price war risk)\n• PW launched free JEE content last month (watch)\n\n👔 CEO Action Required: Approve to proceed to content phase`;
    },
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // PHASE 2 — SOURCE INGESTION (parallel: PDF + Web + PYQ)
  // ═══════════════════════════════════════════════════════════════════════════

  {
    id: 'pdf_ingestion',
    phase: 2, phaseLabel: 'Source Ingestion',
    agentId: 'atlas', agentName: 'Atlas', agentEmoji: '📚',
    action: 'PDF / Document Ingestion & Parsing',
    category: 'ingestion', execution: 'parallel', parallelWith: ['web_scrape_ingestion', 'pyq_ingestion'],
    inputFrom: ['viability_gate'], outputTo: ['content_architecture'],
    estimatedMs: 6000,
    description: 'CEO uploads PDFs (textbooks, NCERT chapters, reference books, previous year papers, institutional study material). Atlas extracts text via PDF parser, falls back to OCR for scanned docs, chunks into sections, embeds into vector store for RAG-based content generation.',
    subAgentsInvolved: ['Curator', 'FactChecker'],
    connectionsRequired: ['PDF Parser (pdf-parse)', 'OCR (Tesseract fallback)', 'Vector Store (Pinecone/pgvector)'],
    fallbackChain: ['OCR via Tesseract', 'Manual text entry', 'LLM-based reconstruction from known NCERT context'],
    sampleOutput: (inputs) => {
      const exam = (inputs.examName as string) || 'JEE Main';
      return `✅ PDF Ingestion Complete — ${exam}\n\n📄 Documents Processed\n• NCERT Physics Part 1 & 2 — 426 pages ✓\n• NCERT Chemistry Part 1 & 2 — 398 pages ✓\n• NCERT Mathematics (Class 11 & 12) — 712 pages ✓\n• JEE Main 2024 Official Paper (PDF) — 36 pages ✓\n• DC Pandey Mechanics.pdf — 280 pages ✓\n\n🔢 Extraction Stats\n• Chunks created: 4,218 semantic chunks\n• Math expressions extracted: 2,340 (LaTeX formatted)\n• Diagrams detected: 187 (flagged for human review)\n• OCR fallback used: 2 scanned docs (quality: 94%)\n• Vector embeddings: 4,218 stored in pgvector\n\n💡 Rich context ready for Atlas content generation`;
    },
  },

  {
    id: 'web_scrape_ingestion',
    phase: 2, phaseLabel: 'Source Ingestion',
    agentId: 'scout', agentName: 'Scout', agentEmoji: '🔍',
    action: 'Web Scrape — Official Sources',
    category: 'ingestion', execution: 'parallel', parallelWith: ['pdf_ingestion', 'pyq_ingestion'],
    inputFrom: ['viability_gate'], outputTo: ['content_architecture'],
    estimatedMs: 5000,
    description: 'Scout scrapes official authoritative sources: NTA website (latest syllabus, cut-offs, exam dates), CBSE academic portal, exam notification PDFs. Also scrapes Wolfram MathWorld for formula references and Khan Academy for concept explanations (for comparison, not copying).',
    subAgentsInvolved: ['TrendSpotter', 'ExamMonitor', 'CompetitorTracker'],
    connectionsRequired: ['Brave Search API', 'Cheerio/Playwright scraper', 'NTA official website'],
    fallbackChain: ['Cached syllabus from last scrape', 'LLM-known syllabus', 'Manual CEO input'],
    sampleOutput: (inputs) => {
      const exam = (inputs.examName as string) || 'JEE Main';
      return `✅ Web Scrape Complete — ${exam}\n\n🌐 Sources Scraped\n• nta.ac.in — Latest ${exam} 2026 syllabus ✓ (updated 3 weeks ago)\n• jeemain.nta.nic.in — Exam dates, session schedule ✓\n• cbseacademic.nic.in — NCERT chapter mapping ✓\n• jeemain.nta.ac.in/webinfo/Public/Home.aspx — Cut-offs 2025 ✓\n• WolframMathWorld — 48 formulas cross-referenced ✓\n\n📋 Syllabus Delta (vs our current content)\n• 3 new topics added to ${exam} 2026 syllabus\n• 1 topic removed (Electromagnetic Waves - reduced)\n• Weightage changes: Organic Chemistry +5%, Mechanics -3%\n\n⚠️ Alert: ${exam} 2026 session 1 date: Jan 22–31, 2026 (adjust countdown timers)`;
    },
  },

  {
    id: 'pyq_ingestion',
    phase: 2, phaseLabel: 'Source Ingestion',
    agentId: 'atlas', agentName: 'Atlas', agentEmoji: '📚',
    action: 'PYQ Database Build (Previous Year Questions)',
    category: 'ingestion', execution: 'parallel', parallelWith: ['pdf_ingestion', 'web_scrape_ingestion'],
    inputFrom: ['viability_gate'], outputTo: ['content_architecture'],
    estimatedMs: 7000,
    description: 'Atlas mines PYQ databases: extracts questions from uploaded PDFs, scrapes NTA question bank (via Brave Search + official PDFs), categorises by chapter/topic/difficulty, deduplicates, and tags with answer + explanation source. Builds the PYQ index that powers mock tests and spaced repetition.',
    subAgentsInvolved: ['QuizMaster', 'FactChecker', 'Curator'],
    connectionsRequired: ['PDF Parser', 'Wolfram Alpha (answer verification)', 'Vector Store'],
    fallbackChain: ['Scout web scrape of PYQ discussion threads', 'LLM generation tagged as "practice" not "actual PYQ"'],
    sampleOutput: (inputs) => {
      const exam = (inputs.examName as string) || 'JEE Main';
      return `✅ PYQ Database — ${exam}\n\n📚 Questions Ingested\n• ${exam} 2015–2025: 4,280 questions extracted\n• Unique after dedup: 3,840 questions\n• Verified correct answers: 3,612 (94%) ✓\n• Wolfram-verified math: 1,240/1,240 ✓\n• Flagged for manual review: 228 (disputed answers)\n\n📊 Coverage by Subject\n• Physics: 1,280 questions | 98 topics covered\n• Chemistry: 1,360 questions | 112 topics covered\n• Mathematics: 1,200 questions | 89 topics covered\n\n🎯 Difficulty Distribution\n• Easy (1-mark tier): 28% | Medium: 52% | Hard: 20%\n\n💡 High-frequency topics identified for mock test weighting`;
    },
  },

  {
    id: 'wolfram_preload',
    phase: 2, phaseLabel: 'Source Ingestion',
    agentId: 'sage', agentName: 'Sage', agentEmoji: '🎓',
    action: 'Wolfram Alpha — Formula & Derivation Pre-check',
    category: 'ingestion', execution: 'sequential',
    inputFrom: ['pyq_ingestion', 'pdf_ingestion'], outputTo: ['content_architecture'],
    estimatedMs: 4000,
    description: 'Sage pre-validates all math and science formulas extracted from PDFs and PYQs through Wolfram Alpha. Builds a verified formula registry for Atlas to reference during content generation. SymPy handles symbolic verification when Wolfram quota is exceeded.',
    subAgentsInvolved: ['ProblemSolver', 'ConceptMapper'],
    connectionsRequired: ['Wolfram Alpha API', 'SymPy (fallback)', 'LLM consensus (second fallback)'],
    fallbackChain: ['SymPy symbolic computation', 'LLM consensus with temperature=0', 'Flag for human review'],
    sampleOutput: (inputs) => {
      const exam = (inputs.examName as string) || 'JEE Main';
      return `✅ Formula Registry — ${exam}\n\n🔢 Wolfram Verification\n• Formulas submitted: 2,340\n• Wolfram verified: 2,196 (94%) ✓\n• SymPy fallback used: 144 (Wolfram rate limit hit)\n• SymPy verified: 139/144 ✓\n• LLM consensus needed: 5\n• Human review flagged: 2 (ambiguous notation)\n\n📐 Formula Registry Built\n• Physics: 480 verified formulas\n• Chemistry: 320 equilibrium constants + reaction types\n• Mathematics: 740 formulas + derivation steps\n\n⚠️ 2 formulas flagged: Check sign convention in Faraday's Law variant`;
    },
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // PHASE 3 — CONTENT ARCHITECTURE
  // ═══════════════════════════════════════════════════════════════════════════

  {
    id: 'content_architecture',
    phase: 3, phaseLabel: 'Content Architecture',
    agentId: 'atlas', agentName: 'Atlas', agentEmoji: '📚',
    action: 'Syllabus Mapping & Content Architecture',
    category: 'generation', execution: 'sequential',
    inputFrom: ['pdf_ingestion', 'web_scrape_ingestion', 'pyq_ingestion', 'wolfram_preload'],
    outputTo: ['content_generation_lessons', 'content_generation_mcq', 'content_generation_mock'],
    estimatedMs: 4000,
    description: 'Atlas synthesises all ingested sources into a master content architecture: chapter → topic → subtopic tree, difficulty calibration per topic based on PYQ frequency, content gap map (what\'s in NCERT but missing in our repo), and a generation priority queue ordered by high-frequency exam topics.',
    subAgentsInvolved: ['Curator', 'SEOOptimizer'],
    connectionsRequired: [],
    fallbackChain: [],
    sampleOutput: (inputs) => {
      const exam = (inputs.examName as string) || 'JEE Main';
      return `✅ Content Architecture — ${exam}\n\n🏗️ Master Tree\n• Subjects: 3 | Chapters: 58 | Topics: 312 | Subtopics: 840\n\n📊 Content Gap Analysis\n• Already in repo: 210 topics (67%)\n• Need to generate: 102 topics (33%)\n• Priority 1 (high PYQ frequency): 34 topics\n• Priority 2 (medium): 41 topics\n• Priority 3 (low): 27 topics\n\n🎯 Generation Queue\n• Lessons to write: 102\n• MCQs to generate: 1,530 new (15/topic avg)\n• Mock tests to build: 5 full + 15 sectional\n• Explainers (short-form): 68\n\n💡 Wolfram will be called for all math content\nRAG context: 4,218 chunks available for grounding`;
    },
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // PHASE 4 — CONTENT GENERATION (parallel streams)
  // ═══════════════════════════════════════════════════════════════════════════

  {
    id: 'content_generation_lessons',
    phase: 4, phaseLabel: 'Content Generation',
    agentId: 'atlas', agentName: 'Atlas', agentEmoji: '📚',
    action: 'Lesson Generation (RAG + LLM)',
    category: 'generation', execution: 'parallel', parallelWith: ['content_generation_mcq'],
    inputFrom: ['content_architecture'], outputTo: ['accuracy_verification'],
    estimatedMs: 12000,
    description: 'Atlas Writer sub-agent generates all 102 lessons using RAG: retrieves relevant PDF chunks → builds context window → generates with LLM → applies SEO optimisation. Each lesson includes: key concepts, derivations, worked examples, mnemonics, common mistakes, and a Feynman simplification.',
    subAgentsInvolved: ['Writer', 'SEOOptimizer', 'Translator'],
    connectionsRequired: ['Gemini / Anthropic (LLM)', 'Vector Store (RAG)', 'Wolfram (math steps)'],
    fallbackChain: ['Anthropic Claude', 'OpenAI GPT-4o', 'Gemini Flash (reduced quality)'],
    sampleOutput: (inputs) => {
      const exam = (inputs.examName as string) || 'JEE Main';
      return `✅ Lesson Generation — ${exam}\n\n📝 Generation Summary\n• Lessons generated: 102/102 ✓\n• Avg word count: 1,680 words\n• RAG retrieval used: 94% (6 chunks avg per lesson)\n• Wolfram called for derivations: 340 times\n• Hinglish variants generated: 102 (parallel)\n• SEO score avg: 84/100\n• Feynman simplifications: 102 ✓\n• Mnemonic suggestions: 67 topics\n\n⚠️ 3 lessons flagged: Optics derivations need human review\n💡 All lessons grounded in NCERT — no hallucination risk`;
    },
  },

  {
    id: 'content_generation_mcq',
    phase: 4, phaseLabel: 'Content Generation',
    agentId: 'atlas', agentName: 'Atlas', agentEmoji: '📚',
    action: 'MCQ & Problem Generation',
    category: 'generation', execution: 'parallel', parallelWith: ['content_generation_lessons'],
    inputFrom: ['content_architecture'], outputTo: ['accuracy_verification'],
    estimatedMs: 10000,
    description: 'Atlas QuizMaster generates 1,530 new MCQs across all 102 topics. Each question includes: 4 distractor-engineered answer choices, detailed solution with step-by-step working, Wolfram verification of the answer, difficulty tag, and NTA-style formatting. Questions are seeded from PYQ patterns.',
    subAgentsInvolved: ['QuizMaster', 'FactChecker'],
    connectionsRequired: ['Wolfram Alpha API', 'SymPy', 'LLM'],
    fallbackChain: ['SymPy answer verification', 'LLM consensus', 'Flag for human QA'],
    sampleOutput: (inputs) => {
      const exam = (inputs.examName as string) || 'JEE Main';
      return `✅ MCQ Generation — ${exam}\n\n🎯 Questions Generated\n• New MCQs: 1,530/1,530 ✓\n• Numerical answer type: 306 (20%)\n• Distractors engineered: 4 per question (common error patterns)\n• Wolfram-verified answers: 1,284 (math/science) ✓\n• SymPy fallback used: 246 ✓\n• Difficulty: Easy 28% | Medium 52% | Hard 20%\n• NTA format compliant: 100% ✓\n\n📊 Quality Checks\n• Distractor effectiveness score: 82/100 avg\n• Bloom's taxonomy coverage: Remember 15%, Apply 45%, Analyse 40%\n• PYQ similarity check: 0 near-duplicates (clean)\n\n⚠️ 18 questions flagged for human review (ambiguous wording)`;
    },
  },

  {
    id: 'content_generation_mock',
    phase: 4, phaseLabel: 'Content Generation',
    agentId: 'atlas', agentName: 'Atlas', agentEmoji: '📚',
    action: 'Mock Test Assembly',
    category: 'generation', execution: 'sequential',
    inputFrom: ['content_generation_lessons', 'content_generation_mcq'], outputTo: ['accuracy_verification'],
    estimatedMs: 3000,
    description: 'Atlas assembles 5 full-length mock tests and 15 sectional tests from the verified question bank. Mock tests replicate NTA exam format exactly: 75 questions, 3 hours, negative marking, section-lock interface.',
    subAgentsInvolved: ['QuizMaster', 'Curator'],
    connectionsRequired: [],
    fallbackChain: [],
    sampleOutput: (inputs) => {
      const exam = (inputs.examName as string) || 'JEE Main';
      return `✅ Mock Tests Assembled — ${exam}\n\n📝 Test Suite\n• Full mock tests: 5 (NTA format, 75 Qs, 3 hrs, -1 marking) ✓\n• Sectional mocks: 15 (Physics×5, Chemistry×5, Math×5)\n• Difficulty calibration: Matches 2024 actual paper distribution\n• Unique questions across all tests: 98% (no recycling)\n• Detailed solutions: All 375 full-mock questions ✓\n• Predicted cut-off for each mock: Calculated ✓\n\n🎯 Special Sets\n• PYQ-heavy test (30% actual PYQs): 1\n• Tough paper simulation: 1\n• Speed-building (45-sec/question target): 1`;
    },
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // PHASE 5 —
  // ═══════════════════════════════════════════════════════════════════════════
  // PHASE 5 — ACCURACY VERIFICATION
  // ═══════════════════════════════════════════════════════════════════════════

  {
    id: 'accuracy_verification',
    phase: 5, phaseLabel: 'Accuracy Verification',
    agentId: 'sage', agentName: 'Sage', agentEmoji: '🎓',
    action: 'Deep Content Verification (Wolfram + SymPy + LLM)',
    category: 'verification', execution: 'sequential',
    inputFrom: ['content_generation_lessons', 'content_generation_mcq', 'content_generation_mock'],
    outputTo: ['quality_gate'],
    estimatedMs: 8000,
    description: 'Sage orchestrates the full verification cascade: (1) Wolfram Alpha for all numerical answers and formulas, (2) SymPy for symbolic algebra, (3) LLM consensus (3 independent completions) for conceptual accuracy. Flags anything below 90% confidence for human QA.',
    subAgentsInvolved: ['ProblemSolver', 'ConceptMapper', 'Explainer'],
    connectionsRequired: ['Wolfram Alpha API', 'SymPy', 'Gemini (LLM consensus)'],
    fallbackChain: ['SymPy → LLM consensus → Human review queue'],
    sampleOutput: (inputs) => {
      const exam = (inputs.examName as string) || 'JEE Main';
      return `✅ Verification Report — ${exam}\n\n🔬 Overall Accuracy: 96.4%\n\n🔢 Wolfram Alpha\n• Math expressions verified: 2,196/2,340 (94%) ✓\n• SymPy handled: 144 — all passed ✓\n\n🧪 Scientific Facts\n• LLM consensus (3 models): 98.1% agreement ✓\n• NCERT cross-reference: 97.8% match ✓\n\n⚠️ Issues Found & Fixed\n• 3 sign errors in EMF derivations (auto-fixed)\n• 2 unit errors in Thermodynamics (auto-fixed)\n• 7 ambiguous question wordings (flagged for human)\n• 1 answer dispute: Integration Q42 (manual review required)\n\n✅ Approved for publishing: 99.3% of content\n📋 Human review queue: 10 items`;
    },
  },

  {
    id: 'quality_gate',
    phase: 5, phaseLabel: 'Accuracy Verification',
    agentId: 'oracle', agentName: 'Oracle', agentEmoji: '📊',
    action: 'Quality Gate & CEO Approval',
    category: 'decision', execution: 'sequential',
    requiresCEOApproval: true,
    inputFrom: ['accuracy_verification'], outputTo: ['seo_setup', 'content_upload'],
    estimatedMs: 1500,
    description: 'Oracle presents a full quality dashboard: accuracy score, content coverage percentage, mock test calibration results, and a list of human-review items. CEO approves to proceed to marketing + deployment.',
    subAgentsInvolved: ['ReportGenerator'],
    connectionsRequired: [],
    fallbackChain: [],
    sampleOutput: (inputs) => {
      const exam = (inputs.examName as string) || 'JEE Main';
      return `✅ Quality Gate Report — ${exam}\n\n📊 Readiness Score: 96/100 — APPROVED ✅\n\n✅ Content Coverage: 100% (all 102 topics)\n✅ Accuracy: 96.4% (threshold: 90%)\n✅ Mock tests: 5 full + 15 sectional ready\n✅ PYQ bank: 3,840 questions indexed\n⚠️ Human review: 10 items (non-blocking)\n\n👔 CEO Action: Approve to launch marketing + deploy`;
    },
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // PHASE 6 — SEO & MARKETING PREPARATION (parallel with content upload)
  // ═══════════════════════════════════════════════════════════════════════════

  {
    id: 'seo_setup',
    phase: 6, phaseLabel: 'Marketing & SEO',
    agentId: 'herald', agentName: 'Herald', agentEmoji: '📢',
    action: 'SEO Architecture & Landing Pages',
    category: 'marketing', execution: 'parallel', parallelWith: ['content_upload'],
    inputFrom: ['quality_gate'], outputTo: ['campaign_prep'],
    estimatedMs: 4000,
    description: 'Herald builds the full SEO stack: exam landing page (targeting primary keywords from Scout), programmatic pages per chapter/topic (long-tail SEO), schema markup (FAQPage, Course, BreadcrumbList), and a launch blog post for Google discovery.',
    subAgentsInvolved: ['CampaignManager', 'SEOOptimizer', 'EmailCrafter'],
    connectionsRequired: ['Brave Search (keyword validation)'],
    fallbackChain: ['Manual SEO structure'],
    sampleOutput: (inputs) => {
      const exam = (inputs.examName as string) || 'JEE Main';
      return `✅ SEO Setup — ${exam}\n\n🌐 Pages Created\n• Main landing: /exams/${exam.toLowerCase().replace(/\s+/, '-')} ✓\n• Chapter pages: 58 (auto-generated, 400+ words each)\n• Topic pages: 312 programmatic pages\n• Schema: FAQPage (24 FAQs), Course, BreadcrumbList ✓\n• Meta tags: All pages ✓\n\n📝 Launch Content\n• Blog: "Complete ${exam} 2026 Preparation Guide" — 2,400 words ✓\n• 5 supporting blog posts drafted\n• FAQ page: 24 questions targeting featured snippets\n\n📊 Projected organic traffic: 3,200/mo by month 3`;
    },
  },

  {
    id: 'campaign_prep',
    phase: 6, phaseLabel: 'Marketing & SEO',
    agentId: 'herald', agentName: 'Herald', agentEmoji: '📢',
    action: 'Launch Campaign — All Channels',
    category: 'marketing', execution: 'sequential',
    inputFrom: ['seo_setup'], outputTo: ['deployment'],
    estimatedMs: 3000,
    description: 'Herald prepares the full launch campaign: WhatsApp broadcast to existing users, Telegram channel post, lead nurture drip sequence for acquired leads, social media posts (LinkedIn/Twitter/Instagram), and Google Ads copy (for future activation). Also fires acquisition pipeline rules in Nexus.',
    subAgentsInvolved: ['CampaignManager', 'SocialPoster', 'EmailCrafter', 'LeadNurturer'],
    connectionsRequired: ['WhatsApp Business API', 'Telegram Bot API', 'SendGrid/Resend'],
    fallbackChain: ['Email fallback if WhatsApp unavailable', 'In-app notification fallback'],
    sampleOutput: (inputs) => {
      const exam = (inputs.examName as string) || 'JEE Main';
      return `✅ Campaign Ready — ${exam}\n\n📣 Channel Plans\n• WhatsApp broadcast: Drafted (existing 2,847 users)\n• Telegram post: Ready for @EduGeniusOfficial channel\n• Email campaign: 5-touch drip sequence (leads pipeline)\n• Instagram: 3 Reels scripts + carousel post\n• Twitter/X: 7-tweet thread\n• LinkedIn: 1 article for teacher/parent audience\n\n🎁 Launch Offer\n• First 100 signups: 40% off (₹1,799 → ₹1,079)\n• Referral code auto-generated: EG${exam.replace(/\s+/, '')}26\n\n🚦 Acquisition rules activated in Nexus lifecycle engine\n📅 Campaign scheduled: T+0h (immediately on CEO approval)`;
    },
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // PHASE 7 — DEPLOYMENT
  // ═══════════════════════════════════════════════════════════════════════════

  {
    id: 'content_upload',
    phase: 7, phaseLabel: 'Deployment',
    agentId: 'forge', agentName: 'Forge', agentEmoji: '⚙️',
    action: 'Content Upload & DB Migration',
    category: 'deployment', execution: 'parallel', parallelWith: ['seo_setup'],
    inputFrom: ['quality_gate'], outputTo: ['deployment'],
    estimatedMs: 5000,
    description: 'Forge handles database migrations (new exam schema, question tables, topic hierarchy), uploads all content to CDN, seeds the vector store for RAG, and indexes everything in the search engine.',
    subAgentsInvolved: ['DBMigrator', 'CDNSyncer', 'BuildRunner'],
    connectionsRequired: ['PostgreSQL', 'Pinecone/pgvector', 'CDN (Cloudflare/CloudFront)'],
    fallbackChain: ['Rollback migration', 'Alert Forge + CEO'],
    sampleOutput: (inputs) => {
      const exam = (inputs.examName as string) || 'JEE Main';
      return `✅ DB Migration & Upload — ${exam}\n\n🗄️ Database\n• Migration applied: v42 (adds ${exam} schema) ✓\n• 102 lessons inserted ✓\n• 5,370 questions (3,840 PYQ + 1,530 new) inserted ✓\n• 312 topic records created ✓\n• Rollback savepoint: saved ✓\n\n☁️ CDN Upload\n• Files: 847 assets uploaded ✓\n• 4 CDN regions synced (ap-south, ap-southeast, us-east, eu-west) ✓\n• Cache warmed ✓\n• Vector store: 4,218 embeddings upserted ✓`;
    },
  },

  {
    id: 'deployment',
    phase: 7, phaseLabel: 'Deployment',
    agentId: 'forge', agentName: 'Forge', agentEmoji: '⚙️',
    action: 'Production Deployment & Health Check',
    category: 'deployment', execution: 'sequential',
    inputFrom: ['content_upload', 'campaign_prep'], outputTo: ['analytics_setup'],
    estimatedMs: 4000,
    description: 'Forge runs the full deployment pipeline: builds new routes, deploys to Netlify/Vercel, runs E2E smoke tests, verifies all exam pages load, confirms payment flow works, and runs a performance budget check. On failure, triggers automatic rollback.',
    subAgentsInvolved: ['BuildRunner', 'TestOrchestrator', 'HealthChecker', 'RollbackGuard'],
    connectionsRequired: ['Netlify/Vercel API', 'Playwright (E2E tests)', 'Sentry (error tracking)'],
    fallbackChain: ['Auto-rollback → alert CEO → manual deploy'],
    sampleOutput: (inputs) => {
      const exam = (inputs.examName as string) || 'JEE Main';
      return `✅ Deployment — ${exam}\n\n🚀 Build\n• Netlify build: ✓ (8.9s, 0 errors)\n• New routes: /exams/${exam.toLowerCase().replace(/\s+/, '-')} + 312 topic pages ✓\n\n🧪 E2E Tests (12 scenarios)\n• Exam landing page loads ✓\n• Mock test starts and submits ✓\n• Payment flow (test mode) ✓\n• Student dashboard updates ✓\n• All 12/12 scenarios passed ✓\n\n⚡ Performance\n• LCP: 1.8s (target: < 2.5s) ✓\n• API response: 84ms avg ✓\n• Sentry: No errors in first 5 min ✓\n\n🟢 ${exam} is LIVE at https://edugenius-v2.netlify.app/exams/`;
    },
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // PHASE 8 — ANALYTICS & TRACKING
  // ═══════════════════════════════════════════════════════════════════════════

  {
    id: 'analytics_setup',
    phase: 8, phaseLabel: 'Analytics & Tracking',
    agentId: 'oracle', agentName: 'Oracle', agentEmoji: '📊',
    action: 'Analytics Funnel & A/B Tests',
    category: 'analytics', execution: 'sequential',
    inputFrom: ['deployment'], outputTo: ['launch_monitor'],
    estimatedMs: 2500,
    description: 'Oracle configures the full analytics stack: conversion funnel (visit → trial → subscribe), content engagement metrics per topic, A/B test (pricing page variant), exam-specific KPI dashboard, and automated alerts for CEO if any metric drops significantly.',
    subAgentsInvolved: ['FunnelAnalyzer', 'ABEvaluator', 'AnomalyDetector', 'ReportGenerator'],
    connectionsRequired: ['Google Analytics 4', 'Mixpanel (events)', 'PostHog (optional)'],
    fallbackChain: ['Custom event tracking only', 'Manual reporting'],
    sampleOutput: (inputs) => {
      const exam = (inputs.examName as string) || 'JEE Main';
      return `✅ Analytics Live — ${exam}\n\n📊 Funnel Configured\n• Visit → Start trial → Complete mock → Subscribe\n• 4-step attribution with UTM tracking ✓\n\n🧪 A/B Tests Running\n• Test A: "₹1,799/year" vs "₹150/month"\n• Test B: "Start Free" vs "Take Free Mock Test"\n• Sample size needed: 800 visitors/variant\n\n📈 CEO Dashboard\n• Real-time KPIs: Signups/day, Mock completions, Trial→Paid CVR\n• Anomaly alerts: Set (>20% drop triggers Telegram ping to CEO)\n• Weekly digest: Scheduled Sundays 9am IST\n\n🎯 Exam-specific dashboard live at /exam-analytics`;
    },
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // PHASE 9 — LIVE MONITORING
  // ═══════════════════════════════════════════════════════════════════════════

  {
    id: 'launch_monitor',
    phase: 9, phaseLabel: 'Live Monitoring',
    agentId: 'oracle', agentName: 'Oracle', agentEmoji: '📊',
    action: 'Launch Day Monitoring (24h)',
    category: 'analytics', execution: 'sequential',
    inputFrom: ['analytics_setup'], outputTo: [],
    estimatedMs: 3000,
    description: 'Oracle + Scout + Mentor run a 24-hour post-launch watch: monitoring first student signups, content engagement, social media mentions, competitor reactions, and system stability. Generates a Launch Day Report for CEO.',
    subAgentsInvolved: ['MetricTracker', 'AnomalyDetector', 'CohortAnalyzer'],
    connectionsRequired: ['GA4', 'Sentry', 'WhatsApp (CEO alert)'],
    fallbackChain: [],
    sampleOutput: (inputs) => {
      const exam = (inputs.examName as string) || 'JEE Main';
      return `✅ Launch Day Report — ${exam} (T+24h)\n\n🎉 LAUNCH SUCCESS\n• Signups (24h): 47 🟢\n• Mock tests started: 38 (81% activation)\n• Mock tests completed: 24 (51%)\n• Avg session: 34 minutes\n• Trial → interest signals: 12 users (26%)\n\n📣 Social\n• Organic mentions: 8 (Twitter/Reddit)\n• WhatsApp forwards: 3 detected\n• No negative press ✓\n\n⚙️ System\n• Uptime: 100% ✓\n• No Sentry errors ✓\n• Slowest page: Mock test submit (310ms — acceptable)\n\n🎯 Day 1 projection: On track for 600 signups / month 1`;
    },
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Phase metadata
// ─────────────────────────────────────────────────────────────────────────────

export const EXAM_CREATION_PHASES = [
  { phase: 1, label: 'Market Research',       emoji: '🔍', color: 'text-sky-600 dark:text-sky-400',      bg: 'bg-sky-50 dark:bg-sky-900/20',      stepCount: EXAM_CREATION_STEPS.filter(s=>s.phase===1).length },
  { phase: 2, label: 'Source Ingestion',       emoji: '📥', color: 'text-amber-600 dark:text-amber-400',  bg: 'bg-amber-50 dark:bg-amber-900/20',   stepCount: EXAM_CREATION_STEPS.filter(s=>s.phase===2).length },
  { phase: 3, label: 'Content Architecture',   emoji: '🏗️', color: 'text-violet-600 dark:text-violet-400',bg: 'bg-violet-50 dark:bg-violet-900/20', stepCount: EXAM_CREATION_STEPS.filter(s=>s.phase===3).length },
  { phase: 4, label: 'Content Generation',     emoji: '✍️', color: 'text-fuchsia-600 dark:text-fuchsia-400',bg:'bg-fuchsia-50 dark:bg-fuchsia-900/20',stepCount: EXAM_CREATION_STEPS.filter(s=>s.phase===4).length },
  { phase: 5, label: 'Verification',           emoji: '✅', color: 'text-green-600 dark:text-green-400',  bg: 'bg-green-50 dark:bg-green-900/20',   stepCount: EXAM_CREATION_STEPS.filter(s=>s.phase===5).length },
  { phase: 6, label: 'Marketing & SEO',        emoji: '📢', color: 'text-red-600 dark:text-red-400',      bg: 'bg-red-50 dark:bg-red-900/20',       stepCount: EXAM_CREATION_STEPS.filter(s=>s.phase===6).length },
  { phase: 7, label: 'Deployment',             emoji: '⚙️', color: 'text-purple-600 dark:text-purple-400',bg:'bg-purple-50 dark:bg-purple-900/20',  stepCount: EXAM_CREATION_STEPS.filter(s=>s.phase===7).length },
  { phase: 8, label: 'Analytics',              emoji: '📊', color: 'text-cyan-600 dark:text-cyan-400',    bg: 'bg-cyan-50 dark:bg-cyan-900/20',     stepCount: EXAM_CREATION_STEPS.filter(s=>s.phase===8).length },
  { phase: 9, label: 'Live Monitoring',        emoji: '🚀', color: 'text-emerald-600 dark:text-emerald-400',bg:'bg-emerald-50 dark:bg-emerald-900/20',stepCount:EXAM_CREATION_STEPS.filter(s=>s.phase===9).length },
] as const;

// ─────────────────────────────────────────────────────────────────────────────
// Edge case: Combo Workflows (non-linear paths)
// ─────────────────────────────────────────────────────────────────────────────

export interface ComboWorkflow {
  id: string;
  name: string;
  description: string;
  trigger: string;
  steps: string[];  // subset of EXAM_CREATION_STEPS ids
  reason: string;
}

export const COMBO_WORKFLOWS: ComboWorkflow[] = [
  {
    id: 'low_viability_pivot',
    name: 'Low Viability → Blue Ocean Pivot',
    description: 'Triggered when viability score < 50. Scout generates 3 alternative exam ideas with higher scores. CEO selects one, workflow restarts from Phase 1 with new target.',
    trigger: 'viability_gate score < 50',
    steps: ['viability_gate', 'demand_analysis', 'competitor_deep_dive', 'audience_profiling'],
    reason: 'Prevents investing in content for a saturated/low-demand exam',
  },
  {
    id: 'content_quality_retry',
    name: 'Content Quality Below Threshold → Retry',
    description: 'If accuracy verification < 90%, Atlas regenerates flagged content with stricter prompts + larger Wolfram quota. Sage re-verifies only the failed subset.',
    trigger: 'accuracy_verification score < 90%',
    steps: ['content_generation_lessons', 'content_generation_mcq', 'accuracy_verification'],
    reason: 'Quality gate enforcement — never deploy unverified content',
  },
  {
    id: 'wolfram_unavailable',
    name: 'Wolfram Unavailable → SymPy + LLM Fallback',
    description: 'If Wolfram API fails/quota exceeded: SymPy handles symbolic computation, LLM consensus (3 independent calls) handles conceptual verification. Math expressions are flagged with "pending-wolfram" tag.',
    trigger: 'wolfram_preload error or quota_exceeded',
    steps: ['wolfram_preload', 'accuracy_verification'],
    reason: 'Fault tolerance — exam launch not blocked by single API failure',
  },
  {
    id: 'pdf_parse_fail',
    name: 'PDF Parse Failure → OCR Fallback',
    description: 'If PDF parser fails (corrupted/scanned PDF): Tesseract OCR is invoked. If OCR confidence < 80%, the specific document is flagged and CEO is prompted to re-upload or skip. Other PDFs in the batch continue processing.',
    trigger: 'pdf_ingestion parse_error',
    steps: ['pdf_ingestion'],
    reason: 'Scanned textbook PDFs are common — need robust fallback chain',
  },
  {
    id: 'competitor_dominance',
    name: 'Competitor Market Dominance Detected',
    description: 'If competitor analysis finds a dominant player (>70% market share) with AI features: Scout generates a "differentiation brief" highlighting EduGenius unique advantages. CEO reviews before committing to full content generation.',
    trigger: 'competitor_deep_dive dominant_player_detected',
    steps: ['competitor_deep_dive', 'viability_gate'],
    reason: 'Prevents direct head-on competition — recommend blue ocean or niche angle',
  },
  {
    id: 'fast_launch',
    name: 'Fast Launch (Pilot Mode — 7 days)',
    description: 'For time-sensitive exam launches (exam date < 60 days): skip full PYQ ingestion, generate only top-20 high-frequency topics, deploy with "Beta" label, and gather real student feedback to improve iteratively.',
    trigger: 'CEO selects "Pilot Mode" on exam creation form',
    steps: ['demand_analysis', 'web_scrape_ingestion', 'content_architecture', 'content_generation_lessons', 'accuracy_verification', 'seo_setup', 'deployment', 'analytics_setup'],
    reason: 'Speed-to-market for last-minute exam launches',
  },
  {
    id: 'multilingual_parallel',
    name: 'Multilingual Content (English + Hinglish + Regional)',
    description: 'Once base content is generated and verified, Atlas Translator runs in parallel to produce Hinglish and 1–2 regional language variants. Forge deploys all variants under /hi/, /te/, etc. routes.',
    trigger: 'CEO selects "Multilingual" on exam config',
    steps: ['content_generation_lessons', 'content_generation_mcq', 'seo_setup', 'deployment'],
    reason: 'Vernacular content reaches Tier 2/3 cities with 2x lower competition',
  },
  {
    id: 'exam_update',
    name: 'Syllabus Change → Incremental Update',
    description: 'When NTA/CBSE announces a syllabus change: Scout detects it via web scrape, compares against current content architecture, identifies delta (added/removed topics), runs targeted content generation for delta only, and deploys incrementally without full re-run.',
    trigger: 'web_scrape_ingestion syllabus_delta_detected',
    steps: ['web_scrape_ingestion', 'content_architecture', 'content_generation_lessons', 'accuracy_verification', 'deployment'],
    reason: 'Real-world exam syllabuses change — need incremental update, not full rebuild',
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Full agent × source × verification interconnection map
// ─────────────────────────────────────────────────────────────────────────────

export interface AgentConnection {
  from: string;
  to: string;
  dataType: string;
  description: string;
  isCriticalPath: boolean;
}

export const EXAM_CREATION_CONNECTIONS: AgentConnection[] = [
  // Research → Architecture
  { from: 'Scout', to: 'Oracle', dataType: 'Demand + Competitor Data', description: 'Scout feeds raw market intelligence for Oracle to score viability', isCriticalPath: true },
  { from: 'Oracle', to: 'CEO', dataType: 'Viability Report', description: 'Decision gate — CEO must approve before content investment', isCriticalPath: true },
  // Ingestion sources → Atlas
  { from: 'CEO Upload', to: 'Atlas', dataType: 'PDF Files (textbooks, PYQs)', description: 'CEO uploads raw source documents for Atlas to parse', isCriticalPath: false },
  { from: 'Scout', to: 'Atlas', dataType: 'Web Scraped Syllabus + NTA Data', description: 'Scout scrapes official exam authority sites, feeds structured data to Atlas', isCriticalPath: true },
  { from: 'Wolfram Alpha', to: 'Sage', dataType: 'Verified Formula Registry', description: 'Pre-built formula truth table for content generation grounding', isCriticalPath: false },
  { from: 'Vector Store', to: 'Atlas', dataType: 'PDF Chunk Embeddings (RAG)', description: 'Atlas retrieves relevant context before each generation call', isCriticalPath: true },
  // Generation → Verification
  { from: 'Atlas', to: 'Sage', dataType: 'Generated Lessons + MCQs', description: 'Atlas sends content to Sage for accuracy verification', isCriticalPath: true },
  { from: 'Sage', to: 'Wolfram Alpha', dataType: 'Math Expressions', description: 'Sage submits formulas and numerical answers for independent verification', isCriticalPath: false },
  { from: 'Sage', to: 'SymPy', dataType: 'Symbolic Expressions (fallback)', description: 'When Wolfram unavailable, SymPy handles symbolic computation', isCriticalPath: false },
  // Verified content → Deployment
  { from: 'Sage', to: 'Forge', dataType: 'Verified Content Package', description: 'Sage-approved content sent to Forge for CDN upload and deployment', isCriticalPath: true },
  { from: 'Atlas', to: 'Forge', dataType: 'Content Assets + DB Inserts', description: 'Atlas sends structured content for DB migration and CDN sync', isCriticalPath: true },
  // Marketing flows
  { from: 'Scout', to: 'Herald', dataType: 'Keywords + Competitor Gaps', description: 'Scout intel used by Herald to write targeted SEO copy and ad copy', isCriticalPath: true },
  { from: 'Herald', to: 'Nexus', dataType: 'Campaign Launch Signal', description: 'Herald signals Nexus lifecycle engine to activate acquisition rules', isCriticalPath: false },
  { from: 'Oracle', to: 'Herald', dataType: 'Performance Data', description: 'Oracle feeds real-time metrics back to Herald for campaign optimisation', isCriticalPath: false },
  // Analytics
  { from: 'Forge', to: 'Oracle', dataType: 'Deploy Confirmation', description: 'Forge tells Oracle deployment is live — analytics tracking begins', isCriticalPath: true },
  { from: 'Oracle', to: 'CEO', dataType: 'Launch Day Report + Dashboards', description: 'Oracle surfaces exam KPIs directly to CEO dashboard', isCriticalPath: true },
];

// ─────────────────────────────────────────────────────────────────────────────
// Workflow runner (async simulation for UI)
// ─────────────────────────────────────────────────────────────────────────────

export async function runExamCreationWorkflow(
  inputs: Record<string, unknown>,
  onStepUpdate: (stepId: string, status: 'running' | 'done' | 'error' | 'waiting', output?: string) => void,
  onCEOGate: (stepId: string, report: string) => Promise<boolean>,
): Promise<{ success: boolean; stepsCompleted: number }> {
  let stepsCompleted = 0;
  const stepOutputs: Record<string, string> = {};
  const parallelDone = new Set<string>();

  for (const step of EXAM_CREATION_STEPS) {
    // Check if this step is the non-first member of a parallel group (skip; handled when first runs)
    const isParallelFollower = step.parallelWith && step.parallelWith.some(id => {
      const other = EXAM_CREATION_STEPS.find(s => s.id === id);
      return other && EXAM_CREATION_STEPS.indexOf(other) < EXAM_CREATION_STEPS.indexOf(step);
    });
    if (isParallelFollower && parallelDone.has(step.id)) continue;

    if (step.execution === 'parallel' && step.parallelWith?.length) {
      // Run parallel group together
      const group = [step, ...step.parallelWith.map(id => EXAM_CREATION_STEPS.find(s => s.id === id)!).filter(Boolean)];
      group.forEach(s => onStepUpdate(s.id, 'running'));
      await Promise.all(group.map(async s => {
        const jitter = Math.random() * 500;
        await sleep(s.estimatedMs + jitter);
        const output = s.sampleOutput(inputs, stepOutputs);
        stepOutputs[s.id] = output;
        parallelDone.add(s.id);
        onStepUpdate(s.id, 'done', output);
      }));
      stepsCompleted += group.length;
    } else {
      onStepUpdate(step.id, 'running');
      const jitter = Math.random() * 400;
      await sleep(step.estimatedMs + jitter);
      const output = step.sampleOutput(inputs, stepOutputs);
      stepOutputs[step.id] = output;

      if (step.requiresCEOApproval) {
        const approved = await onCEOGate(step.id, output);
        if (!approved) {
          onStepUpdate(step.id, 'error', 'CEO declined to proceed.');
          return { success: false, stepsCompleted };
        }
      }

      onStepUpdate(step.id, 'done', output);
      stepsCompleted++;
    }
  }

  return { success: true, stepsCompleted };
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
