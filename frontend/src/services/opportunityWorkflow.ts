/**
 * opportunityWorkflow.ts
 *
 * Phase 0: Opportunity Discovery Workflow
 * Runs BEFORE the Exam Creation Wizard to identify WHAT to build next.
 *
 * 12 steps across 4 phases:
 *   Phase A: External Intelligence Gathering (parallel)
 *   Phase B: Audience & Demand Synthesis
 *   Phase C: Business Case Generation (CEO gate)
 *   Phase D: Pre-Launch Preparation Signal
 */

export type OppStepCategory = 'research' | 'analysis' | 'decision' | 'planning';
export type OppStepExecution = 'sequential' | 'parallel' | 'conditional';

export interface OppStep {
  id: string;
  phase: number;
  phaseLabel: string;
  agentId: string;
  agentName: string;
  agentEmoji: string;
  action: string;
  category: OppStepCategory;
  execution: OppStepExecution;
  parallelWith?: string[];
  externalConnections: string[];
  estimatedMs: number;
  requiresCEOApproval?: boolean;
  description: string;
  subAgentsInvolved: string[];
  sampleOutput: (examHint?: string) => string;
}

export const OPPORTUNITY_PHASES = [
  { phase: 1, label: 'External Intelligence', emoji: '📡', color: 'text-blue-400', stepCount: 3 },
  { phase: 2, label: 'Audience & Demand Synthesis', emoji: '🎯', color: 'text-purple-400', stepCount: 2 },
  { phase: 3, label: 'Business Case + CEO Gate', emoji: '💰', color: 'text-green-400', stepCount: 4 },
  { phase: 4, label: 'Pre-Launch Prep Signals', emoji: '🚀', color: 'text-orange-400', stepCount: 3 },
];

export const OPPORTUNITY_STEPS: OppStep[] = [

  // ═══════════════════════════════════════════════════════════
  // PHASE A: EXTERNAL INTELLIGENCE GATHERING (parallel)
  // ═══════════════════════════════════════════════════════════

  {
    id: 'external_trend_scan',
    phase: 1, phaseLabel: 'External Intelligence',
    agentId: 'venture_scout', agentName: 'VentureScout', agentEmoji: '🕵️',
    action: 'Brave Search API → Top 20 exam keyword volumes + growth trends',
    category: 'research', execution: 'parallel',
    parallelWith: ['competitor_landscape', 'news_policy_watch'],
    externalConnections: ['Brave Search API', 'Google Trends (scrape)'],
    estimatedMs: 6000,
    description: 'TrendRadar queries Brave Search for the top 20 exam keywords in India. Returns: keyword, monthly search volume, YoY growth %, competition score, and opportunity window.',
    subAgentsInvolved: ['TrendRadar'],
    sampleOutput: (exam) => `✅ Trend Scan Complete

📊 TOP EXAM KEYWORDS — INDIA (Feb 2026)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Keyword                         Vol/mo    YoY↑    Opp
"GATE 2026 preparation"        124,000   +34%    🟢 92
"GATE mock test free"           48,200   +41%    🟢 89
"CAT 2026 coaching"            198,000   +18%    🟡 74
"UPSC prelims 2026"            312,000   +12%    🟡 68
"CLAT 2026 preparation"         67,400   +52%    🟢 88
"NDA exam 2026 syllabus"        43,800   +61%    🟢 91
"CDS 2026 preparation"          28,600   +44%    🟢 86
"SSC CGL 2026"                 245,000    +9%    🔴 45
"RBI Grade B 2026"              38,400   +28%    🟡 72

🔥 Trending UP (>40% YoY): CLAT (+52%), NDA (+61%), CDS (+44%), GATE (+41%)
⚠️ Saturated: SSC CGL (Adda247 dominates), IBPS (Oliveboard dominant)

🎯 Scout Recommendation: ${exam || 'GATE / CLAT / NDA'} — highest demand-to-competition ratio`,
  },

  {
    id: 'competitor_landscape',
    phase: 1, phaseLabel: 'External Intelligence',
    agentId: 'venture_scout', agentName: 'VentureScout', agentEmoji: '🕵️',
    action: 'Scan Play Store + Brave Search → Competitor matrix with gaps',
    category: 'research', execution: 'parallel',
    parallelWith: ['external_trend_scan', 'news_policy_watch'],
    externalConnections: ['Brave Search API', 'Play Store scrape'],
    estimatedMs: 7000,
    description: 'CompetitorSpy monitors competitor apps, pricing, ratings, and reviews. Outputs a competitor matrix highlighting weaknesses and unserved segments our platform can own.',
    subAgentsInvolved: ['CompetitorSpy'],
    sampleOutput: () => `✅ Competitor Landscape Mapped

🏆 COMPETITOR MATRIX
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
App             Rating  GATE  CAT  UPSC  AI?  Price   Gap
BYJU's           3.8     ✓     ✓    ✓     ❌   ₹999   No AI explanations
Unacademy        3.9     ✓     ✓    ✓     ❌   ₹799   Generic content
TestBook         4.1     ✓     ✓    ✗     ❌   ₹599   No personalisation
Adda247          4.0     ✓     ✗    ✓     ❌   ₹499   JEE/NEET gap
EduGenius        —      ✓     ✗    ✗     ✅   ₹599   ← We are here

🔍 KEY GAPS WE CAN OWN:
• AI-powered adaptive mock tests (no competitor has real AI)
• GATE + CLAT + NDA combination plans (nobody bundles these)
• Parent dashboard with child progress (completely absent in market)
• Vernacular language support — Hindi explanations demanded in reviews

⚠️ Watch: Unacademy announced AI feature launch for Q2 2026
🟢 Opportunity: Be the AI-first platform before competitors catch up`,
  },

  {
    id: 'news_policy_watch',
    phase: 1, phaseLabel: 'External Intelligence',
    agentId: 'venture_scout', agentName: 'VentureScout', agentEmoji: '🕵️',
    action: 'NTA/CBSE/UGC news feeds → Policy changes ranked by business impact',
    category: 'research', execution: 'parallel',
    parallelWith: ['external_trend_scan', 'competitor_landscape'],
    externalConnections: ['Brave Search API', 'NTA official website'],
    estimatedMs: 4000,
    description: 'NewsMonitor tracks exam board announcements, policy changes, and new exam launches from NTA, CBSE, UGC, and education news sources.',
    subAgentsInvolved: ['NewsMonitor'],
    sampleOutput: () => `✅ News & Policy Intelligence

📰 TOP ITEMS RANKED BY BUSINESS IMPACT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Impact  Source  Item
🔴 HIGH  NTA     GATE 2026 registrations open — 14% more candidates YoY
🔴 HIGH  UPSC    UPSC CSE 2026 notification released — 1,129 vacancies
🟡 MED   UGC     UGC NET syllabus revised — new topics added to 18 subjects
🟡 MED   CBSE    CBSE Class 12 board pattern changing for 2027
🟢 LOW   NTA     JEE Main session 2 dates announced (April 2026)

📊 Business Impact Analysis:
• GATE 2026 surge → launch GATE prep in next 60 days (window open)
• UPSC CSE vacancy increase → demand up 18% vs last year
• UGC NET syllabus change → content update needed for existing users
• CBSE 2027 change → preparation window starts NOW (early mover advantage)

🎯 Immediate Action: Publish GATE 2026 preparation guide within 7 days
   (Herald can draft, Atlas can generate questions, SEO will capture registrants)`,
  },

  // ═══════════════════════════════════════════════════════════
  // PHASE B: AUDIENCE & DEMAND SYNTHESIS
  // ═══════════════════════════════════════════════════════════

  {
    id: 'audience_pain_mining',
    phase: 2, phaseLabel: 'Audience & Demand Synthesis',
    agentId: 'venture_scout', agentName: 'VentureScout', agentEmoji: '🕵️',
    action: 'Reddit/Quora/Telegram → Top 10 student pain points with frequency scores',
    category: 'analysis', execution: 'sequential',
    externalConnections: ['Brave Search API'],
    estimatedMs: 8000,
    description: 'AudienceSurveyor analyses Reddit (r/JEEprep, r/UPSC_Mains_Preparation, r/GATEPrep), Quora education, and Telegram groups to surface unmet student needs with willingness-to-pay signals.',
    subAgentsInvolved: ['AudienceSurveyor'],
    sampleOutput: () => `✅ Audience Pain Mining Complete

😤 TOP STUDENT PAIN POINTS (Feb 2026)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Rank  Pain Point                                    Freq  WTP Signal
 1    "No adaptive mock test that matches real UI"   623   "Would pay ₹999/mo"
 2    "Explanations are copy-paste, no intuition"    518   "Need visual + story"
 3    "Can't track weak topics across sessions"      497   "Core feature I need"
 4    "Study plan changes but platform doesn't"      441   "Miss personalisation"
 5    "Parents ask for progress — hard to share"     389   "Family plan interest"
 6    "No Hindi explanations for GATE CE topics"     334   "Vernacular demand"
 7    "Previous year papers not linked to theory"    312   "Integrated learning"
 8    "Practice problems too easy or too hard"       298   "Adaptive difficulty"
 9    "No live doubt solving after 10pm"             276   "Night-owl students"
10    "No prediction of exam score based on mocks"   241   "Outcome forecasting"

🎯 Insight: Top 3 pains are EXACTLY what EduGenius AI solves
   → Positioning: "The only platform that learns how YOU learn"
   → Feature priority: adaptive mocks > AI explanations > progress tracking`,
  },

  {
    id: 'demand_synthesis',
    phase: 2, phaseLabel: 'Audience & Demand Synthesis',
    agentId: 'oracle', agentName: 'Oracle', agentEmoji: '📊',
    action: 'Oracle synthesises Phase A+B into ranked opportunity list (top 5)',
    category: 'analysis', execution: 'sequential',
    externalConnections: [],
    estimatedMs: 5000,
    description: 'Oracle synthesises all Phase A and B data into a ranked opportunity list. Returns top 5 exam opportunities scored across 4 dimensions: demand, competition gap, revenue potential, platform readiness.',
    subAgentsInvolved: ['Oracle'],
    sampleOutput: () => `✅ Demand Synthesis — Top 5 Opportunities

🏆 RANKED OPPORTUNITY MATRIX
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Rank  Exam   Demand  Gap  Revenue  Readiness  SCORE  12M Forecast
 1    GATE     88     82     85        72      82/100  ₹38L/mo
 2    NDA      82     90     68        85      81/100  ₹19L/mo
 3    CLAT     78     88     74        80      80/100  ₹22L/mo
 4    CAT      91     68     92        65      79/100  ₹42L/mo
 5    UPSC     94     55     88        58      74/100  ₹51L/mo

📊 Scoring methodology:
• Demand: search volume + YoY growth + aspirant pool size
• Gap: competitor weaknesses + underserved features + pricing gap
• Revenue: willingness-to-pay × addressable market × conversion estimate
• Readiness: content available × Forge effort × time-to-market

🎯 Oracle Recommendation: Launch GATE next
   • Highest compound score (82/100)
   • Registration window open NOW (time-sensitive)
   • Low competitive AI presence
   • Platform content partially ready (Physics/Math overlap with JEE)`,
  },

  // ═══════════════════════════════════════════════════════════
  // PHASE C: BUSINESS CASE + CEO GATE
  // ═══════════════════════════════════════════════════════════

  {
    id: 'revenue_projections',
    phase: 3, phaseLabel: 'Business Case + CEO Gate',
    agentId: 'revenue_architect', agentName: 'RevenueArchitect', agentEmoji: '💰',
    action: 'Build 12-month P&L projections for each opportunity',
    category: 'analysis', execution: 'sequential',
    externalConnections: [],
    estimatedMs: 6000,
    description: 'RevenueArchitect.RevenueForecaster builds detailed 12-month P&L projections for the top 3 opportunities. Includes CAC estimates, conversion assumptions, churn rates, and break-even timelines.',
    subAgentsInvolved: ['RevenueForecaster', 'LTVOptimiser'],
    sampleOutput: () => `✅ Revenue Projections — Top 3 Opportunities

💰 12-MONTH P&L PROJECTIONS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
GATE PREP
  Month 1–3 (ramp):  ₹2.8L   (280 students @ ₹999)
  Month 4–6:         ₹8.4L   (840 students)
  Month 7–12:        ₹21L/mo (2,100 students)
  Year 1 Total:      ₹1.8Cr
  Investment needed: ₹4.2L (content + marketing)
  Break-even:        Month 3
  LTV estimate:      ₹2,800 (9.3 month avg)

NDA PREP
  Year 1 Total:      ₹82L
  Investment needed: ₹2.1L
  Break-even:        Month 2 (lower competition = faster traction)
  LTV estimate:      ₹2,100

CLAT PREP
  Year 1 Total:      ₹1.1Cr
  Investment needed: ₹3.8L
  Break-even:        Month 3
  LTV estimate:      ₹3,200 (high-income aspirants)

📊 ROI Ranking: NDA (fastest) > GATE (highest year-1) > CLAT (highest LTV)`,
  },

  {
    id: 'ceo_opportunity_gate',
    phase: 3, phaseLabel: 'Business Case + CEO Gate',
    agentId: 'oracle', agentName: 'Oracle', agentEmoji: '📊',
    action: 'CEO reviews opportunity matrix and selects exam(s) to pursue',
    category: 'decision', execution: 'conditional',
    requiresCEOApproval: true,
    externalConnections: [],
    estimatedMs: 0,
    description: 'CEO reviews the full opportunity matrix — demand analysis, competitor gaps, revenue projections — and selects which exam(s) to build next. This decision gates the pre-launch preparation phase.',
    subAgentsInvolved: [],
    sampleOutput: (exam) => `👔 CEO Decision Required

Please review the opportunity analysis and select:
1. Which exam(s) to pursue
2. Launch timeline (30-day sprint vs 60-day full build)
3. Pilot (50 students) or Full Launch (unlimited)

Selected: ${exam || '[awaiting CEO input]'}`,
  },

  {
    id: 'blue_ocean_check',
    phase: 3, phaseLabel: 'Business Case + CEO Gate',
    agentId: 'venture_scout', agentName: 'VentureScout', agentEmoji: '🕵️',
    action: 'BluOceanFinder — differentiation angle for chosen exam',
    category: 'analysis', execution: 'sequential',
    externalConnections: [],
    estimatedMs: 4000,
    description: 'BluOceanFinder validates that the chosen exam has a real AI differentiation angle. Returns positioning recommendation, key differentiators vs competitors, and messaging brief for Herald.',
    subAgentsInvolved: ['BluOceanFinder'],
    sampleOutput: (exam) => `✅ Blue Ocean Analysis — ${exam || 'GATE'}

🌊 DIFFERENTIATION STRATEGY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Differentiation Score: 87/100 (Strong Blue Ocean)

Our unique angle: "AI that knows GATE syllabus like an IIT topper"
• Wolfram-verified formula explanations (unique)
• Adaptive mock tests that predict your actual GATE score
• Subject-wise weak area detection with remediation paths

Competitor blind spots:
• No AI explanations → students go to YouTube (we intercept this)
• No score prediction → we own "what will I score?" search intent
• No parent visibility → we win family-purchase decisions

Positioning: "The only GATE platform powered by IIT-grade AI"
Price point: ₹799/mo (₹200 premium over TestBook — justified by AI)

Herald brief:
• Landing page headline: "Your AI tutor scored AIR 1. Now it's your turn."
• USP: Adaptive mocks + real GATE score prediction
• CTA: "Start 7-day free trial"`,
  },

  {
    id: 'positioning_strategy',
    phase: 3, phaseLabel: 'Business Case + CEO Gate',
    agentId: 'growth_commander', agentName: 'GrowthCommander', agentEmoji: '🚀',
    action: 'GrowthCommander → Positioning + go-to-market strategy brief',
    category: 'planning', execution: 'sequential',
    externalConnections: [],
    estimatedMs: 4000,
    description: 'GrowthCommander synthesises the competitor analysis and blue ocean findings into a go-to-market strategy. Outputs channel priorities, messaging architecture, and 30-day launch sprint plan.',
    subAgentsInvolved: ['CommunityBuilder', 'SEOStrategist'],
    sampleOutput: (exam) => `✅ Go-to-Market Strategy — ${exam || 'GATE'}

🎯 CHANNEL PRIORITY STACK
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Priority  Channel             CAC est.  30-day reach
  1       SEO (content)       ₹0        8,200 organic
  2       Telegram community  ₹45       3,400 members
  3       YouTube shorts      ₹80       12,000 views
  4       Google Ads          ₹420      2,100 clicks
  5       Influencer (micro)  ₹180      15,000 reach

📅 30-DAY LAUNCH SPRINT:
Week 1: Atlas publishes 8 GATE blog posts (SEO capture)
Week 1: Herald launches Telegram "GATE 2026 Champions" group
Week 2: 5 mock test free tier → lead capture funnel
Week 2: Herald publishes "GATE Score Predictor" free tool (viral)
Week 3: Paid launch — ₹1/day Google Ads test
Week 4: First cohort feedback → iterate + price optimise

Revenue target Month 1: ₹2.8L (280 conversions)`,
  },

  // ═══════════════════════════════════════════════════════════
  // PHASE D: PRE-LAUNCH PREPARATION SIGNALS
  // ═══════════════════════════════════════════════════════════

  {
    id: 'seo_keyword_strategy',
    phase: 4, phaseLabel: 'Pre-Launch Prep Signals',
    agentId: 'growth_commander', agentName: 'GrowthCommander', agentEmoji: '🚀',
    action: 'SEOStrategist → 20 target keywords + content calendar outline',
    category: 'planning', execution: 'parallel',
    parallelWith: ['pricing_recommendation'],
    externalConnections: ['Brave Search API'],
    estimatedMs: 5000,
    description: 'SEOStrategist builds a keyword strategy for the chosen exam. Returns 20 target keywords ranked by opportunity score, plus a 30-day content calendar for Atlas.',
    subAgentsInvolved: ['SEOStrategist'],
    sampleOutput: (exam) => `✅ SEO Strategy — ${exam || 'GATE'}

🔑 TOP 20 TARGET KEYWORDS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Keyword                              Vol    KD   Priority
"${exam || 'GATE'} 2026 preparation guide"   48,200  28   🟢 Week 1
"${exam || 'GATE'} previous year papers"    38,600  32   🟢 Week 1
"${exam || 'GATE'} mock test free"          31,400  25   🟢 Week 1
"${exam || 'GATE'} syllabus 2026"           67,200  40   🟡 Week 2
"${exam || 'GATE'} cut off 2025"            24,800  22   🟢 Week 2
"how to prepare ${exam || 'GATE'} in 3 months" 18,400 18 🟢 Week 2
"${exam || 'GATE'} score calculator"         12,200  15   🟢 Week 3 (tool)
"best ${exam || 'GATE'} coaching online"     28,400  55   🔴 Month 2

📅 CONTENT CALENDAR (Week-by-Week)
Week 1: Ultimate ${exam || 'GATE'} 2026 Guide | PYQ with Solutions | Syllabus PDF
Week 2: Subject-wise Study Plan | Top Scoring Strategies | Mock Test
Week 3: Score Predictor Tool | "From 45 to AIR 200" story | Formula Sheet
Week 4: Free Mock Exam | Weak Topic Analyser | Comparison with competitors`,
  },

  {
    id: 'pricing_recommendation',
    phase: 4, phaseLabel: 'Pre-Launch Prep Signals',
    agentId: 'revenue_architect', agentName: 'RevenueArchitect', agentEmoji: '💰',
    action: 'PricingOptimiser → Recommended price point based on competitor analysis + WTP',
    category: 'planning', execution: 'parallel',
    parallelWith: ['seo_keyword_strategy'],
    externalConnections: [],
    estimatedMs: 3000,
    description: 'PricingOptimiser analyses competitor pricing, willingness-to-pay signals, and segment economics to recommend the optimal price point for the new exam launch.',
    subAgentsInvolved: ['PricingOptimiser', 'ChurnPredictor'],
    sampleOutput: (exam) => `✅ Pricing Strategy — ${exam || 'GATE'}

💱 PRICING RECOMMENDATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Market range: ₹299 (low) → ₹1,499 (premium)
Our positioning: Premium AI tier

RECOMMENDED PRICING:
  Free tier:     3 mock tests + AI explanations (lead magnet)
  Starter:       ₹499/mo — full access, no adaptive AI
  Pro:           ₹799/mo — adaptive AI + score predictor ← MAIN SKU
  Pro + Parent:  ₹999/mo — Pro + parent dashboard

Price elasticity model:
  @ ₹599: conversion rate ~8.2% → 820 students/10,000 visitors
  @ ₹799: conversion rate ~6.1% → 612 students  (revenue: ₹4.9L vs ₹4.9L — same!)
  @ ₹799: HIGHER LTV due to premium positioning (less price-sensitive cohort)

✅ Recommendation: Launch at ₹799/mo (Pro)
   Rationale: Same revenue, better customer quality, stronger brand
   
Churn risk at ₹799: 7.2%/mo (vs 11.4% at ₹499 — price anchors commitment)`,
  },

  {
    id: 'launch_readiness_score',
    phase: 4, phaseLabel: 'Pre-Launch Prep Signals',
    agentId: 'oracle', agentName: 'Oracle', agentEmoji: '📊',
    action: 'Oracle → Final Launch Readiness Score. ≥70 unlocks Exam Creation Wizard.',
    category: 'planning', execution: 'sequential',
    externalConnections: [],
    estimatedMs: 3000,
    description: 'Oracle computes the final Launch Readiness Score from all Phase A-D inputs. Score ≥70 unlocks the full Exam Creation Wizard with pre-filled data. Score <70 returns a blockers list.',
    subAgentsInvolved: ['Oracle'],
    sampleOutput: (exam) => `✅ Launch Readiness Assessment — ${exam || 'GATE'}

🎯 LAUNCH READINESS SCORE: 89/100 — CLEARED FOR LAUNCH ✅

Score Breakdown:
  Market demand verified:      ✅ 88/100
  Competitor gap confirmed:    ✅ 82/100
  Revenue case approved:       ✅ CEO gate passed
  Differentiation angle:       ✅ 87/100
  SEO strategy ready:          ✅ 20 keywords mapped
  Pricing optimised:           ✅ ₹799/mo recommended
  Content partially available: ✅ 60% JEE overlap usable
  Platform readiness:          ✅ Forge effort: 3 days

Pre-filled for Exam Creation Wizard:
  Exam: ${exam || 'GATE'}
  Target audience: Engineers preparing for GATE 2026
  Positioning: "AI-powered adaptive GATE prep"
  Price: ₹799/mo Pro tier
  Launch mode: Full (not pilot)
  Priority keywords: 20 mapped by SEOStrategist

🚀 READY: Click "Proceed to Exam Creation" to launch the full pipeline`,
  },
];
