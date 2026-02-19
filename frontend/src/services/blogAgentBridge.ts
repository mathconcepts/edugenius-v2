/**
 * blogAgentBridge.ts
 *
 * Bidirectional sync between Blog and all Strategy agents.
 *
 * DIRECTION 1 — Strategy → Blog (blog stays in sync with strategy):
 *   VentureScout.TrendRadar       → triggers blog posts on trending exam keywords
 *   VentureScout.CompetitorSpy    → triggers counter-content when competitor moves detected
 *   VentureScout.NewsMonitor      → triggers news-response posts on policy/exam changes
 *   GrowthCommander.SEOStrategist → feeds keyword targets to Atlas for content calendar
 *   RevenueArchitect.ChurnPredictor → triggers retention content for at-risk cohorts
 *   Oracle                        → exam performance data shapes content priority
 *   Mentor                        → student pain points from chat become blog topics
 *   Herald                        → campaign needs drive blog content schedule
 *
 * DIRECTION 2 — Blog → Strategy (agent decisions informed by blog data):
 *   High-performing posts   → Oracle flags for GrowthCommander paid amplification
 *   Low-engagement posts    → Atlas notified to rewrite or retire
 *   SEO wins                → VentureScout.SEOStrategist updates keyword gap model
 *   Post topics             → Scout informs competitive intelligence
 *   CTR by exam tag         → RevenueArchitect updates demand scoring
 *   Comment themes          → Mentor uses as student pain point signals
 */

import type { BlogPost } from '@/stores/blogStore';

// ─── Strategy Signal (what an agent sends to trigger blog action) ─────────────

export interface StrategySignal {
  id: string;
  sourceAgent:
    | 'venture_scout'
    | 'growth_commander'
    | 'revenue_architect'
    | 'oracle'
    | 'mentor'
    | 'herald'
    | 'atlas'
    | 'sage';
  subAgent?: string; // e.g. 'TrendRadar', 'CompetitorSpy'
  signalType:
    | 'trending_keyword'
    | 'competitor_move'
    | 'news_event'
    | 'seo_gap'
    | 'churn_risk'
    | 'pain_point'
    | 'campaign_need'
    | 'exam_change';
  priority: 'critical' | 'high' | 'medium' | 'low';
  payload: StrategySignalPayload;
  timestamp: string;
  expiresAt?: string;                       // signal expires if not actioned
  actionTaken?: 'post_created' | 'post_updated' | 'layout_updated' | 'ignored';
  resultPostId?: string;                    // if action created/updated a post
}

export interface StrategySignalPayload {
  keyword?: string;                         // for trending_keyword, seo_gap
  searchVolume?: number;
  yoyGrowth?: number;
  opportunityScore?: number;
  examTag?: string;                         // target exam
  competitorName?: string;                  // for competitor_move
  competitorAction?: string;
  ourResponse?: string;
  newsTitle?: string;                       // for news_event
  newsImpact?: string;
  suggestedTitle?: string;                  // Atlas suggestion
  suggestedAngle?: string;
  targetKeywords?: string[];
  cohortId?: string;                        // for churn_risk
  churnRate?: number;
  retentionAngle?: string;
  painPoint?: string;                       // from student chat
  painFrequency?: number;
  campaignId?: string;                      // for campaign_need
  campaignObjective?: string;
}

// ─── Blog Performance Signal (what blog sends back to agents) ─────────────────

export interface BlogPerformanceSignal {
  postId: string;
  slug: string;
  title: string;
  examTags: string[];
  contentType: string;
  metrics: {
    views: number;
    shares: number;
    avgTimeOnPage?: number;
    bounceRate?: number;
    seoScore: number;
    qualityScore: number;
    engagementScore: number;
    conversionRate?: number;               // clicks to /chat or /practice
  };
  trend: 'rising' | 'stable' | 'declining';
  recommendation: 'amplify' | 'rewrite' | 'retire' | 'keep';
  recommendationReason: string;
  agentActions: {
    oracle: string;                        // what Oracle should do
    growthCommander?: string;              // paid amplification?
    atlas?: string;                        // rewrite or new post?
    herald?: string;                       // campaign tie-in?
  };
  generatedAt: string;
}

// ─── Agent Lineage (full traceability per post) ───────────────────────────────

export interface AgentLineage {
  postId: string;
  creationChain: LineageStep[];            // ordered list of what led to this post
  promptVersions: PromptVersion[];         // every prompt used, with version
  strategyAlignmentScore: number;          // 0-100: how aligned with current strategy
  lastSyncedWithStrategy: string;          // ISO timestamp
  pendingStrategyUpdates: string[];        // strategy changes not yet reflected in post
}

export interface LineageStep {
  stepId: string;
  agentId: string;
  subAgentId?: string;
  action:
    | 'triggered'
    | 'outlined'
    | 'drafted'
    | 'reviewed'
    | 'seo_optimised'
    | 'approved'
    | 'published'
    | 'updated'
    | 'retired';
  reasoning: string;                       // why this agent took this action
  timestamp: string;
  inputSignalId?: string;                  // which StrategySignal triggered this step
  outputArtifact?: string;                 // what was produced
}

export interface PromptVersion {
  promptId: string;
  promptName: string;
  version: string;
  agentId: string;
  usedAt: string;
  inputContext: Record<string, unknown>;
  outputSummary: string;
}

// ─── Layout Intelligence (AI controls blog layout from strategy context) ──────

export interface LayoutIntelligence {
  currentLayout: string;
  layoutReason: string;
  heroPostId?: string;
  heroReason: string;                      // why THIS post is hero
  promotedPostIds: string[];               // promoted because of strategy signals
  demotedPostIds: string[];                // demoted due to poor performance
  retiredPostIds: string[];                // retired: outdated, low quality
  categoryOrder: string[];
  categoryOrderReason: string;             // why categories are in this order
  nextReviewAt: string;                    // when layout should be re-evaluated
  pendingSignals: number;                  // unactioned strategy signals
  strategyAlignmentScore: number;          // 0-100
}

// ─── Blog Generation Prompt ───────────────────────────────────────────────────

export interface BlogGenerationPrompt {
  promptId: string;
  name: string;
  version: string;
  triggerAgent: string;
  triggerSubAgent?: string;
  signalType: string;
  systemPrompt: string;                    // full system prompt
  userPromptTemplate: string;              // handlebars-style {{variable}} template
  variables: string[];                     // required variables
  outputFormat: string;                    // what it produces
  qualityChecks: string[];                 // what Atlas checks before accepting output
  exampleOutput?: string;
  lastUsedAt?: string;
}

// ─── Complete Prompt Registry ─────────────────────────────────────────────────

export const PROMPT_REGISTRY: BlogGenerationPrompt[] = [
  // ── 1. TrendRadar → Atlas: Trending Keyword ──────────────────────────────────
  {
    promptId: 'prompt-trendradar-trending-keyword-v2',
    name: 'TrendRadar Trending Keyword Blog',
    version: '2.1.0',
    triggerAgent: 'venture_scout',
    triggerSubAgent: 'TrendRadar',
    signalType: 'trending_keyword',
    systemPrompt: `You are Atlas, EduGenius's AI Content Engine. You specialize in creating high-quality educational blog posts that rank on Google and genuinely help Indian exam aspirants (JEE, NEET, GATE, UPSC, CAT, CUET, CBSE).

Your writing principles:
1. ALWAYS lead with student value — solve a real problem, answer a real question
2. SEO is never forced — keywords emerge naturally from useful content
3. Use the NCERT-first principle for factual accuracy
4. Every post must have at least one actionable takeaway
5. Tone: expert friend — knowledgeable but never condescending
6. Never generic — always specific to the exam, year, and syllabus
7. Internal links to /chat, /practice, /learn must feel natural, not promotional
8. Scores must be earned: qualityScore ≥ 85 requires depth, examples, and structure

Signal context injection: When you receive a TrendRadar signal, the keyword has been verified against Google Trends, search volume data, and exam calendar proximity. This is real demand — write to satisfy it completely.`,

    userPromptTemplate: `Write a comprehensive blog post for EduGenius on the following trending keyword signal from VentureScout.TrendRadar:

**Keyword:** {{keyword}}
**Exam Target:** {{examTag}}
**Search Volume:** {{searchVolume}} searches/month
**Year-over-Year Growth:** {{yoyGrowth}}%
**Opportunity Score:** {{opportunityScore}}/100
**Suggested Title:** {{suggestedTitle}}
**Suggested Angle:** {{suggestedAngle}}
**Target Keywords (secondary):** {{targetKeywords}}

## Content Requirements

Write a {{targetWordCount}}-word blog post structured as follows:

### Title
Use the suggested title or improve it. Must include primary keyword naturally. Must communicate clear student benefit.

### Introduction (150 words)
- Open with a question or surprising fact about {{examTag}} that hooks the reader
- Establish why {{keyword}} is critical for {{examTag}} success RIGHT NOW (use the trend signal)
- Preview what the reader will learn

### Core Content (600–800 words)
- Break into 3–4 H2 sections with clear, keyword-rich headings
- Include real exam data: past year question frequency, expected weightage for current year
- Use numbered lists for steps/strategies; bullet lists for features/characteristics
- Include at least one callout block [!TIP], [!INFO], or [!WARNING]
- Include at least one blockquote from a student scenario or exam board guideline

### Internal CTA (natural, mid-article)
- One soft CTA linking to /chat or /practice relevant to the topic
- Format: [Anchor text](/path)

### Common Mistakes Section
3–5 specific mistakes students make with {{keyword}}, with how to avoid each

### Conclusion (100 words)
- Summarize the 3 most important takeaways
- End with a strong CTA: [CTA: text | /path]

### SEO Metadata
Return a JSON block at the end:
\`\`\`json
{
  "metaTitle": "...",
  "metaDescription": "...",
  "keywords": ["...", "..."],
  "examTags": ["{{examTag}}"],
  "contentType": "educational|exam-tips|strategy",
  "qualityScore": 85,
  "seoScore": 88
}
\`\`\``,

    variables: [
      'keyword',
      'examTag',
      'searchVolume',
      'yoyGrowth',
      'opportunityScore',
      'suggestedTitle',
      'suggestedAngle',
      'targetKeywords',
      'targetWordCount',
    ],
    outputFormat:
      'Full Markdown blog post with H1 title, H2 sections, structured content, internal links, and trailing JSON metadata block',
    qualityChecks: [
      'Primary keyword appears in title, first 100 words, and at least 2 H2 headings',
      'Word count within 10% of target',
      'At least 3 internal links present',
      'At least one callout block present',
      'At least one numbered list present',
      'JSON metadata block is valid and complete',
      'qualityScore ≥ 80 (Atlas self-assessed)',
      'No generic advice — all content specific to the exam and keyword',
      'No fabricated statistics — only what can be verified from NCERT/NTA sources',
    ],
    exampleOutput: `# GATE 2026 Preparation: Complete 6-Month Strategy for CSE Students

*Meta: Master GATE 2026 Computer Science with our data-backed 6-month preparation plan. Topic weightage, study schedule, and resources.*

Preparing for GATE 2026 Computer Science Engineering (CSE) without a structured plan is like writing code without architecture — you might get somewhere, but you'll spend twice the time fixing mistakes...`,
    lastUsedAt: '2026-02-18T10:30:00Z',
  },

  // ── 2. CompetitorSpy → Atlas: Counter-Content ────────────────────────────────
  {
    promptId: 'prompt-competitorspy-counter-content-v1',
    name: 'CompetitorSpy Counter-Content Blog',
    version: '1.3.0',
    triggerAgent: 'venture_scout',
    triggerSubAgent: 'CompetitorSpy',
    signalType: 'competitor_move',
    systemPrompt: `You are Atlas, EduGenius's AI Content Engine, with a specialist brief: creating counter-positioning content that outperforms competitor material without ever naming the competitor or appearing reactive.

Your counter-content principles:
1. NEVER mention competitor names — position EduGenius on its own merits
2. Address the same topic but go deeper, with more accuracy, and better structure
3. Where competitors use generic advice, we use specific exam data and personalization angles
4. Always elevate the discourse — we're setting a higher standard, not attacking
5. Highlight what EduGenius uniquely offers (AI tutoring, personalization, multi-exam coverage) naturally
6. SEO: target the same keywords the competitor is ranking for, but earn rankings through superior content
7. Quality bar: this content must be definitively better — longer, more actionable, more current

Signal context: CompetitorSpy has detected a competitor post gaining traction. Our job is to create the definitive resource on this topic within 48 hours.`,

    userPromptTemplate: `Write a definitive counter-content blog post based on the following CompetitorSpy signal:

**Competitor Action:** {{competitorAction}}
**Exam/Topic Area:** {{examTag}}
**Our Strategic Response:** {{ourResponse}}
**Suggested Title:** {{suggestedTitle}}
**Suggested Angle:** {{suggestedAngle}}
**Target Keywords:** {{targetKeywords}}

## Counter-Content Strategy

Write a blog post that is definitively superior on this topic. Do NOT mention the competitor. DO:

### Title
Create a title that targets the same search intent but promises more comprehensive value. Use power words: "Complete", "Definitive", "Data-Backed", "2026 Updated".

### Introduction (200 words)
- Open with the #1 pain point students have with this topic
- Establish our unique angle: AI-powered personalization for {{examTag}}
- Promise: "By the end of this guide, you'll have..."

### Why Most Guides on This Topic Fall Short (150 words)
WITHOUT naming anyone, describe the generic advice students typically find vs what they actually need. This is our differentiator section.

### Main Content (800–1000 words)
- Go 3x deeper than typical content on this topic
- Include: exam-specific data, topic weightage, year-by-year trends
- Include: a study schedule or framework unique to our positioning
- Include: student persona scenarios (e.g., "If you have 4 months vs 2 months")
- Add at least 2 [!TIP] callouts with EduGenius-specific advice

### The EduGenius Advantage Section (150 words)
Naturally explain how our AI tutoring, progress tracking, and personalized paths help with this specific topic. Link to /chat and /learn.

### Comparison: Generic Approach vs Smart Approach (table if applicable)
Show the difference without naming anyone.

### Conclusion + Strong CTA
- 3 key takeaways
- [CTA: Start Personalized Prep | /chat]

### SEO Metadata JSON
\`\`\`json
{
  "metaTitle": "...",
  "metaDescription": "...",
  "keywords": ["...", "..."],
  "examTags": ["{{examTag}}"],
  "contentType": "strategy",
  "qualityScore": 90,
  "seoScore": 88
}
\`\`\``,

    variables: [
      'competitorAction',
      'examTag',
      'ourResponse',
      'suggestedTitle',
      'suggestedAngle',
      'targetKeywords',
    ],
    outputFormat:
      'Full Markdown blog post positioning EduGenius as the superior resource without naming competitors',
    qualityChecks: [
      'No competitor names mentioned anywhere',
      'Content is definitively more comprehensive than a typical guide on this topic',
      'EduGenius features mentioned naturally in at least 2 places',
      'Includes exam-specific data (weightage, trends)',
      'At least 1000 words of body content',
      'Internal links to /chat and /learn present',
      'JSON metadata valid and seoScore ≥ 85',
    ],
    lastUsedAt: '2026-02-17T14:15:00Z',
  },

  // ── 3. Mentor → Atlas: Pain Point Blog ───────────────────────────────────────
  {
    promptId: 'prompt-mentor-pain-point-v2',
    name: 'Mentor Pain Point Blog',
    version: '2.0.0',
    triggerAgent: 'mentor',
    signalType: 'pain_point',
    systemPrompt: `You are Atlas, EduGenius's AI Content Engine. You have received a signal from Mentor, our AI student coach, about a pain point that real students are expressing in their tutoring sessions.

Your mission: Transform this student pain point into a blog post that feels like it was written BY someone who deeply understands the struggle — because it was informed by real student conversations.

Pain-point blog principles:
1. LEAD with empathy — acknowledge the struggle before offering solutions
2. Write as if the student is nodding along: "Yes! That's exactly my problem!"
3. Use student-voice language, not academic language
4. Solutions must be actionable in the next 24 hours, not just theoretical
5. Connect solutions to EduGenius features where they genuinely help
6. The blog should make the student feel: understood → hopeful → empowered → ready to act
7. Avoid toxic positivity — acknowledge that this is genuinely hard

Signal context: This pain point has been reported by {{painFrequency}} students in the last 7 days. It's a real, widespread problem — not an edge case.`,

    userPromptTemplate: `Write an empathy-first blog post based on this Mentor pain point signal:

**Student Pain Point:** {{painPoint}}
**Exam Context:** {{examTag}}
**Frequency:** {{painFrequency}} students reported this in the past 7 days
**Suggested Title:** {{suggestedTitle}}
**Suggested Angle:** {{suggestedAngle}}

## Blog Structure

### Title
Must acknowledge the struggle, not just promise a solution. Examples:
- "Struggling with [X] Before [Exam]? You're Not Alone — Here's What Actually Helps"
- "Why [X] Feels So Hard (And the Strategy That Finally Makes It Click)"

### Opening: You're Not Alone (150 words)
- Start with a student scenario that perfectly captures the pain point
- Use second-person: "You've spent 3 hours on the same chapter..."
- Validate the emotion: "This is genuinely one of the hardest parts of {{examTag}} prep"
- Transition: "Here's what our AI tutor has found actually works"

### Why This Happens (Understanding the Root Cause) (200 words)
- Explain WHY students struggle with {{painPoint}} — the cognitive or strategic reason
- This section builds trust: we understand the problem at a deeper level
- Include 1 [!INFO] callout with a surprising insight about the root cause

### What Doesn't Work (And Why) (150 words)
- List 2-3 common approaches students try that don't solve {{painPoint}}
- Be specific, not generic ("studying for 4 hours" → "re-reading the same chapter")
- End: "These feel productive but don't address the real issue"

### What Actually Works: The Framework (300–400 words)
- 3–5 specific, actionable strategies
- Each strategy: name → why it works → exactly how to do it → time required
- At least one strategy involves EduGenius (naturally): [Try this with our AI Tutor | /chat]
- Include [!TIP] callout for the most impactful strategy

### Student Stories (optional, 100 words)
- Composite student scenario: "Priya was in the same situation..."
- How they used the above strategies + EduGenius to break through

### Your Next Step (100 words)
- What to do RIGHT NOW (within the next hour)
- [CTA: Get Personalized Help with {{painPoint}} | /chat]

### SEO Metadata JSON
\`\`\`json
{
  "metaTitle": "...",
  "metaDescription": "...",
  "keywords": ["...", "..."],
  "examTags": ["{{examTag}}"],
  "contentType": "educational",
  "qualityScore": 87,
  "seoScore": 82
}
\`\`\``,

    variables: [
      'painPoint',
      'examTag',
      'painFrequency',
      'suggestedTitle',
      'suggestedAngle',
    ],
    outputFormat:
      'Empathy-first Markdown blog post addressing a specific student pain point with actionable solutions',
    qualityChecks: [
      'Opens with student scenario in second person',
      'Acknowledges the struggle genuinely before offering solutions',
      'At least 3 actionable strategies with specific implementation steps',
      'EduGenius mention is natural and relevant, not forced',
      'Link to /chat present',
      'No toxic positivity or dismissive language',
      'qualityScore ≥ 85 (Atlas self-assessed)',
    ],
    lastUsedAt: '2026-02-18T16:45:00Z',
  },

  // ── 4. SEOStrategist → Atlas: Gap-Fill Blog ───────────────────────────────────
  {
    promptId: 'prompt-seostrategist-gap-fill-v1',
    name: 'SEOStrategist Gap-Fill Blog',
    version: '1.2.0',
    triggerAgent: 'growth_commander',
    triggerSubAgent: 'SEOStrategist',
    signalType: 'seo_gap',
    systemPrompt: `You are Atlas, EduGenius's AI Content Engine, operating under a GrowthCommander.SEOStrategist signal. This means a keyword opportunity has been identified where:
(a) search volume is significant
(b) existing top-ranking content is weak, outdated, or generic
(c) EduGenius can realistically rank #1-3 with quality content

Your SEO gap-fill principles:
1. This is first and foremost a content quality mission — ranking is a byproduct of being the best resource
2. Analyze what the searcher ACTUALLY needs when they type this query (search intent)
3. Structure content to match the search intent exactly (informational, transactional, navigational)
4. Use semantic SEO: cover the topic comprehensively, use related terms naturally
5. The content must be the most complete, accurate, and useful resource on this exact keyword
6. Length should be dictated by what's needed to fully answer the query — not artificially padded
7. Every section should add information not found in competing content

Gap signal context: This keyword has {{searchVolume}} searches/month with an opportunity score of {{opportunityScore}}/100. The current #1 result is weak on depth and freshness.`,

    userPromptTemplate: `Write an SEO gap-fill blog post for the following GrowthCommander.SEOStrategist signal:

**Target Keyword:** {{keyword}}
**Search Volume:** {{searchVolume}}/month
**YoY Growth:** {{yoyGrowth}}%
**Opportunity Score:** {{opportunityScore}}/100
**Exam Context:** {{examTag}}
**Suggested Title:** {{suggestedTitle}}
**Secondary Keywords:** {{targetKeywords}}
**Suggested Angle:** {{suggestedAngle}}

## Content Mission

Write the most comprehensive, useful, and accurate resource on "{{keyword}}" that exists on the internet for {{examTag}} students.

### Search Intent Analysis
Before writing, identify: Is this query looking for:
- A how-to guide?
- A comparison?
- A study plan?
- An explanation of a concept?
Write the content that EXACTLY matches this intent.

### Title
Must contain primary keyword. Must be compelling. Must match search intent signal.

### Introduction — The Answer-First Approach (100–150 words)
- Give the searcher the core answer in the FIRST paragraph (Google's helpful content standard)
- Then expand on WHY this matters for {{examTag}}
- Preview the full depth of what follows

### Comprehensive Body (800–1200 words)
Structure according to what the searcher needs:
- Use H2 for major sections, H3 for subsections
- Include data tables where relevant (topic weightage, year comparison, etc.)
- Include at least one comparison (e.g., "Method A vs Method B")
- Cover all aspects of the topic: what, why, how, when, common mistakes, expert tips
- Semantic coverage: use related terms naturally (LSI keywords)
- At least 2 [!TIP] or [!INFO] callouts

### EduGenius Integration (natural, 2 mentions max)
- Connect to /practice for practice problems on this topic
- Connect to /chat for personalized help

### FAQ Section (3–5 questions)
Answer the most common follow-up questions for this keyword (good for featured snippets)

### Summary + CTA
- Quick summary table or bullet list of key takeaways
- [CTA: Practice {{keyword}} Questions | /practice]

### SEO Metadata JSON
\`\`\`json
{
  "metaTitle": "{{keyword}} — Complete Guide for {{examTag}} [2026]",
  "metaDescription": "...",
  "keywords": ["{{keyword}}", "..."],
  "examTags": ["{{examTag}}"],
  "contentType": "educational",
  "qualityScore": 88,
  "seoScore": 92
}
\`\`\``,

    variables: [
      'keyword',
      'searchVolume',
      'yoyGrowth',
      'opportunityScore',
      'examTag',
      'suggestedTitle',
      'targetKeywords',
      'suggestedAngle',
    ],
    outputFormat:
      'SEO-optimized comprehensive Markdown blog post targeting a specific keyword gap, with FAQ section and metadata',
    qualityChecks: [
      'Primary keyword in title, meta title, first paragraph, and at least 3 H2s',
      'Answer-first introduction (core answer within first 150 words)',
      'FAQ section with at least 3 questions',
      'Content is longer and more detailed than current top-ranking result',
      'At least one data table or comparison present',
      'Semantic keywords used naturally (not forced)',
      'seoScore ≥ 88 (Atlas self-assessed)',
      'No keyword stuffing — density < 2%',
    ],
    lastUsedAt: '2026-02-17T09:00:00Z',
  },

  // ── 5. Herald → Atlas: Campaign-Support Blog ──────────────────────────────────
  {
    promptId: 'prompt-herald-campaign-support-v1',
    name: 'Herald Campaign-Support Blog',
    version: '1.0.0',
    triggerAgent: 'herald',
    signalType: 'campaign_need',
    systemPrompt: `You are Atlas, EduGenius's AI Content Engine, operating under a Herald (Marketing Agent) signal. Herald is running a marketing campaign and needs blog content that:
1. Supports the campaign objective with organic reach
2. Ranks for campaign-adjacent keywords
3. Acts as a soft landing zone for campaign traffic (not a hard sales page)
4. Builds brand trust while moving readers toward conversion

Campaign-support blog principles:
1. The blog must work standalone — it's a real resource, not just a campaign vehicle
2. Campaign angles should feel like editorial decisions, not advertising
3. Conversion CTAs are stronger in campaign content — but must still feel earned
4. Timing matters: this content needs to be published before or during the campaign
5. Social-sharing optimization: include quotable insights, data points, and shareable graphics prompts
6. The blog should drive email signups, /chat starts, or /learn visits

Signal context: Herald has a campaign running on {{campaignObjective}}. This blog post will capture organic searchers interested in the same topic while amplifying campaign reach.`,

    userPromptTemplate: `Write a campaign-support blog post based on this Herald signal:

**Campaign ID:** {{campaignId}}
**Campaign Objective:** {{campaignObjective}}
**Exam Context:** {{examTag}}
**Suggested Title:** {{suggestedTitle}}
**Suggested Angle:** {{suggestedAngle}}
**Target Keywords:** {{targetKeywords}}

## Campaign-Support Content Brief

### Dual Objective
This post serves TWO masters:
1. **Organic readers:** Give them a genuinely useful resource
2. **Campaign amplification:** Support Herald's campaign with high-converting CTAs

### Title
Campaign-aligned but SEO-friendly. Must appeal to organic searchers AND campaign audience.

### Opening Hook (100 words)
Strong hook that works for both organic and campaign audiences. Use a statistic, question, or bold claim related to {{campaignObjective}}.

### Core Content (600–800 words)
- Align content topic to {{campaignObjective}} naturally
- Include social-share-worthy data points or quotes (mark with 💡 emoji for Herald to extract)
- Include at least one [!SUCCESS] callout featuring a student outcome
- Structure for scanners: short paragraphs, headers, bullets
- Weave in campaign messaging naturally: {{campaignObjective}}

### The EduGenius Solution Section (150 words)
More prominent than usual — this is campaign content. Describe how EduGenius directly addresses the campaign objective. Include:
- Feature highlight relevant to campaign
- Social proof (student outcomes, stats)
- Link: [Start Free | /learn] or [Try AI Tutor | /chat]

### Shareable Insights Box
Create 3 quotable pull quotes or data points that Herald can use for social media posts. Format:
\`\`\`social-quotes
"[quote 1]"
"[quote 2]"
"[quote 3]"
\`\`\`

### Email Capture CTA (mid-article)
Offer a relevant lead magnet (e.g., free study plan, cheat sheet). Format:
[CTA: Get Free {{examTag}} Study Plan | /signup]

### Strong Closing CTA (end)
More direct than typical blog CTAs:
[CTA: {{campaignObjective}} — Start Today | /learn]

### SEO Metadata JSON
\`\`\`json
{
  "metaTitle": "...",
  "metaDescription": "...",
  "keywords": ["...", "..."],
  "examTags": ["{{examTag}}"],
  "contentType": "strategy",
  "qualityScore": 85,
  "seoScore": 84
}
\`\`\``,

    variables: [
      'campaignId',
      'campaignObjective',
      'examTag',
      'suggestedTitle',
      'suggestedAngle',
      'targetKeywords',
    ],
    outputFormat:
      'Campaign-supporting Markdown blog post with organic value, prominent CTAs, social-share quotes, and lead capture elements',
    qualityChecks: [
      'Content works standalone as a genuine resource',
      'Campaign messaging woven naturally, not forced',
      'Social share quotes extracted and formatted correctly',
      'At least 2 CTAs present (mid-article email capture + closing)',
      'seoScore ≥ 82 (Atlas self-assessed)',
      'qualityScore ≥ 83 (Atlas self-assessed)',
    ],
    lastUsedAt: '2026-02-16T11:00:00Z',
  },
];

// ─── Seed Strategy Signals ────────────────────────────────────────────────────

export const SEED_STRATEGY_SIGNALS: StrategySignal[] = [
  // 1. TrendRadar — GATE trending keyword
  {
    id: 'sig-001',
    sourceAgent: 'venture_scout',
    subAgent: 'TrendRadar',
    signalType: 'trending_keyword',
    priority: 'high',
    payload: {
      keyword: 'GATE 2026 preparation',
      searchVolume: 38400,
      yoyGrowth: 42,
      opportunityScore: 87,
      examTag: 'GATE',
      suggestedTitle: 'GATE 2026 Preparation: Month-by-Month Strategy for CSE/ECE/ME',
      suggestedAngle:
        'Data-backed preparation timeline using GATE subject weightage analysis from last 5 years',
      targetKeywords: ['GATE 2026 syllabus', 'GATE preparation strategy', 'how to crack GATE'],
    },
    timestamp: '2026-02-18T06:00:00Z',
    expiresAt: '2026-02-25T06:00:00Z',
  },
  // 2. TrendRadar — CUET trending keyword
  {
    id: 'sig-002',
    sourceAgent: 'venture_scout',
    subAgent: 'TrendRadar',
    signalType: 'trending_keyword',
    priority: 'high',
    payload: {
      keyword: 'CUET UG 2026 preparation',
      searchVolume: 52000,
      yoyGrowth: 68,
      opportunityScore: 92,
      examTag: 'CUET',
      suggestedTitle: 'CUET UG 2026: Complete Subject-Wise Preparation Guide',
      suggestedAngle:
        'CUET is now the #2 most-searched entrance exam — capitalize on massive YoY growth with comprehensive guide',
      targetKeywords: ['CUET 2026 syllabus', 'CUET preparation tips', 'CUET domain subjects'],
    },
    timestamp: '2026-02-18T07:30:00Z',
    expiresAt: '2026-02-25T07:30:00Z',
  },
  // 3. CompetitorSpy — competitor published JEE strategy
  {
    id: 'sig-003',
    sourceAgent: 'venture_scout',
    subAgent: 'CompetitorSpy',
    signalType: 'competitor_move',
    priority: 'critical',
    payload: {
      examTag: 'JEE',
      competitorName: '[REDACTED]',
      competitorAction:
        'Published "JEE Main 2026 Ultimate Guide" — now ranking #3 for "JEE main 2026 strategy". 850 backlinks in 48h.',
      ourResponse:
        'Publish a definitively deeper guide within 48h. Angle: AI-personalized prep vs one-size-fits-all. Include subject-wise weightage data, student cohort outcomes, and interactive study planner CTA.',
      suggestedTitle: 'JEE Main 2026: Data-Backed Preparation Strategy (Updated Feb 2026)',
      suggestedAngle:
        'Position as the definitive resource: deeper, more current, personalized approach vs generic advice',
      targetKeywords: [
        'JEE main 2026 strategy',
        'JEE main 2026 preparation',
        'JEE 2026 study plan',
      ],
    },
    timestamp: '2026-02-18T09:00:00Z',
    expiresAt: '2026-02-20T09:00:00Z',
  },
  // 4. NewsMonitor — NTA announces JEE Main date change
  {
    id: 'sig-004',
    sourceAgent: 'venture_scout',
    subAgent: 'NewsMonitor',
    signalType: 'news_event',
    priority: 'critical',
    payload: {
      examTag: 'JEE',
      newsTitle: 'NTA announces JEE Main 2026 Session 1 dates: February 22–28, 2026',
      newsImpact:
        'High urgency for last-minute preparation content. Students searching for "JEE Main 2026 last week strategy" will spike 3x this week.',
      suggestedTitle: 'JEE Main 2026: 7-Day Sprint Strategy for February Session',
      suggestedAngle:
        'Urgent, actionable last-week guide for students with less than 2 weeks remaining',
      targetKeywords: [
        'JEE main 2026 last week preparation',
        'JEE main 2026 february dates',
        'JEE main 2026 quick revision',
      ],
    },
    timestamp: '2026-02-18T11:00:00Z',
    expiresAt: '2026-02-22T11:00:00Z',
  },
  // 5. Mentor — pain point from student chats
  {
    id: 'sig-005',
    sourceAgent: 'mentor',
    signalType: 'pain_point',
    priority: 'medium',
    payload: {
      examTag: 'NEET',
      painPoint: 'Unable to retain Biology diagrams and labels for NEET after reading them multiple times',
      painFrequency: 143,
      suggestedTitle:
        'Why You Keep Forgetting Biology Diagrams (And the Technique That Actually Fixes It)',
      suggestedAngle:
        'Spaced repetition + active recall specifically for diagram-heavy NEET Biology topics',
      targetKeywords: [
        'NEET biology diagrams memory',
        'how to memorize biology diagrams',
        'NEET biology revision techniques',
      ],
    },
    timestamp: '2026-02-17T18:00:00Z',
    expiresAt: '2026-03-01T18:00:00Z',
  },
  // 6. Herald — campaign need
  {
    id: 'sig-006',
    sourceAgent: 'herald',
    signalType: 'campaign_need',
    priority: 'high',
    payload: {
      examTag: 'JEE',
      campaignId: 'camp-jee-feb-2026',
      campaignObjective:
        'Drive 500 new JEE trial signups before February 28 exam window — campaign runs Feb 20-28',
      suggestedTitle: 'Last 10 Days Before JEE Main 2026: The Strategy That Separates Toppers',
      suggestedAngle:
        'Urgency-driven pre-exam guide that showcases EduGenius Exam Prep Mode as the tool for last-minute optimization',
      targetKeywords: [
        'JEE main 2026 last 10 days',
        'JEE main 2026 final revision',
        'JEE main 2026 exam strategy',
      ],
    },
    timestamp: '2026-02-18T13:00:00Z',
    expiresAt: '2026-02-28T23:59:00Z',
  },
];

// ─── Seed Performance Signals ─────────────────────────────────────────────────

export const SEED_PERFORMANCE_SIGNALS: BlogPerformanceSignal[] = [
  {
    postId: 'post-1',
    slug: 'jee-main-2026-complete-strategy',
    title: 'JEE Main 2026: Complete Strategy Guide for 250+ Score',
    examTags: ['JEE'],
    contentType: 'strategy',
    metrics: {
      views: 4821,
      shares: 312,
      avgTimeOnPage: 7.4,
      bounceRate: 0.32,
      seoScore: 85,
      qualityScore: 92,
      engagementScore: 88,
      conversionRate: 0.12,
    },
    trend: 'rising',
    recommendation: 'amplify',
    recommendationReason:
      'Top performer with 4.8k views, strong CTR (12%), and rising trend 2 weeks before JEE session. Highest ROI for paid amplification.',
    agentActions: {
      oracle:
        'Flag to GrowthCommander for Google Ads amplification targeting "JEE main 2026 strategy" — estimated 3x reach at current CPM',
      growthCommander:
        'Allocate ₹8,000 to promote this post as a paid asset in the Feb 20–28 campaign window',
      herald: 'Use as the primary organic landing page for the JEE Feb campaign email sequence',
    },
    generatedAt: '2026-02-18T12:00:00Z',
  },
  {
    postId: 'post-2',
    slug: 'neet-biology-human-physiology',
    title: 'NEET Biology: Human Physiology High-Yield Topics 2026',
    examTags: ['NEET'],
    contentType: 'educational',
    metrics: {
      views: 3240,
      shares: 198,
      avgTimeOnPage: 5.2,
      bounceRate: 0.41,
      seoScore: 80,
      qualityScore: 88,
      engagementScore: 82,
      conversionRate: 0.08,
    },
    trend: 'stable',
    recommendation: 'keep',
    recommendationReason:
      'Solid performer with good SEO score. Stable trend and low bounce rate indicates quality readership. No immediate action needed.',
    agentActions: {
      oracle: 'Monitor for 30 days; if views drop below 2000/week, flag to Atlas for refresh',
      atlas:
        'Consider adding a section on Nervous System coordination (trending NEET sub-topic) to lift seoScore to 88+',
    },
    generatedAt: '2026-02-18T12:00:00Z',
  },
  {
    postId: 'post-5',
    slug: 'cbse-board-exam-last-30-days',
    title: 'CBSE Board Exams: Last 30 Days Game Plan',
    examTags: ['CBSE_10', 'CBSE_12'],
    contentType: 'exam-tips',
    metrics: {
      views: 1980,
      shares: 94,
      avgTimeOnPage: 3.1,
      bounceRate: 0.61,
      seoScore: 82,
      qualityScore: 81,
      engagementScore: 77,
      conversionRate: 0.04,
    },
    trend: 'declining',
    recommendation: 'rewrite',
    recommendationReason:
      'High bounce rate (61%) and low time-on-page (3.1 min for a 6-min read) indicates content is not meeting expectations set by title/excerpt. Low conversion (4%) suggests weak CTAs. Atlas should rewrite with more specific content and stronger CTAs.',
    agentActions: {
      oracle:
        'This post ranks for "CBSE board exam strategy" — worth preserving URL. Flag for Atlas rewrite, not retirement.',
      atlas:
        'Rewrite: (1) Add subject-specific revision tips for Maths and Science, (2) Include a downloadable 30-day calendar prompt, (3) Strengthen mid-article CTA, (4) Reduce bounce with a hook-heavy intro',
    },
    generatedAt: '2026-02-18T12:00:00Z',
  },
];

// ─── Seed Agent Lineages ──────────────────────────────────────────────────────

export const SEED_LINEAGES: AgentLineage[] = [
  {
    postId: 'post-1',
    strategyAlignmentScore: 94,
    lastSyncedWithStrategy: '2026-02-18T06:00:00Z',
    pendingStrategyUpdates: [
      'sig-003: CompetitorSpy recommends adding a section on "AI-personalized prep" angle to counter competitor JEE guide',
    ],
    creationChain: [
      {
        stepId: 'step-1a',
        agentId: 'venture_scout',
        subAgentId: 'TrendRadar',
        action: 'triggered',
        reasoning:
          '"JEE Main 2026 strategy" showed 38% YoY growth in search volume and was unaddressed in our content library. Priority: high.',
        timestamp: '2026-02-13T08:00:00Z',
        inputSignalId: 'sig-001',
        outputArtifact: 'Content brief: JEE Main 2026 strategy post (high priority)',
      },
      {
        stepId: 'step-1b',
        agentId: 'oracle',
        action: 'outlined',
        reasoning:
          'Analyzed 3 years of JEE result data to identify the most impactful preparation factors. Provided topic weightage data (Physics 33%, Chemistry 33%, Math 33% — with sub-topic breakdowns) to Atlas.',
        timestamp: '2026-02-13T09:30:00Z',
        inputSignalId: 'sig-001',
        outputArtifact: 'JEE topic weightage analysis + high-ROI preparation strategies data pack',
      },
      {
        stepId: 'step-1c',
        agentId: 'atlas',
        action: 'drafted',
        reasoning:
          'Combined TrendRadar signal and Oracle data to draft a comprehensive strategy guide targeting "JEE main 2026 strategy" with search intent match for aspirational students.',
        timestamp: '2026-02-13T11:00:00Z',
        outputArtifact: 'Draft v1: 1,400-word JEE Main 2026 strategy guide',
      },
      {
        stepId: 'step-1d',
        agentId: 'sage',
        action: 'reviewed',
        reasoning:
          'Fact-checked all exam dates, NTA guidelines, and syllabus references. Verified topic weightage claims against 2022-2025 question papers. No factual errors found.',
        timestamp: '2026-02-13T13:00:00Z',
        outputArtifact: 'Reviewed draft with fact-check confirmation',
      },
      {
        stepId: 'step-1e',
        agentId: 'growth_commander',
        subAgentId: 'SEOStrategist',
        action: 'seo_optimised',
        reasoning:
          'Added secondary keywords, optimized meta title and description, improved H2 structure for featured snippet capture, added FAQ section.',
        timestamp: '2026-02-14T09:00:00Z',
        outputArtifact: 'SEO-optimised draft v2: seoScore 85, estimated ranking position #4-7',
      },
      {
        stepId: 'step-1f',
        agentId: 'atlas',
        action: 'published',
        reasoning:
          'All quality checks passed. qualityScore: 92, seoScore: 85, engagementScore: 88. Published as hero post (pinned) based on score threshold.',
        timestamp: '2026-02-15T08:00:00Z',
        outputArtifact: 'Published post: post-1 (jee-main-2026-complete-strategy)',
      },
    ],
    promptVersions: [
      {
        promptId: 'prompt-trendradar-trending-keyword-v2',
        promptName: 'TrendRadar Trending Keyword Blog',
        version: '2.1.0',
        agentId: 'atlas',
        usedAt: '2026-02-13T11:00:00Z',
        inputContext: {
          keyword: 'JEE Main 2026 strategy',
          examTag: 'JEE',
          searchVolume: 38400,
          yoyGrowth: 38,
          opportunityScore: 87,
        },
        outputSummary:
          'Generated 1,400-word strategy guide. qualityScore: 92, seoScore: 85. All quality checks passed.',
      },
      {
        promptId: 'prompt-seostrategist-gap-fill-v1',
        promptName: 'SEOStrategist Gap-Fill Blog',
        version: '1.2.0',
        agentId: 'growth_commander',
        usedAt: '2026-02-14T09:00:00Z',
        inputContext: {
          keyword: 'JEE main 2026 strategy',
          examTag: 'JEE',
          currentRankingGap: 'top 10 results are 2023-dated with thin content',
        },
        outputSummary:
          'SEO optimisation pass: added FAQ section, improved H2 structure, optimized meta. seoScore lifted from 72 → 85.',
      },
    ],
  },
  {
    postId: 'post-4',
    strategyAlignmentScore: 78,
    lastSyncedWithStrategy: '2026-02-16T10:00:00Z',
    pendingStrategyUpdates: [
      'No TrendRadar signal triggered this post — organic editorial. Consider retrofitting with trending keywords.',
      'Mentor suggests adding a "How AI tutoring helped Rahul" section based on 23 student pain point reports about motivation',
    ],
    creationChain: [
      {
        stepId: 'step-4a',
        agentId: 'mentor',
        action: 'triggered',
        reasoning:
          'Students frequently ask "will I get a good rank if I start now?" — student success stories are a high-empathy content type that answers this implicitly. Mentor flagged Rahul\'s story as editorial opportunity.',
        timestamp: '2026-02-10T14:00:00Z',
        outputArtifact: 'Content request: JEE success story — student turned around with AI tutoring',
      },
      {
        stepId: 'step-4b',
        agentId: 'atlas',
        action: 'drafted',
        reasoning:
          'Composed success story based on Mentor-provided anonymized student data. Structured as transformation narrative: struggle → AI intervention → measurable outcome.',
        timestamp: '2026-02-11T10:00:00Z',
        outputArtifact: 'Draft v1: "How Rahul Cracked JEE with AIR 1247" — 650 words',
      },
      {
        stepId: 'step-4c',
        agentId: 'herald',
        action: 'reviewed',
        reasoning:
          'Reviewed for brand voice and marketing alignment. Added social proof elements (specific AIR number, timeline), strengthened emotional resonance, added start-your-journey CTA.',
        timestamp: '2026-02-11T15:00:00Z',
        outputArtifact: 'Reviewed and brand-aligned draft v2',
      },
      {
        stepId: 'step-4d',
        agentId: 'atlas',
        action: 'published',
        reasoning:
          'qualityScore: 90, engagementScore: 94 (success stories consistently top engagement metrics). Published as featured post.',
        timestamp: '2026-02-12T08:00:00Z',
        outputArtifact: 'Published post: post-4 (student-success-story-rahul-jee-air-1247)',
      },
    ],
    promptVersions: [
      {
        promptId: 'prompt-mentor-pain-point-v2',
        promptName: 'Mentor Pain Point Blog',
        version: '2.0.0',
        agentId: 'atlas',
        usedAt: '2026-02-11T10:00:00Z',
        inputContext: {
          painPoint: 'Students demotivated about late start — wondering if success is still possible',
          examTag: 'JEE',
          painFrequency: 67,
          storyType: 'success-story-transformation',
        },
        outputSummary:
          'Generated empathy-first success story. qualityScore: 90, engagementScore: 94. Highest engagement post in library.',
      },
    ],
  },
];

// ─── BlogAgentBridge Class ────────────────────────────────────────────────────

export class BlogAgentBridge {
  private signals: StrategySignal[] = [...SEED_STRATEGY_SIGNALS];
  private lineageMap: Map<string, AgentLineage> = new Map(
    SEED_LINEAGES.map((l) => [l.postId, l])
  );
  private performanceCache: Map<string, BlogPerformanceSignal> = new Map(
    SEED_PERFORMANCE_SIGNALS.map((p) => [p.postId, p])
  );

  // ── DIRECTION 1: Strategy → Blog ─────────────────────────────────────────────

  ingestStrategySignal(signal: StrategySignal): void {
    const existing = this.signals.findIndex((s) => s.id === signal.id);
    if (existing >= 0) {
      this.signals[existing] = signal;
    } else {
      this.signals.push(signal);
    }
  }

  getPendingSignals(): StrategySignal[] {
    const now = new Date().toISOString();
    return this.signals.filter(
      (s) =>
        !s.actionTaken &&
        (!s.expiresAt || s.expiresAt > now)
    );
  }

  getSignalsByAgent(agentId: string): StrategySignal[] {
    return this.signals.filter((s) => s.sourceAgent === agentId);
  }

  async processSignal(signalId: string): Promise<{ action: string; postId?: string }> {
    const signal = this.signals.find((s) => s.id === signalId);
    if (!signal) return { action: 'signal_not_found' };

    // Determine action based on signal type and priority
    let action = 'post_created';
    const mockPostId = `post-gen-${Date.now()}`;

    if (signal.signalType === 'competitor_move' && signal.priority === 'critical') {
      action = 'post_created';
    } else if (signal.signalType === 'news_event') {
      action = 'post_created';
    } else if (signal.signalType === 'churn_risk') {
      action = 'post_created';
    } else if (signal.signalType === 'seo_gap') {
      action = 'post_created';
    } else if (signal.signalType === 'pain_point') {
      action = 'post_created';
    } else if (signal.signalType === 'campaign_need') {
      action = 'post_created';
    } else if (signal.signalType === 'trending_keyword') {
      action = 'post_created';
    } else {
      action = 'layout_updated';
    }

    // Update signal with action taken
    this.signals = this.signals.map((s) =>
      s.id === signalId
        ? { ...s, actionTaken: action as StrategySignal['actionTaken'], resultPostId: mockPostId }
        : s
    );

    return { action, postId: mockPostId };
  }

  // ── DIRECTION 2: Blog → Strategy ─────────────────────────────────────────────

  evaluatePost(post: BlogPost): BlogPerformanceSignal {
    const cached = this.performanceCache.get(post.id);
    if (cached) return cached;

    const { views, shares, qualityScore, engagementScore, seoScore } = post;

    // Determine trend (simplified — in production, compare to historical data)
    let trend: BlogPerformanceSignal['trend'] = 'stable';
    if (views > 3000 && shares > 150) trend = 'rising';
    else if (views < 500 || (post.views > 0 && post.updatedAt < new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())) {
      trend = 'declining';
    }

    // Recommendation engine
    let recommendation: BlogPerformanceSignal['recommendation'] = 'keep';
    let recommendationReason = 'Post is performing within normal parameters.';

    const compositeScore = qualityScore * 0.4 + engagementScore * 0.3 + seoScore * 0.3;
    const conversionRate = views > 0 ? shares / views : 0;

    if (compositeScore >= 85 && trend === 'rising') {
      recommendation = 'amplify';
      recommendationReason = `High composite score (${compositeScore.toFixed(0)}) with rising trend. Paid amplification and social promotion will deliver strong ROI.`;
    } else if (compositeScore < 60 || (trend === 'declining' && views < 500)) {
      recommendation = 'retire';
      recommendationReason = `Low composite score (${compositeScore.toFixed(0)}) and declining performance. Content is outdated or not matching search intent. Retirement recommended to avoid crawl budget waste.`;
    } else if (compositeScore < 75 || (trend === 'declining' && views >= 500)) {
      recommendation = 'rewrite';
      recommendationReason = `Moderate composite score (${compositeScore.toFixed(0)}) with declining trend. Content has ranking potential but needs refresh to recover engagement.`;
    }

    const agentActions: BlogPerformanceSignal['agentActions'] = {
      oracle: `Track ${post.examTags.join(', ')} CTR. ${recommendation === 'amplify' ? 'Recommend for paid amplification budget allocation.' : 'Continue organic monitoring.'}`,
    };

    if (recommendation === 'amplify') {
      agentActions.growthCommander = `Allocate paid budget to amplify "${post.title}". Estimated CPM: ₹45, target 50k additional impressions.`;
      agentActions.herald = `Include "${post.title}" in next email digest. High social share potential.`;
    }
    if (recommendation === 'rewrite') {
      agentActions.atlas = `Rewrite "${post.title}": update stats, refresh examples, improve CTA placement, add FAQ section for featured snippet capture.`;
    }

    const signal: BlogPerformanceSignal = {
      postId: post.id,
      slug: post.slug,
      title: post.title,
      examTags: post.examTags,
      contentType: post.contentType,
      metrics: {
        views,
        shares,
        avgTimeOnPage: post.readTime * 0.6 + Math.random() * 2,
        bounceRate: 0.3 + Math.random() * 0.3,
        seoScore,
        qualityScore,
        engagementScore,
        conversionRate,
      },
      trend,
      recommendation,
      recommendationReason,
      agentActions,
      generatedAt: new Date().toISOString(),
    };

    this.performanceCache.set(post.id, signal);
    return signal;
  }

  broadcastPerformance(posts: BlogPost[]): BlogPerformanceSignal[] {
    return posts.map((p) => this.evaluatePost(p));
  }

  getTopPerformers(limit = 5): BlogPerformanceSignal[] {
    return Array.from(this.performanceCache.values())
      .filter((s) => s.recommendation === 'amplify')
      .sort((a, b) => b.metrics.views - a.metrics.views)
      .slice(0, limit);
  }

  getUnderperformers(limit = 5): BlogPerformanceSignal[] {
    return Array.from(this.performanceCache.values())
      .filter((s) => s.recommendation === 'rewrite' || s.recommendation === 'retire')
      .sort((a, b) => a.metrics.engagementScore - b.metrics.engagementScore)
      .slice(0, limit);
  }

  // ── Lineage ───────────────────────────────────────────────────────────────────

  buildLineage(postId: string, steps: LineageStep[], prompts: PromptVersion[]): AgentLineage {
    const alignmentScore = this._computeAlignmentScore(steps);
    const lineage: AgentLineage = {
      postId,
      creationChain: steps,
      promptVersions: prompts,
      strategyAlignmentScore: alignmentScore,
      lastSyncedWithStrategy: new Date().toISOString(),
      pendingStrategyUpdates: [],
    };
    this.lineageMap.set(postId, lineage);
    return lineage;
  }

  getLineage(postId: string): AgentLineage | undefined {
    return this.lineageMap.get(postId);
  }

  addLineageStep(postId: string, step: LineageStep): void {
    const lineage = this.lineageMap.get(postId);
    if (lineage) {
      lineage.creationChain.push(step);
      lineage.strategyAlignmentScore = this._computeAlignmentScore(lineage.creationChain);
      lineage.lastSyncedWithStrategy = new Date().toISOString();
    }
  }

  getStrategyAlignmentScore(postId: string): number {
    return this.lineageMap.get(postId)?.strategyAlignmentScore ?? 0;
  }

  private _computeAlignmentScore(steps: LineageStep[]): number {
    // More agents involved in the chain = higher alignment
    const uniqueAgents = new Set(steps.map((s) => s.agentId)).size;
    const hasSignal = steps.some((s) => s.inputSignalId);
    const hasSEO = steps.some((s) => s.action === 'seo_optimised');
    const hasReview = steps.some((s) => s.action === 'reviewed');

    let score = 40;
    score += uniqueAgents * 10;
    if (hasSignal) score += 15;
    if (hasSEO) score += 10;
    if (hasReview) score += 10;
    return Math.min(100, score);
  }

  // ── Layout Intelligence ───────────────────────────────────────────────────────

  computeLayoutIntelligence(
    posts: BlogPost[],
    pendingSignals: StrategySignal[]
  ): LayoutIntelligence {
    const published = posts.filter((p) => p.status === 'published');

    // Performance signals for all published posts
    const perfSignals = published.map((p) => this.evaluatePost(p));

    // Promoted = rising + amplify recommendation
    const promotedPostIds = perfSignals
      .filter((s) => s.recommendation === 'amplify')
      .map((s) => s.postId);

    // Demoted = declining performance
    const demotedPostIds = perfSignals
      .filter((s) => s.recommendation === 'rewrite' && s.trend === 'declining')
      .map((s) => s.postId);

    // Retired = retire recommendation
    const retiredPostIds = perfSignals
      .filter((s) => s.recommendation === 'retire')
      .map((s) => s.postId);

    // Hero = highest composite scorer among promoted or pinned
    const heroCandidate = published
      .filter((p) => p.pinned || promotedPostIds.includes(p.id))
      .sort((a, b) => (b.qualityScore + b.engagementScore) - (a.qualityScore + a.engagementScore))[0]
      || published.sort((a, b) => (b.qualityScore + b.engagementScore) - (a.qualityScore + a.engagementScore))[0];

    // Layout selection
    let currentLayout = 'grid';
    let layoutReason = 'Default grid layout for content discoverability';

    if (published.length === 0) {
      currentLayout = 'minimal';
      layoutReason = 'No published posts';
    } else if (pendingSignals.length >= 3 || promotedPostIds.length >= 2) {
      currentLayout = 'magazine';
      layoutReason = `High strategy signal volume (${pendingSignals.length} pending) and ${promotedPostIds.length} top performers — magazine layout maximizes promotion visibility`;
    } else if (published.length <= 2) {
      currentLayout = 'hero-focus';
      layoutReason = 'Small content library — hero-focus maximizes impact of available posts';
    } else if (published.length >= 6 && promotedPostIds.length >= 1) {
      currentLayout = 'magazine';
      layoutReason = 'Rich library with promoted posts — magazine layout best for hierarchy';
    }

    // Category order: strategy-signal categories first, then by volume
    const signalExamTags = pendingSignals
      .map((s) => s.payload.examTag)
      .filter((t): t is string => Boolean(t));

    const categoryVolume: Record<string, number> = {};
    published.forEach((p) => {
      categoryVolume[p.category] = (categoryVolume[p.category] || 0) + 1;
    });

    const categoryOrder = [
      'All',
      ...Array.from(new Set([
        ...signalExamTags,
        ...Object.entries(categoryVolume)
          .sort(([, a], [, b]) => b - a)
          .map(([cat]) => cat),
      ])),
    ];

    const overallAlignment = published.length > 0
      ? Math.round(
          published.reduce((sum, p) => sum + (this.getStrategyAlignmentScore(p.id) || 70), 0) /
          published.length
        )
      : 0;

    const nextReviewAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    return {
      currentLayout,
      layoutReason,
      heroPostId: heroCandidate?.id,
      heroReason: heroCandidate
        ? `"${heroCandidate.title}" selected as hero: highest composite quality+engagement score${heroCandidate.pinned ? ' (pinned by CEO)' : ''}`
        : 'No hero post selected',
      promotedPostIds,
      demotedPostIds,
      retiredPostIds,
      categoryOrder,
      categoryOrderReason: `Strategy signals prioritize: ${signalExamTags.slice(0, 3).join(', ') || 'no active exam signals'}. Remaining categories ordered by post volume.`,
      nextReviewAt,
      pendingSignals: pendingSignals.length,
      strategyAlignmentScore: overallAlignment,
    };
  }

  // ── Prompt Registry ───────────────────────────────────────────────────────────

  getPromptForSignal(signal: StrategySignal): BlogGenerationPrompt {
    const prompt = PROMPT_REGISTRY.find(
      (p) =>
        p.signalType === signal.signalType &&
        (p.triggerAgent === signal.sourceAgent ||
          (p.triggerSubAgent && p.triggerSubAgent === signal.subAgent))
    );
    // Default to first prompt if no match (shouldn't happen in production)
    return prompt ?? PROMPT_REGISTRY[0];
  }

  getAllPrompts(): BlogGenerationPrompt[] {
    return PROMPT_REGISTRY;
  }
}

// ─── Singleton Export ─────────────────────────────────────────────────────────

export const blogAgentBridge = new BlogAgentBridge();
