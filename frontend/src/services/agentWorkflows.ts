/**
 * Agent Workflow Service
 * Defines all multi-agent pipelines and their step definitions.
 * Simulates the real backend agent pipeline in the frontend service layer.
 */

export type AgentId = 'scout' | 'atlas' | 'sage' | 'mentor' | 'herald' | 'forge' | 'oracle' | 'prism';

export interface WorkflowStep {
  agentId: AgentId;
  agentName: string;
  agentEmoji: string;
  action: string;
  inputFrom?: AgentId;
  outputTo?: AgentId;
  estimatedMs: number;
  description: string;
  sampleOutput: (inputs: Record<string, unknown>, prevOutputs: Record<string, unknown>) => string;
}

// ─── Prism type guard ─────────────────────────────────────────────────────────
/** Returns true if the given AgentId is the Prism journey-intelligence agent */
export function isPrismAgent(id: AgentId): id is 'prism' {
  return id === 'prism';
}

export interface AgentWorkflow {
  id: string;
  name: string;
  description: string;
  triggerRole: 'ceo' | 'admin' | 'system';
  steps: WorkflowStep[];
  onComplete?: string;
}

export type StepStatus = 'waiting' | 'running' | 'done' | 'error';

export interface WorkflowStepState {
  stepIndex: number;
  status: StepStatus;
  output?: string;
  startedAt?: number;
  completedAt?: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Workflow definitions
// ─────────────────────────────────────────────────────────────────────────────

export const WORKFLOWS: Record<string, AgentWorkflow> = {

  launch_exam: {
    id: 'launch_exam',
    name: 'Launch Exam',
    description: 'End-to-end exam launch: market research → content generation → deployment → tracking',
    triggerRole: 'ceo',
    steps: [
      {
        agentId: 'scout',
        agentName: 'Scout',
        agentEmoji: '🔍',
        action: 'Market Research',
        outputTo: 'atlas',
        estimatedMs: 3500,
        description: 'Researching exam demand, competitor gaps, and trending keywords',
        sampleOutput: (inputs) => {
          const exam = (inputs.examName as string) || 'JEE Main';
          return `✅ Research complete for ${exam}:\n• 12,400 active aspirants in target region\n• Competitor gap: No platform offers daily mock tests with AI explanations\n• Top keywords: "${exam} 2026 preparation", "${exam} mock test", "${exam} cut-off"\n• Demand trending ↑ 18% vs last year\n• Recommended launch window: next 14 days`;
        },
      },
      {
        agentId: 'atlas',
        agentName: 'Atlas',
        agentEmoji: '📚',
        action: 'Content Generation',
        inputFrom: 'scout',
        outputTo: 'forge',
        estimatedMs: 5500,
        description: 'Generating exam-specific questions, lessons, and practice sets',
        sampleOutput: (inputs) => {
          const exam = (inputs.examName as string) || 'JEE Main';
          return `✅ Content generated for ${exam}:\n• 150 MCQs across Physics, Chemistry, Mathematics\n• 12 detailed lessons (avg 1,400 words each)\n• 5 full mock tests (180 questions each)\n• Fact-check score: 94% accuracy verified\n• SEO optimised titles and meta descriptions\n• Content ready for deployment`;
        },
      },
      {
        agentId: 'forge',
        agentName: 'Forge',
        agentEmoji: '⚙️',
        action: 'Deploy & Configure',
        inputFrom: 'atlas',
        outputTo: 'oracle',
        estimatedMs: 2500,
        description: 'Deploying exam infrastructure, configuring CDN, running health checks',
        sampleOutput: (inputs) => {
          const exam = (inputs.examName as string) || 'JEE Main';
          return `✅ ${exam} deployed successfully:\n• 150 content pieces live on CDN\n• Mock test engine configured\n• Cache warmed across 4 regions\n• DB migrations applied\n• Health check: All systems green ✓\n• URL: /exams/${exam.toLowerCase().replace(/\s+/g, '-')}-2026`;
        },
      },
      {
        agentId: 'oracle',
        agentName: 'Oracle',
        agentEmoji: '📊',
        action: 'Setup Tracking',
        inputFrom: 'forge',
        estimatedMs: 1500,
        description: 'Configuring analytics funnels, A/B tests, and performance dashboards',
        sampleOutput: (inputs) => {
          const exam = (inputs.examName as string) || 'JEE Main';
          return `✅ Tracking active for ${exam}:\n• Conversion funnel: Visit → Sign-up → First test → Subscribe\n• A/B test: Control vs "AI Explanation" variant\n• KPIs: DAU, mock test completions, subscription conversions\n• Alert thresholds set: Drop in completions > 20%\n• Dashboard ready at /analytics`;
        },
      },
    ],
    onComplete: 'Exam is live! Oracle is tracking all metrics. Herald will begin marketing.',
  },

  run_daily_ops: {
    id: 'run_daily_ops',
    name: 'Run Daily Ops',
    description: 'Daily automation: analytics → monitoring → marketing → engagement → system ops',
    triggerRole: 'ceo',
    steps: [
      {
        agentId: 'oracle',
        agentName: 'Oracle',
        agentEmoji: '📊',
        action: 'Analytics Refresh',
        outputTo: 'scout',
        estimatedMs: 2000,
        description: 'Generating daily report: users, revenue, learning metrics, anomalies',
        sampleOutput: () =>
          '✅ Daily report generated:\n• DAU: 2,847 (+8.2% vs yesterday)\n• Sessions: 4,120 | Avg duration: 23 min\n• Revenue today: ₹18,400\n• Top content: "Organic Chemistry Reactions"\n• Anomaly: Drop in Chemistry engagement (−12%) — flagged for Scout',
      },
      {
        agentId: 'scout',
        agentName: 'Scout',
        agentEmoji: '🔍',
        action: 'Trend Monitoring',
        inputFrom: 'oracle',
        outputTo: 'herald',
        estimatedMs: 3500,
        description: 'Scanning Google Trends, Reddit, Twitter for today\'s trending topics',
        sampleOutput: () =>
          '✅ Trends monitored:\n• 🔥 Trending: "JEE 2026 paper analysis" (+340%)\n• 📈 Rising: "NEET Biology shortcuts" (+85%)\n• 🟡 Stable: "CAT 2026 preparation"\n• Competitor alert: Unacademy launched free mock tests\n• Recommended content: JEE paper analysis post (high urgency)',
      },
      {
        agentId: 'herald',
        agentName: 'Herald',
        agentEmoji: '📢',
        action: 'Schedule Marketing',
        inputFrom: 'scout',
        outputTo: 'mentor',
        estimatedMs: 2500,
        description: 'Scheduling social posts, email campaign, and blog promotion',
        sampleOutput: () =>
          '✅ Marketing scheduled:\n• Twitter: 3 posts scheduled (9am, 1pm, 6pm IST)\n• LinkedIn: 1 article on JEE 2026 trends\n• Email: Re-engagement campaign → 420 inactive users\n• Blog: "JEE 2026 Paper Analysis" → publishing 10am IST\n• Lead nurture: 15 leads moved to "qualified" stage',
      },
      {
        agentId: 'mentor',
        agentName: 'Mentor',
        agentEmoji: '👨‍🏫',
        action: 'Student Engagement',
        inputFrom: 'herald',
        outputTo: 'forge',
        estimatedMs: 2000,
        description: 'Sending nudges, detecting churn risk, updating streaks',
        sampleOutput: () =>
          '✅ Engagement actions taken:\n• Churn risk detected: 18 students (risk > 70%)\n• Re-engagement nudges sent: 18 push + 12 WhatsApp\n• Streak celebrations: 7 students hit 7-day streak 🔥\n• Parent reports sent: 45 weekly reports delivered\n• Badges awarded: 3 "Topic Master", 7 "Week Warrior"',
      },
      {
        agentId: 'forge',
        agentName: 'Forge',
        agentEmoji: '⚙️',
        action: 'System Health Check',
        inputFrom: 'mentor',
        estimatedMs: 1500,
        description: 'Checking all services, CDN sync, cache stats, and error rates',
        sampleOutput: () =>
          '✅ System health verified:\n• API: 99.98% uptime | Latency: 82ms ✓\n• DB: Healthy | Query time: 12ms avg\n• CDN: 4 regions synced | Hit rate: 96.2%\n• Cache: 2.3 GB used | 95% hit rate\n• Error rate: 0.02% (well below 1% threshold)\n• No rollbacks needed',
      },
    ],
    onComplete: 'Daily ops complete. All agents reporting healthy. Reports available in Analytics.',
  },

  generate_content: {
    id: 'generate_content',
    name: 'Generate Content',
    description: 'AI content pipeline: generate → verify accuracy → publish to CDN',
    triggerRole: 'ceo',
    steps: [
      {
        agentId: 'atlas',
        agentName: 'Atlas',
        agentEmoji: '📚',
        action: 'Generate Content',
        outputTo: 'sage',
        estimatedMs: 5000,
        description: 'Writing lesson, quiz questions, and SEO metadata with Atlas Writer sub-agent',
        sampleOutput: (inputs) => {
          const topic = (inputs.topic as string) || 'Electromagnetic Induction';
          const type = (inputs.contentType as string) || 'lesson';
          return `✅ Content generated:\n• Title: "Complete Guide to ${topic}"\n• Type: ${type} | Words: 1,420\n• Sections: Introduction, Key Concepts, Derivations, Examples, Practice\n• 8 MCQs attached (2 easy, 4 medium, 2 hard)\n• SEO score: 87/100\n• Readability: Flesch 65 (appropriate for JEE level)\n• Ready for fact-check`;
        },
      },
      {
        agentId: 'sage',
        agentName: 'Sage',
        agentEmoji: '🎓',
        action: 'Verify Accuracy',
        inputFrom: 'atlas',
        outputTo: 'forge',
        estimatedMs: 3000,
        description: 'Checking scientific accuracy, cross-referencing NCERT, flagging errors',
        sampleOutput: (inputs) => {
          const topic = (inputs.topic as string) || 'Electromagnetic Induction';
          return `✅ Fact-check complete for "${topic}":\n• Overall accuracy: 94.2%\n• Claims verified: 18/18 ✓\n• Derivations: Correct ✓\n• Formula accuracy: All verified against NCERT ✓\n• 1 minor correction applied: Updated units for magnetic flux\n• Difficulty level: Appropriate for JEE Main\n• Approved for publishing`;
        },
      },
      {
        agentId: 'forge',
        agentName: 'Forge',
        agentEmoji: '⚙️',
        action: 'Publish to CDN',
        inputFrom: 'sage',
        estimatedMs: 2000,
        description: 'Deploying content, syncing CDN, invalidating cache, updating search index',
        sampleOutput: (inputs) => {
          const topic = (inputs.topic as string) || 'Electromagnetic Induction';
          return `✅ Content published:\n• URL: /content/${topic.toLowerCase().replace(/\s+/g, '-')}\n• CDN synced: 4 regions (us-east, eu-west, ap-south, ap-southeast)\n• Cache invalidated for /content/* pages\n• Search index updated\n• Estimated load time: 180ms (p95)\n• Content is live and accessible`;
        },
      },
    ],
    onComplete: 'Content is live! Herald will schedule promotions automatically.',
  },

  growth_strategy: {
    id: 'growth_strategy',
    name: 'Growth Strategy',
    description: 'Autonomous growth analysis: research → analyse → plan campaigns → CEO review',
    triggerRole: 'ceo',
    steps: [
      {
        agentId: 'scout',
        agentName: 'Scout',
        agentEmoji: '🔍',
        action: 'Market Research',
        outputTo: 'oracle',
        estimatedMs: 4000,
        description: 'Analysing competitor landscape, keyword opportunities, and audience segments',
        sampleOutput: () =>
          '✅ Market research complete:\n• Market size: 8.4M competitive exam aspirants (India)\n• Our penetration: 0.34% — massive headroom\n• Top competitor gap: No platform has AI-powered daily practice\n• Best acquisition channel: Organic search (15x ROI vs paid)\n• Underserved segment: NEET aspirants (growing 12%, low competition)\n• Keyword opportunity: "JEE PYQ with solutions" — 45K searches/mo, KD: 32',
      },
      {
        agentId: 'oracle',
        agentName: 'Oracle',
        agentEmoji: '📊',
        action: 'Analyse Performance',
        inputFrom: 'scout',
        outputTo: 'herald',
        estimatedMs: 2500,
        description: 'Correlating market data with current metrics, finding highest-ROI opportunities',
        sampleOutput: () =>
          '✅ Performance analysis complete:\n• Organic search: 15x ROI → Scale immediately\n• Social organic: 22.5x ROI → Increase output\n• Paid search: 2.5x ROI → Pause and reallocate\n• JEE segment: Healthy, 15% growth\n• NEET segment: 12% growth, underserved → prioritise\n• Recommended budget shift: ₹24K/mo from paid → organic content',
      },
      {
        agentId: 'herald',
        agentName: 'Herald',
        agentEmoji: '📢',
        action: 'Plan Campaigns',
        inputFrom: 'oracle',
        estimatedMs: 3000,
        description: 'Drafting campaign playbooks for top 3 growth opportunities',
        sampleOutput: () =>
          '✅ Campaign plans drafted:\n\n📌 Campaign 1 — NEET Organic Acquisition\n• Goal: 500 new users in 45 days\n• Channels: SEO + YouTube + Telegram\n• Budget: ₹8,000 (content creation only)\n• Est. revenue: ₹75,000\n\n📌 Campaign 2 — JEE PYQ Content Blitz\n• Goal: 400 users in 30 days\n• Channels: SEO + Social\n• Budget: ₹5,000\n• Est. revenue: ₹60,000\n\n⏳ Awaiting CEO approval to proceed',
      },
    ],
    onComplete: 'Strategy ready for CEO review. Approve campaigns to begin execution.',
  },

  blog_post: {
    id: 'blog_post',
    name: 'Blog Post Generation',
    description: 'Automated blog pipeline: draft → enrich with facts → publish',
    triggerRole: 'ceo',
    steps: [
      {
        agentId: 'herald',
        agentName: 'Herald',
        agentEmoji: '📢',
        action: 'Draft Blog Post',
        outputTo: 'atlas',
        estimatedMs: 3500,
        description: 'Writing SEO-optimised blog draft with hooks, structure, and CTAs',
        sampleOutput: (inputs) => {
          const topic = (inputs.topic as string) || 'JEE 2026 Strategy';
          return `✅ Blog draft created:\n• Title: "10 Proven Strategies to Crack ${topic}"\n• Word count: 1,850 words\n• Structure: Hook → 10 numbered tips → CTA\n• Target keyword: "${topic.toLowerCase()} tips"\n• Meta description: 158 chars ✓\n• Internal links: 5 added\n• Tone: Motivating, practical, student-friendly\n• Ready for fact enrichment`;
        },
      },
      {
        agentId: 'atlas',
        agentName: 'Atlas',
        agentEmoji: '📚',
        action: 'Enrich with Facts',
        inputFrom: 'herald',
        outputTo: 'forge',
        estimatedMs: 4000,
        description: 'Adding verified statistics, expert references, data points, and examples',
        sampleOutput: (inputs) => {
          const topic = (inputs.topic as string) || 'JEE 2026 Strategy';
          return `✅ Blog enriched for "${topic}":\n• 8 statistics verified and added\n• 3 expert study technique references added\n• 2 infographic specs created\n• PYQ examples inserted in 4 tips\n• Fact-check score: 91%\n• Final word count: 2,100 words\n• SEO score: 89/100\n• Approved for publishing`;
        },
      },
      {
        agentId: 'forge',
        agentName: 'Forge',
        agentEmoji: '⚙️',
        action: 'Publish Blog',
        inputFrom: 'atlas',
        estimatedMs: 2000,
        description: 'Publishing blog, syncing CDN, submitting sitemap to Google',
        sampleOutput: (inputs) => {
          const topic = (inputs.topic as string) || 'JEE 2026 Strategy';
          return `✅ Blog published:\n• URL: /blog/${topic.toLowerCase().replace(/\s+/g, '-')}\n• Sitemap updated and submitted to Google Search Console\n• OpenGraph tags set for social sharing\n• CDN synced globally in 1.2s\n• Estimated indexing: 24-48 hours\n• Herald will schedule 3 social promotions automatically`;
        },
      },
    ],
    onComplete: 'Blog is live! Herald scheduling social media promotions.',
  },

  student_engagement: {
    id: 'student_engagement',
    name: 'Student Engagement',
    description: 'Detect struggling students → personalise learning → notify parents',
    triggerRole: 'admin',
    steps: [
      {
        agentId: 'mentor',
        agentName: 'Mentor',
        agentEmoji: '👨‍🏫',
        action: 'Detect At-Risk Students',
        outputTo: 'sage',
        estimatedMs: 2500,
        description: 'Running churn prediction model, identifying students with declining engagement',
        sampleOutput: () =>
          '✅ At-risk students identified:\n• Total students scanned: 2,847\n• High churn risk (>70%): 18 students\n• Medium risk (50–70%): 43 students\n• Common factors: Low session frequency, hint overuse\n• Avg days since last login (high risk): 6.2 days\n• Alert: 3 students showing severe frustration signals',
      },
      {
        agentId: 'sage',
        agentName: 'Sage',
        agentEmoji: '🎓',
        action: 'Personalise Learning Path',
        inputFrom: 'mentor',
        outputTo: 'herald',
        estimatedMs: 3500,
        description: 'Creating custom learning paths, adjusting difficulty, selecting remedial content',
        sampleOutput: () =>
          '✅ Personalisation complete:\n• 18 custom learning paths created\n• Avg difficulty reduced by 1.5 levels for struggling students\n• Prerequisite gaps identified: 72% lack "Basics of Integration"\n• Remedial content assigned: 3 simplified lessons each\n• Spaced repetition schedules reconfigured\n• Estimated mastery improvement: +18% in 7 days',
      },
      {
        agentId: 'herald',
        agentName: 'Herald',
        agentEmoji: '📢',
        action: 'Notify Parents',
        inputFrom: 'sage',
        estimatedMs: 2000,
        description: 'Sending personalised parent reports with progress summaries and recommendations',
        sampleOutput: () =>
          '✅ Parent notifications sent:\n• Weekly reports delivered: 18 parents\n• Channels used: Email (18) + WhatsApp (12)\n• Report includes: Progress summary, mastery levels, recommendations\n• Tone: Supportive and constructive\n• Parent action items: 2–3 suggestions per report\n• Follow-up scheduled in 3 days',
      },
    ],
    onComplete: 'Engagement campaign complete. Monitor recovery rates in Oracle dashboard.',
  },

  exam_analytics: {
    id: 'exam_analytics',
    name: 'Exam Analytics',
    description: 'Collect performance data → benchmark vs competitors → surface insights to CEO',
    triggerRole: 'ceo',
    steps: [
      {
        agentId: 'oracle',
        agentName: 'Oracle',
        agentEmoji: '📊',
        action: 'Collect Exam Data',
        outputTo: 'scout',
        estimatedMs: 2000,
        description: 'Aggregating student performance across all exams: accuracy, time, scores',
        sampleOutput: (inputs) => {
          const exam = (inputs.examName as string) || 'JEE Main';
          return `✅ ${exam} data collected:\n• Total attempts: 1,240\n• Avg score: 68.4% (vs 62% platform avg)\n• Completion rate: 84%\n• Hardest topic: "Integration by Parts" (42% avg)\n• Easiest topic: "Kinematics" (82% avg)\n• Time overrun: 28% of students\n• Most common errors: Sign mistakes in EMF problems\n• Data ready for benchmarking`;
        },
      },
      {
        agentId: 'scout',
        agentName: 'Scout',
        agentEmoji: '🔍',
        action: 'Benchmark vs Market',
        inputFrom: 'oracle',
        estimatedMs: 3500,
        description: 'Comparing performance data against industry benchmarks and competitor platforms',
        sampleOutput: (inputs) => {
          const exam = (inputs.examName as string) || 'JEE Main';
          return `✅ Benchmarking complete for ${exam}:\n• Our avg score: 68.4% vs market avg: 61% 🟢\n• Completion rate: 84% vs industry 71% 🟢\n• Content accuracy: 94% vs Unacademy ~88% 🟢\n• Gap: Time management — students scoring 70+ need timed practice\n• Recommendation: Add "Speed Mode" mock tests\n• Competitive edge: AI explanations drive 18% higher retention\n• Full benchmark report ready for CEO dashboard`;
        },
      },
    ],
    onComplete: 'Analytics complete. Report surfaced to CEO Dashboard.',
  },

  prism_analysis: {
    id: 'prism_analysis',
    name: 'Journey Analysis',
    description: 'Prism analyses full user journeys to detect funnel leaks and emit targeted insights to responsible agents',
    triggerRole: 'ceo',
    steps: [
      {
        agentId: 'oracle',
        agentName: 'Oracle',
        agentEmoji: '📊',
        action: 'Export Journey Events',
        outputTo: 'prism',
        estimatedMs: 2000,
        description: 'Exporting raw user journey traces: page visits, session starts, drop-offs, conversions',
        sampleOutput: () =>
          '✅ Journey data exported:\n• 14,820 journey events (last 30 days)\n• Entry points: /blog (42%), /home (28%), /exams (18%), direct (12%)\n• Avg journey depth: 3.2 pages before drop-off\n• Conversion to sign-up: 6.4%\n• Conversion to paid: 12.1% of sign-ups\n• Top drop-off: pricing page (67% exit rate)\n• Data ready for Prism analysis',
      },
      {
        agentId: 'prism',
        agentName: 'Prism',
        agentEmoji: '🌈',
        action: 'Analyse Funnel Leaks',
        inputFrom: 'oracle',
        outputTo: 'atlas',
        estimatedMs: 4000,
        description: 'Mapping journey traces, detecting leak points, segmenting by entry path and user type',
        sampleOutput: () =>
          '✅ Funnel analysis complete:\n\n🔴 CRITICAL LEAK: Blog → Sign-up (82% abandon at CTA)\n• Segment: JEE aspirants from organic search\n• Hypothesis: CTA copy doesn\'t speak to exam anxiety\n• → Emitting FUNNEL_INSIGHT to Herald: rewrite CTA copy\n\n🟡 MEDIUM LEAK: Onboarding → First practice (41% don\'t start)\n• Students drop off after diagnostic assessment\n• → Emitting FUNNEL_INSIGHT to Mentor: send encouragement nudge\n\n🟢 WIN: Students who complete mock test → subscribe (34% conversion)\n• Best activation event is mock test completion\n• → Emitting FUNNEL_INSIGHT to Atlas: prioritise mock test content',
      },
      {
        agentId: 'herald',
        agentName: 'Herald',
        agentEmoji: '📢',
        action: 'Fix Acquisition Leaks',
        inputFrom: 'prism',
        estimatedMs: 2500,
        description: 'Rewriting CTAs, adjusting campaign targeting based on Prism\'s funnel insights',
        sampleOutput: () =>
          '✅ Acquisition fixes applied based on Prism insights:\n• Blog CTA rewritten: "Take your free 5-minute JEE diagnostic" (from "Sign up free")\n• A/B test launched: 50/50 split on 3 blog pages\n• Email retargeting campaign: targeting blog readers who bounced\n• Social ad copy updated to address exam anxiety\n• Expected: +2.1% blog→sign-up conversion in 14 days',
      },
      {
        agentId: 'mentor',
        agentName: 'Mentor',
        agentEmoji: '👨‍🏫',
        action: 'Fix Activation Leaks',
        inputFrom: 'prism',
        estimatedMs: 2000,
        description: 'Reducing drop-off between onboarding and first practice session',
        sampleOutput: () =>
          '✅ Activation nudge deployed based on Prism insights:\n• Students who completed diagnostic but haven\'t started practice: 847\n• WhatsApp nudge sent: "Your personalised JEE plan is ready"\n• In-app prompt added: quick-start card on dashboard\n• First-session friction reduced: pre-selected topic based on diagnostic\n• Expected: +18% same-day activation rate',
      },
    ],
    onComplete: 'Journey analysis complete. Funnel insights dispatched to Herald and Mentor. Monitor conversion improvements in 14 days.',
  },

  user_onboarding: {
    id: 'user_onboarding',
    name: 'User Onboarding',
    description: 'New user journey: welcome → assess level → personalise content',
    triggerRole: 'system',
    steps: [
      {
        agentId: 'mentor',
        agentName: 'Mentor',
        agentEmoji: '👨‍🏫',
        action: 'Welcome & Profile',
        outputTo: 'sage',
        estimatedMs: 1500,
        description: 'Sending welcome sequence, collecting preferences, setting up profile',
        sampleOutput: (inputs) => {
          const user = (inputs.userName as string) || 'Student';
          return `✅ ${user} onboarded:\n• Welcome email sent ✓\n• Onboarding quiz initiated (5 questions)\n• Profile created: Exam = JEE 2026, Class 12\n• Streak started: Day 1 🔥\n• Achievement unlocked: "First Login" badge\n• Parent email collected for weekly reports`;
        },
      },
      {
        agentId: 'sage',
        agentName: 'Sage',
        agentEmoji: '🎓',
        action: 'Assess Knowledge Level',
        inputFrom: 'mentor',
        outputTo: 'atlas',
        estimatedMs: 3000,
        description: 'Running diagnostic quiz, mapping knowledge gaps, setting baseline mastery',
        sampleOutput: () =>
          '✅ Diagnostic assessment complete:\n• 15-question diagnostic delivered\n• Physics: 72% mastery (strong)\n• Chemistry: 48% mastery (needs work)\n• Mathematics: 61% mastery (moderate)\n• Knowledge gap: Organic Chemistry fundamentals\n• Recommended start: Chemistry Unit 4 (Basics)\n• Learning style detected: Visual + Practice-heavy\n• Baseline mastery set for adaptive learning',
      },
      {
        agentId: 'atlas',
        agentName: 'Atlas',
        agentEmoji: '📚',
        action: 'Personalise Content',
        inputFrom: 'sage',
        estimatedMs: 4000,
        description: 'Curating personalised content feed based on diagnostic results',
        sampleOutput: () =>
          '✅ Personalised content ready:\n• Day 1 queue: 2 Chemistry lessons + 10 practice MCQs\n• Difficulty calibrated: Easy → Medium progression over 7 days\n• Visual aids prioritised (match detected learning style)\n• Spaced repetition schedule created for weak areas\n• Content variety: 60% questions, 30% lessons, 10% videos\n• First session estimated impact: +8% Chemistry mastery\n• All content delivered to student dashboard',
      },
    ],
    onComplete: 'Onboarding complete! Student is ready with a personalised 7-day learning plan.',
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Workflow Runner
// ─────────────────────────────────────────────────────────────────────────────

export async function runWorkflow(
  workflowId: string,
  inputs: Record<string, unknown>,
  onStepUpdate: (
    stepIndex: number,
    status: 'running' | 'done' | 'error',
    output?: string
  ) => void
): Promise<{ success: boolean; outputs: Record<string, unknown> }> {
  const workflow = WORKFLOWS[workflowId];
  if (!workflow) {
    return { success: false, outputs: { error: `Unknown workflow: ${workflowId}` } };
  }

  const outputs: Record<string, unknown> = { ...inputs };
  const stepOutputs: Record<string, string> = {};

  for (let i = 0; i < workflow.steps.length; i++) {
    const step = workflow.steps[i];
    onStepUpdate(i, 'running');

    const jitter = Math.random() * 400 - 200;
    await sleep(Math.max(step.estimatedMs + jitter, 800));

    const output = step.sampleOutput(inputs, { ...stepOutputs });
    stepOutputs[step.agentId] = output;
    outputs[`${step.agentId}_output`] = output;

    onStepUpdate(i, 'done', output);
  }

  return { success: true, outputs };
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ─────────────────────────────────────────────────────────────────────────────
// Agent meta-info (for connection map UI)
// ─────────────────────────────────────────────────────────────────────────────

export interface AgentMeta {
  id: AgentId;
  name: string;
  emoji: string;
  role: string;
  color: string;
  bgColor: string;
  inputsFrom: AgentId[];
  outputsTo: AgentId[];
  workflows: string[];
  description: string;
  subAgents: string[];
}

export const AGENT_META: Record<AgentId, AgentMeta> = {
  scout: {
    id: 'scout',
    name: 'Scout',
    emoji: '🔍',
    role: 'Market Intelligence',
    color: '#0ea5e9',
    bgColor: 'bg-sky-500/10 border-sky-500/30',
    // Inputs: DEPLOY_METRICS ← forge | CAMPAIGN_RESULT ← herald | PERFORMANCE_INSIGHT ← oracle
    inputsFrom: ['oracle', 'herald', 'forge'],
    // Outputs: TREND_SIGNAL → atlas | KEYWORD_OPPORTUNITY → herald | data → oracle
    outputsTo: ['atlas', 'herald', 'oracle'],
    workflows: ['launch_exam', 'run_daily_ops', 'growth_strategy', 'exam_analytics'],
    description: 'Monitors trends, competitors, and exam updates. Emits TREND_SIGNAL to Atlas and KEYWORD_OPPORTUNITY to Herald. Receives DEPLOY_METRICS from Forge, CAMPAIGN_RESULT from Herald, and PERFORMANCE_INSIGHT from Oracle.',
    subAgents: ['TrendSpotter', 'CompetitorTracker', 'ExamMonitor', 'KeywordHunter', 'SentimentScanner'],
  },
  atlas: {
    id: 'atlas',
    name: 'Atlas',
    emoji: '📚',
    role: 'Content Engine',
    color: '#d946ef',
    bgColor: 'bg-fuchsia-500/10 border-fuchsia-500/30',
    // Inputs: TREND_SIGNAL ← scout | STRUGGLE_PATTERN ← sage | FORMAT_REQUEST ← lens
    //         FORMAT_SUCCESS ← sage | ENGAGEMENT_GAP ← mentor | CONTENT_GAP ← sage
    inputsFrom: ['scout', 'mentor', 'herald', 'sage'],
    // Outputs: CONTENT_READY → sage+forge+herald | CONTENT_PUBLISHED → oracle
    outputsTo: ['sage', 'forge', 'oracle'],
    workflows: ['launch_exam', 'generate_content', 'blog_post', 'user_onboarding'],
    description: 'Creates, manages, and publishes educational content. Receives TREND_SIGNAL from Scout, STRUGGLE_PATTERN/FORMAT_SUCCESS/CONTENT_GAP from Sage, FORMAT_REQUEST from Lens, and ENGAGEMENT_GAP from Mentor. Emits CONTENT_READY and CONTENT_PUBLISHED.',
    subAgents: ['Curator', 'Writer', 'QuizMaster', 'Visualizer', 'SEOOptimizer', 'Translator', 'FactChecker'],
  },
  sage: {
    id: 'sage',
    name: 'Sage',
    emoji: '🎓',
    role: 'AI Tutor',
    color: '#22c55e',
    bgColor: 'bg-green-500/10 border-green-500/30',
    // Inputs: CONTENT_READY ← atlas | STUDENT_STRUGGLING ← mentor | EXAM_APPROVED ← ceo
    inputsFrom: ['atlas', 'mentor'],
    // Outputs: CONTENT_GAP/STRUGGLE_PATTERN/FORMAT_SUCCESS → atlas | MASTERY_ACHIEVED/FRUSTRATION_ALERT/BREAKTHROUGH → mentor+oracle
    //          CONTENT_VERIFIED → forge+herald
    outputsTo: ['atlas', 'oracle', 'mentor', 'forge', 'herald'],
    workflows: ['generate_content', 'student_engagement', 'user_onboarding'],
    description: 'Provides personalised tutoring via Socratic method and verifies content accuracy. Receives CONTENT_READY from Atlas and STUDENT_STRUGGLING from Mentor. Emits CONTENT_GAP/STRUGGLE_PATTERN/FORMAT_SUCCESS to Atlas, MASTERY_ACHIEVED/FRUSTRATION_ALERT/BREAKTHROUGH to Mentor+Oracle, and CONTENT_VERIFIED to Forge+Herald.',
    subAgents: ['Socratic', 'Explainer', 'ProblemSolver', 'ConceptMapper', 'PracticeCoach', 'EmotionReader'],
  },
  mentor: {
    id: 'mentor',
    name: 'Mentor',
    emoji: '👨‍🏫',
    role: 'Student Engagement',
    color: '#f59e0b',
    bgColor: 'bg-amber-500/10 border-amber-500/30',
    // Inputs: MASTERY_ACHIEVED/FRUSTRATION_ALERT/BREAKTHROUGH ← sage | CHURN_RISK ← oracle
    //         EXAM_DEPLOYED ← forge | SR_OVERDUE ← lens | EXAM_DEPLOYED ← forge
    inputsFrom: ['oracle', 'sage', 'herald', 'atlas'],
    // Outputs: STUDENT_STRUGGLING → sage | ENGAGEMENT_GAP → atlas
    outputsTo: ['sage', 'atlas'],
    workflows: ['run_daily_ops', 'student_engagement', 'user_onboarding'],
    description: 'Manages retention, gamification, and parent communication. Receives MASTERY_ACHIEVED/FRUSTRATION_ALERT/BREAKTHROUGH from Sage, CHURN_RISK from Oracle, EXAM_DEPLOYED from Forge, SR_OVERDUE from Lens. Emits STUDENT_STRUGGLING to Sage and ENGAGEMENT_GAP to Atlas.',
    subAgents: ['ChurnPredictor', 'NudgeEngine', 'StreakTracker', 'MilestoneManager', 'ReEngager', 'ParentReporter'],
  },
  herald: {
    id: 'herald',
    name: 'Herald',
    emoji: '📢',
    role: 'Marketing Automation',
    color: '#ef4444',
    bgColor: 'bg-red-500/10 border-red-500/30',
    // Inputs: KEYWORD_OPPORTUNITY ← scout | CAMPAIGN_PERFORMANCE ← oracle
    //         CONTENT_VERIFIED ← sage | EXAM_DEPLOYED ← forge
    inputsFrom: ['scout', 'oracle', 'sage', 'forge'],
    // Outputs: CAMPAIGN_RESULT → scout | signals → mentor+forge
    outputsTo: ['scout', 'mentor', 'forge'],
    workflows: ['run_daily_ops', 'growth_strategy', 'blog_post', 'student_engagement'],
    description: 'Manages campaigns, social media, and lead nurturing. Receives KEYWORD_OPPORTUNITY from Scout, CAMPAIGN_PERFORMANCE from Oracle, CONTENT_VERIFIED from Sage, EXAM_DEPLOYED from Forge. Emits CAMPAIGN_RESULT to Scout when campaigns underperform.',
    subAgents: ['CampaignManager', 'SocialPoster', 'EmailCrafter', 'LeadNurturer', 'ReferralManager', 'PRCoordinator'],
  },
  forge: {
    id: 'forge',
    name: 'Forge',
    emoji: '⚙️',
    role: 'Deployment & Ops',
    color: '#8b5cf6',
    bgColor: 'bg-violet-500/10 border-violet-500/30',
    // Inputs: CONTENT_READY ← atlas | CONTENT_VERIFIED ← sage | EXAM_APPROVED ← ceo | from herald+mentor
    inputsFrom: ['atlas', 'sage', 'herald', 'mentor'],
    // Outputs: EXAM_DEPLOYED → oracle+herald+mentor | DEPLOY_METRICS → scout
    outputsTo: ['oracle', 'herald', 'mentor', 'scout'],
    workflows: ['launch_exam', 'run_daily_ops', 'generate_content', 'blog_post'],
    description: 'Manages CI/CD, deployments, CDN, and system health. Receives CONTENT_READY from Atlas, CONTENT_VERIFIED from Sage, and signals from Herald/Mentor. Emits EXAM_DEPLOYED to Oracle+Herald+Mentor and DEPLOY_METRICS to Scout.',
    subAgents: ['BuildRunner', 'TestOrchestrator', 'CDNSyncer', 'CacheManager', 'DBMigrator', 'RollbackGuard', 'HealthChecker'],
  },
  oracle: {
    id: 'oracle',
    name: 'Oracle',
    emoji: '📊',
    role: 'Analytics & Insights',
    color: '#06b6d4',
    bgColor: 'bg-cyan-500/10 border-cyan-500/30',
    // Inputs: MASTERY_ACHIEVED/BEHAVIORAL_SNAPSHOT/BREAKTHROUGH ← sage+lens
    //         EXAM_DEPLOYED ← forge | CONTENT_PUBLISHED ← atlas
    inputsFrom: ['forge', 'sage', 'atlas'],
    // Outputs: PERFORMANCE_INSIGHT → scout+atlas+mentor | CHURN_RISK → mentor | CAMPAIGN_PERFORMANCE → herald
    outputsTo: ['scout', 'herald', 'mentor', 'atlas'],
    workflows: ['launch_exam', 'run_daily_ops', 'growth_strategy', 'exam_analytics'],
    description: 'Tracks metrics, detects anomalies, and generates insights. Receives MASTERY_ACHIEVED/BEHAVIORAL_SNAPSHOT/BREAKTHROUGH from Sage, EXAM_DEPLOYED from Forge, CONTENT_PUBLISHED from Atlas. Emits PERFORMANCE_INSIGHT to Scout+Atlas+Mentor, CHURN_RISK to Mentor, CAMPAIGN_PERFORMANCE to Herald.',
    subAgents: ['MetricTracker', 'AnomalyDetector', 'ReportGenerator', 'FunnelAnalyzer', 'CohortAnalyzer', 'ABEvaluator'],
  },
  prism: {
    id: 'prism',
    name: 'Prism',
    emoji: '🌈',
    role: 'Journey Intelligence',
    color: '#f97316',
    bgColor: 'bg-orange-500/10 border-orange-500/30',
    // Inputs: journey events from all agents (FUNNEL_INSIGHT feedback loop)
    inputsFrom: ['scout', 'atlas', 'sage', 'mentor', 'herald', 'forge', 'oracle'],
    // Outputs: FUNNEL_INSIGHT → relevant agent based on funnel stage
    outputsTo: ['scout', 'atlas', 'sage', 'mentor', 'herald', 'forge', 'oracle'],
    workflows: ['prism_analysis'],
    description: 'Analyses user journey traces (blog → chat → practice → return). Detects funnel leaks, frustration spikes, and conversion drop-offs. Emits FUNNEL_INSIGHT signals to the responsible agent for each stage.',
    subAgents: ['JourneyMapper', 'FunnelAnalyzer', 'ConversionOptimizer', 'LeakDetector', 'SegmentProfiler'],
  },
};
