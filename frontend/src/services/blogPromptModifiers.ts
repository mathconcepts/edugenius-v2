/**
 * Blog Prompt Modifiers — Enhanced v2
 *
 * Now includes:
 * - Full PROMPT_REGISTRY mapping signal types → complete prompts
 * - Extended examTags: JEE, NEET, CBSE, GATE, UPSC, CAT, CUET
 * - generateCompleteBlogPrompt accepts optional StrategySignal and injects signal context
 *
 * Backward compatible: all v1 exports preserved.
 */

import type { StrategySignal } from '@/services/blogAgentBridge';
import { featureMarketingConfigs, internalLinkLibrary, contentPromptModifiers } from './marketingIntegration';

// ─── Extended Exam Tag Type ───────────────────────────────────────────────────

export type ExtendedExamTag =
  | 'JEE'
  | 'NEET'
  | 'CBSE'
  | 'CBSE_10'
  | 'CBSE_12'
  | 'GATE'
  | 'UPSC'
  | 'CAT'
  | 'CUET'
  | 'ICSE'
  | 'General';

export const EXAM_TAG_META: Record<ExtendedExamTag, { fullName: string; emoji: string; linkPath: string }> = {
  JEE:     { fullName: 'JEE Main & Advanced',           emoji: '⚗️',  linkPath: '/exams/jee' },
  NEET:    { fullName: 'NEET UG',                        emoji: '🧬',  linkPath: '/exams/neet' },
  CBSE:    { fullName: 'CBSE Board',                     emoji: '📘',  linkPath: '/exams/cbse' },
  CBSE_10: { fullName: 'CBSE Class 10',                  emoji: '📘',  linkPath: '/exams/cbse-10' },
  CBSE_12: { fullName: 'CBSE Class 12',                  emoji: '📗',  linkPath: '/exams/cbse-12' },
  GATE:    { fullName: 'GATE (Graduate Aptitude Test)',  emoji: '🔧',  linkPath: '/exams/gate' },
  UPSC:    { fullName: 'UPSC Civil Services',            emoji: '🏛️', linkPath: '/exams/upsc' },
  CAT:     { fullName: 'CAT (Common Admission Test)',    emoji: '💼',  linkPath: '/exams/cat' },
  CUET:    { fullName: 'CUET UG',                        emoji: '🎓',  linkPath: '/exams/cuet' },
  ICSE:    { fullName: 'ICSE Board',                     emoji: '📙',  linkPath: '/exams/icse' },
  General: { fullName: 'General Education',              emoji: '📚',  linkPath: '/learn' },
};

// ─── Prompt Registry ──────────────────────────────────────────────────────────

export interface PromptRegistryEntry {
  signalType: string;
  triggerAgent: string;
  triggerSubAgent?: string;
  systemPrompt: string;
  userPromptTemplate: string;
  qualityChecks: string[];
  examSpecificModifiers: Partial<Record<ExtendedExamTag, string>>;
}

export const PROMPT_REGISTRY: Record<string, PromptRegistryEntry> = {

  trending_keyword: {
    signalType: 'trending_keyword',
    triggerAgent: 'venture_scout',
    triggerSubAgent: 'TrendRadar',
    systemPrompt: `You are Atlas, EduGenius's AI Content Engine. You create authoritative educational blog posts for Indian exam aspirants. Your content is data-backed, exam-specific, and always prioritizes student value over promotional goals.

When writing from a TrendRadar signal:
- The keyword has been validated against real search demand
- Students searching this are in active preparation mode — meet them with exactly what they need
- Depth and accuracy are non-negotiable
- Every tip must be actionable within 24 hours`,

    userPromptTemplate: `Write a comprehensive blog post for EduGenius.

**TrendRadar Signal Context:**
This post is triggered by a trending keyword signal from VentureScout.TrendRadar:
- Keyword: "{{keyword}}"
- Exam: {{examTag}}
- Search Volume: {{searchVolume}} searches/month
- YoY Growth: +{{yoyGrowth}}%
- Opportunity Score: {{opportunityScore}}/100

**Content Brief:**
- Suggested Title: {{suggestedTitle}}
- Suggested Angle: {{suggestedAngle}}
- Secondary Keywords: {{targetKeywords}}
- Target Word Count: {{targetWordCount}} words

Write the complete blog post in Markdown. Include sections, callouts, internal links, and trailing JSON metadata.`,

    qualityChecks: [
      'Signal context reflected in intro (keyword, exam, urgency)',
      'Primary keyword in H1, first paragraph, and ≥2 H2s',
      'At least one callout block',
      'Internal links to /chat and /practice',
      'qualityScore ≥ 80',
      'seoScore ≥ 82',
      'No fabricated statistics',
    ],

    examSpecificModifiers: {
      JEE: `## JEE-Specific Context
- Reference NTA JEE Main pattern (90 MCQs, 3 sections, 3 hours)
- Include topic weightage data from last 5 years
- Mention JEE Advanced for top-rank aspirants
- Use numerical examples from Physics/Chemistry/Math
- Link to /exams/jee and /practice/jee-pyq`,

      NEET: `## NEET-Specific Context
- NEET is NCERT-first — always anchor advice to NCERT chapters
- Biology carries 50% weightage — emphasize accordingly
- Include assertion-reason question strategy
- Reference NMC/NTA syllabus updates for current year
- Link to /exams/neet and /practice/neet-pyq`,

      GATE: `## GATE-Specific Context
- GATE has 65 questions: 10 General Aptitude + 55 Technical
- Specify which branch (CSE/ECE/ME/CE/EE) when relevant
- Include numerical answer type (NAT) strategy — no negative marking
- Reference GATE score vs rank vs PSU cutoffs
- Link to /exams/gate and /practice/gate-pyq`,

      UPSC: `## UPSC-Specific Context
- UPSC CSE has 3 stages: Prelims, Mains, Interview
- Prelims: 200 Qs × 2 papers (GS + CSAT)
- Mains: 9 papers, 7 count for merit
- Connect to optional subjects where relevant
- Emphasize answer writing and current affairs
- Link to /exams/upsc`,

      CAT: `## CAT-Specific Context
- CAT has 3 sections: VARC, DILR, QA (66 Qs total, 2h)
- IIM cutoffs vary significantly — mention range (90-99.5 percentile)
- Include time management for section-wise strategy
- Reference mock test importance for CAT
- Link to /exams/cat`,

      CUET: `## CUET-Specific Context
- CUET UG replaced DU/central university entrance
- Domain subjects vary by program — specify when relevant
- NCERT-based for most subjects
- Include university-specific cutoff trends
- Link to /exams/cuet`,
    },
  },

  competitor_move: {
    signalType: 'competitor_move',
    triggerAgent: 'venture_scout',
    triggerSubAgent: 'CompetitorSpy',
    systemPrompt: `You are Atlas, EduGenius's AI Content Engine, executing a CompetitorSpy counter-content brief. Your mission: create definitively superior content on the same topic without naming competitors.

Principles:
1. NEVER name the competitor
2. Be substantively better — more depth, more current, more accurate
3. Highlight EduGenius's AI personalization angle naturally
4. Set a higher standard, don't react`,

    userPromptTemplate: `Write a definitive counter-content blog post.

**CompetitorSpy Signal Context:**
This post is triggered by a competitor move detected by VentureScout.CompetitorSpy:
- Competitor Action: {{competitorAction}}
- Exam/Topic: {{examTag}}
- Our Strategic Response: {{ourResponse}}
- Suggested Title: {{suggestedTitle}}
- Angle: {{suggestedAngle}}
- Target Keywords: {{targetKeywords}}

Write a blog post that is definitively superior. DO NOT mention the competitor. Outperform through depth, accuracy, and EduGenius's personalization angle.`,

    qualityChecks: [
      'No competitor names present',
      'Content is longer and deeper than generic guides on this topic',
      'EduGenius personalization angle present',
      'qualityScore ≥ 88',
      'seoScore ≥ 85',
    ],

    examSpecificModifiers: {
      JEE: `Focus on AI-personalized prep vs one-size-fits-all — JEE students have wildly different starting points. Our multi-modal approach addresses this.`,
      NEET: `Emphasize that NCERT accuracy matters more than quantity of resources. EduGenius ensures every explanation is NCERT-anchored.`,
      GATE: `GATE is about depth per topic, not breadth. EduGenius's deep-learning mode is purpose-built for this.`,
    },
  },

  news_event: {
    signalType: 'news_event',
    triggerAgent: 'venture_scout',
    triggerSubAgent: 'NewsMonitor',
    systemPrompt: `You are Atlas, EduGenius's AI Content Engine, responding to a breaking news signal from VentureScout.NewsMonitor. This is time-sensitive content that must be published within hours of the news.

News-response content principles:
1. ACCURACY FIRST — only report verified facts from official NTA/CBSE/exam body sources
2. Student impact first: "What does this mean for MY preparation?"
3. Actionable next steps immediately
4. Update-friendly structure: include "Last Updated" and easy-to-refresh sections
5. Speed + quality: this must be high quality AND fast`,

    userPromptTemplate: `Write an urgent news-response blog post.

**NewsMonitor Signal Context:**
This post is triggered by a news event detected by VentureScout.NewsMonitor:
- News Title: "{{newsTitle}}"
- Student Impact: {{newsImpact}}
- Exam: {{examTag}}
- Suggested Title: {{suggestedTitle}}
- Angle: {{suggestedAngle}}
- Keywords: {{targetKeywords}}

Write a clear, accurate, student-focused response to this news. Lead with the student impact, then explain the news, then provide actionable next steps.`,

    qualityChecks: [
      'No unverified claims — only official source information',
      'Student impact addressed in first paragraph',
      'At least 3 specific next steps for students',
      'Update-friendly structure (clearly dated sections)',
      'Link to official source recommended',
    ],

    examSpecificModifiers: {
      JEE: `Reference official NTA website (nta.ac.in) for authoritative dates and notifications.`,
      NEET: `Reference NTA NEET portal. Include state counseling implications where relevant.`,
      UPSC: `Reference UPSC official calendar (upsc.gov.in). Include interview stage implications if mains result news.`,
    },
  },

  seo_gap: {
    signalType: 'seo_gap',
    triggerAgent: 'growth_commander',
    triggerSubAgent: 'SEOStrategist',
    systemPrompt: `You are Atlas, EduGenius's AI Content Engine, executing a GrowthCommander.SEOStrategist gap-fill brief. A keyword opportunity has been identified where existing top-ranking content is weak.

SEO gap-fill principles:
1. Answer the search intent completely and immediately
2. Be definitively the best resource on this keyword
3. Use semantic coverage: cover the topic thoroughly, use related terms
4. Structure for featured snippet capture (clear Q&A, tables, lists)
5. Quality is the ranking strategy`,

    userPromptTemplate: `Write an SEO gap-fill blog post.

**SEOStrategist Signal Context:**
This post is triggered by a keyword gap signal from GrowthCommander.SEOStrategist:
- Target Keyword: "{{keyword}}"
- Search Volume: {{searchVolume}}/month
- YoY Growth: +{{yoyGrowth}}%
- Opportunity Score: {{opportunityScore}}/100
- Exam: {{examTag}}
- Suggested Title: {{suggestedTitle}}
- Secondary Keywords: {{targetKeywords}}
- Angle: {{suggestedAngle}}

Write the most comprehensive, accurate resource on "{{keyword}}" for {{examTag}} students. Outperform the current top-ranking content through depth, structure, and freshness.`,

    qualityChecks: [
      'Primary keyword in first 100 words',
      'FAQ section present (≥3 questions)',
      'At least one data table or comparison',
      'seoScore ≥ 88 (answer-first, structured, semantic)',
      'Featured snippet optimized (clear definition or list in first 150 words)',
    ],

    examSpecificModifiers: {
      GATE: `Include subject-branch specificity. GATE searchers want branch-specific answers (CSE vs ECE vs ME).`,
      CAT: `Include percentile context — CAT searchers think in percentile terms, not raw scores.`,
      UPSC: `Include stage-specificity. UPSC searchers are at specific stages (Prelims aspirant vs Mains writer).`,
    },
  },

  churn_risk: {
    signalType: 'churn_risk',
    triggerAgent: 'revenue_architect',
    systemPrompt: `You are Atlas, EduGenius's AI Content Engine, executing a RevenueArchitect.ChurnPredictor retention brief. A cohort of students is showing churn signals — they're demotivated, disengaged, or doubting their prep.

Retention content principles:
1. EMPATHY leads — these students are struggling
2. Rekindle motivation through evidence: success is achievable
3. Provide a clear re-engagement path
4. Highlight EduGenius features that address their specific drop-off pattern
5. The goal: bring them back to the app and rebuild momentum`,

    userPromptTemplate: `Write a retention-focused blog post.

**ChurnPredictor Signal Context:**
This post is triggered by a churn risk signal from RevenueArchitect.ChurnPredictor:
- At-Risk Cohort: {{cohortId}}
- Churn Rate in Cohort: {{churnRate}}%
- Exam: {{examTag}}
- Retention Angle: {{retentionAngle}}
- Suggested Title: {{suggestedTitle}}

Write an empathetic, motivating blog post that addresses why students in this cohort disengage and provides a clear path back to consistent preparation.`,

    qualityChecks: [
      'Opens with empathy, not advice',
      'Addresses the specific churn pattern (not generic motivation)',
      'Clear re-engagement path with specific next steps',
      'EduGenius feature highlighted as the re-engagement tool',
      'No toxic positivity',
    ],

    examSpecificModifiers: {
      JEE: `JEE churn often happens at Organic Chemistry (conceptual difficulty) or after first mock test failure. Address specifically.`,
      NEET: `NEET churn peaks at Biology memorization fatigue (~3 months in). Address retention through active recall strategies.`,
    },
  },

  pain_point: {
    signalType: 'pain_point',
    triggerAgent: 'mentor',
    systemPrompt: `You are Atlas, EduGenius's AI Content Engine, executing a Mentor pain-point brief. Mentor's AI coaching sessions have surfaced a widespread student struggle. Your job is to write a blog post that makes students feel deeply understood and genuinely helped.

Pain-point blog principles:
1. Lead with empathy — validate the struggle
2. Write like you understand their exact experience
3. Solutions must be actionable TODAY, not theoretical
4. Connect to EduGenius naturally where it genuinely helps
5. Make them feel: understood → hopeful → empowered`,

    userPromptTemplate: `Write an empathy-first blog post addressing a student pain point.

**Mentor Signal Context:**
This post is triggered by a pain point signal from Mentor:
- Pain Point: "{{painPoint}}"
- Exam: {{examTag}}
- Reported by: {{painFrequency}} students in the last 7 days
- Suggested Title: {{suggestedTitle}}
- Angle: {{suggestedAngle}}
- Keywords: {{targetKeywords}}

Write a blog post that makes students experiencing "{{painPoint}}" feel understood and gives them a concrete path forward.`,

    qualityChecks: [
      'Opens with student scenario in second person',
      'Root cause analysis present (WHY this happens)',
      'At least 3 actionable strategies with specific steps',
      'EduGenius mention is natural and relevant',
      'No dismissive language',
    ],

    examSpecificModifiers: {
      JEE: `Common JEE pain points: Organic Chemistry mechanisms, Waves & Optics, formula overload in P-Chem. Be specific.`,
      NEET: `Common NEET pain points: Biology diagram retention, Plant Physiology details, Genetics problem-solving. Be specific.`,
      GATE: `Common GATE pain points: Algorithms time complexity proofs, OS scheduling algorithms, DBMS normalization. Be specific.`,
      UPSC: `Common UPSC pain points: Answer writing within word limits, current affairs retention, Ethics paper abstract questions. Be specific.`,
    },
  },

  campaign_need: {
    signalType: 'campaign_need',
    triggerAgent: 'herald',
    systemPrompt: `You are Atlas, EduGenius's AI Content Engine, executing a Herald campaign-support brief. A marketing campaign is live and needs blog content that:
1. Supports campaign objectives with organic reach
2. Acts as a high-quality landing zone for campaign traffic
3. Works standalone as a genuine educational resource
4. Has stronger CTAs than standard blog content`,

    userPromptTemplate: `Write a campaign-support blog post.

**Herald Signal Context:**
This post is triggered by a campaign need signal from Herald:
- Campaign ID: {{campaignId}}
- Campaign Objective: "{{campaignObjective}}"
- Exam: {{examTag}}
- Suggested Title: {{suggestedTitle}}
- Angle: {{suggestedAngle}}
- Keywords: {{targetKeywords}}

Write a blog post that serves both organic searchers and campaign traffic. Content must be genuinely useful AND conversion-optimized. Include social-share quotes and stronger CTAs than standard posts.`,

    qualityChecks: [
      'Content works standalone as a genuine resource',
      'Campaign objective woven naturally',
      'Social-share quotes extracted',
      'At least 2 CTAs (mid-article + closing)',
      'qualityScore ≥ 83',
    ],

    examSpecificModifiers: {
      JEE: `JEE campaign content performs best with specific score targets and rank ranges. Make promises data-backed.`,
      NEET: `NEET campaign content should reference MBBS seat availability and state counseling — high conversion triggers.`,
    },
  },

  exam_change: {
    signalType: 'exam_change',
    triggerAgent: 'oracle',
    systemPrompt: `You are Atlas, EduGenius's AI Content Engine, responding to an exam change signal from Oracle. Oracle has detected a change in exam pattern, syllabus, or scoring that affects student preparation.

Exam change content principles:
1. Accuracy is paramount — only report verified changes
2. Impact analysis: what specifically changes for students
3. Updated preparation advice based on the new pattern
4. Position EduGenius as adapting to the change (our content/AI updates)`,

    userPromptTemplate: `Write an exam-change blog post.

**Oracle Signal Context:**
This post is triggered by an exam change signal from Oracle:
- Exam: {{examTag}}
- Suggested Title: {{suggestedTitle}}
- Angle: {{suggestedAngle}}
- Keywords: {{targetKeywords}}

Write a clear, accurate post explaining the exam change, its student impact, and updated preparation strategies.`,

    qualityChecks: [
      'Change source verified (official exam body)',
      'Before/after comparison present',
      'Updated preparation advice specific to the change',
      'Clearly dated and marked as breaking/updated',
    ],

    examSpecificModifiers: {
      JEE: `Always reference NTA official circular number when citing JEE changes.`,
      NEET: `NEET pattern changes require MCC counseling implications section.`,
    },
  },
};

// ─── Legacy v1 Interfaces (preserved for backward compatibility) ──────────────

export interface BlogGenerationContext {
  topic: string;
  targetExam: 'JEE' | 'NEET' | 'CBSE';
  contentType: 'educational' | 'tips' | 'strategy' | 'motivation' | 'news';
  primaryKeyword: string;
  targetWordCount: number;
  featurestoHighlight: string[];
}

// ─── Signal Context Injector ──────────────────────────────────────────────────

function buildSignalContextBlock(signal: StrategySignal): string {
  const { signalType, sourceAgent, subAgent, payload, priority } = signal;

  let context = `\n---\n## 🤖 Strategy Signal Context (injected by ${sourceAgent}${subAgent ? `.${subAgent}` : ''})\n`;
  context += `**Signal Type:** ${signalType} | **Priority:** ${priority}\n\n`;

  switch (signalType) {
    case 'trending_keyword':
      context += `This post is triggered by a **trending keyword signal** from VentureScout.TrendRadar:\n`;
      context += `- **Keyword:** "${payload.keyword}"\n`;
      context += `- **Search Volume:** ${payload.searchVolume?.toLocaleString()} searches/month\n`;
      context += `- **YoY Growth:** +${payload.yoyGrowth}%\n`;
      context += `- **Opportunity Score:** ${payload.opportunityScore}/100\n`;
      context += `- **Exam Target:** ${payload.examTag}\n`;
      if (payload.suggestedTitle) context += `- **Suggested Title:** ${payload.suggestedTitle}\n`;
      break;

    case 'competitor_move':
      context += `This post is triggered by a **competitor move signal** from VentureScout.CompetitorSpy:\n`;
      context += `- **Competitor Action:** ${payload.competitorAction}\n`;
      context += `- **Our Strategic Response:** ${payload.ourResponse}\n`;
      context += `- **Exam:** ${payload.examTag}\n`;
      break;

    case 'news_event':
      context += `This post is triggered by a **news event signal** from VentureScout.NewsMonitor:\n`;
      context += `- **News:** "${payload.newsTitle}"\n`;
      context += `- **Student Impact:** ${payload.newsImpact}\n`;
      context += `- **Urgency:** Publish within 24 hours\n`;
      break;

    case 'seo_gap':
      context += `This post is triggered by an **SEO gap signal** from GrowthCommander.SEOStrategist:\n`;
      context += `- **Gap Keyword:** "${payload.keyword}"\n`;
      context += `- **Search Volume:** ${payload.searchVolume?.toLocaleString()}/month\n`;
      context += `- **Opportunity Score:** ${payload.opportunityScore}/100\n`;
      break;

    case 'churn_risk':
      context += `This post is triggered by a **churn risk signal** from RevenueArchitect.ChurnPredictor:\n`;
      context += `- **At-Risk Cohort:** ${payload.cohortId}\n`;
      context += `- **Churn Rate:** ${payload.churnRate}%\n`;
      context += `- **Retention Angle:** ${payload.retentionAngle}\n`;
      break;

    case 'pain_point':
      context += `This post is triggered by a **student pain point signal** from Mentor:\n`;
      context += `- **Pain Point:** "${payload.painPoint}"\n`;
      context += `- **Frequency:** ${payload.painFrequency} students reported this in the last 7 days\n`;
      break;

    case 'campaign_need':
      context += `This post is triggered by a **campaign need signal** from Herald:\n`;
      context += `- **Campaign:** ${payload.campaignId}\n`;
      context += `- **Objective:** ${payload.campaignObjective}\n`;
      break;

    case 'exam_change':
      context += `This post is triggered by an **exam change signal** from Oracle:\n`;
      context += `- **Exam:** ${payload.examTag}\n`;
      break;
  }

  context += `---\n`;
  return context;
}

// ─── v1 buildBlogPrompt (preserved) ──────────────────────────────────────────

export function buildBlogPrompt(context: BlogGenerationContext): string {
  const { topic, targetExam, contentType, primaryKeyword, targetWordCount, featurestoHighlight } = context;

  const featureConfigs = featurestoHighlight
    .map(f => featureMarketingConfigs[f])
    .filter(Boolean);

  const relevantLinks = internalLinkLibrary.filter(link =>
    link.context.toLowerCase().includes(topic.toLowerCase()) ||
    link.context.toLowerCase().includes(targetExam.toLowerCase())
  );

  let prompt = `
You are writing a blog post for EduGenius, an AI-powered tutoring platform for ${targetExam} preparation.

## CONTENT CONTEXT
- **Topic:** ${topic}
- **Target Exam:** ${targetExam}
- **Content Type:** ${contentType}
- **Primary Keyword:** ${primaryKeyword}
- **Target Word Count:** ${targetWordCount}

## TONE & STYLE
${contentPromptModifiers.blog.tone}

## AUDIENCE
${contentPromptModifiers.blog.audience}

## STRUCTURE REQUIREMENTS
${contentPromptModifiers.blog.structure}

## SEO REQUIREMENTS
${contentPromptModifiers.blog.seo}
- Primary keyword "${primaryKeyword}" must appear in:
  - Title
  - First 100 words
  - At least 2 H2 headings
  - Meta description
  - Conclusion

## INTERNAL LINKING (CRITICAL)
You MUST include at least 3 internal links to EduGenius portal. Use these relevant links:
${relevantLinks.map(link => `- "${link.anchorText}" → ${link.targetPath} (use when: ${link.context})`).join('\n')}

Link format: [anchor text](/path)
Make links feel natural, not forced.

## FEATURE SHOWCASING
`;

  if (featureConfigs.length > 0) {
    prompt += `\nNaturally showcase these EduGenius features (do NOT be salesy):\n`;
    for (const feature of featureConfigs) {
      prompt += `
### ${feature.featureName}
- **Tagline:** ${feature.tagline}
- **Short Description:** ${feature.shortDescription}
- **Portal Link:** ${feature.portalPath}
- **CTA Text:** ${feature.ctaText}
- **Benefits to mention:** ${feature.benefits.slice(0, 3).join(', ')}

When mentioning this feature:
- Connect it to the problem being discussed
- Show how it solves a specific pain point
- Use the exact CTA text for call-to-action links
`;
    }
  }

  prompt += `
## CALL-TO-ACTION PLACEMENT
${contentPromptModifiers.blog.cta}

Include:
1. **Soft CTA (middle of article):** A natural mention of how EduGenius helps with this topic
2. **Strong CTA (end):** Clear invitation to try the relevant feature

## THINGS TO AVOID
${contentPromptModifiers.blog.avoid}

## OUTPUT FORMAT
Return the blog post in Markdown format with:
- SEO-optimized title (H1)
- Meta description (first line, italicized)
- Clear H2 and H3 structure
- Internal links using markdown format
- Feature CTAs using button-style formatting: [CTA Text](/path){.cta-button}

Begin writing:
`;

  return prompt;
}

// ─── Content-Specific Prompts (v1, preserved) ────────────────────────────────

export const contentTypePrompts: Record<string, string> = {
  educational: `
## EDUCATIONAL CONTENT STRUCTURE
1. **Hook (100 words):** Interesting fact or question about the topic
2. **Concept Introduction (200 words):** Clear explanation with real-world analogy
3. **Deep Dive (400 words):** Detailed explanation with examples
   - Include at least one internal link to EduGenius learning resources
4. **Visual Explanation (200 words):** Reference to diagrams, simulations
   - Link to EduGenius interactive simulations if relevant
5. **Common Mistakes (150 words):** What students get wrong
   - Mention how EduGenius Exam Prep Mode helps avoid these
6. **Practice Tips (150 words):** How to apply this knowledge
   - Link to EduGenius practice section
7. **Conclusion (100 words):** Summary with CTA to learn more on portal
`,

  tips: `
## TIPS CONTENT STRUCTURE
1. **Hook (50 words):** Why these tips will help score better
2. **Tip List (600 words):** 5-7 actionable tips
   - Each tip: Title → Explanation → Example → Quick Action
   - Include feature mentions naturally:
     * Tip about time management → mention Exam Prep Mode
     * Tip about revision → mention Smart Notebook
     * Tip about visual learning → mention Interactive Simulations
3. **Bonus Tip (100 words):** Feature-specific tip
   - "Pro tip: Use EduGenius [Feature] to [benefit]"
4. **Action Steps (100 words):** What to do now
   - Include CTA to try the relevant feature
`,

  strategy: `
## STRATEGY CONTENT STRUCTURE
1. **Current State (150 words):** Where most students are vs where they should be
2. **Strategy Overview (100 words):** The approach being recommended
3. **Phase-by-Phase Breakdown (500 words):**
   - Each phase should naturally connect to an EduGenius feature
   - Deep Learning Mode for foundation building
   - Practice Mode for problem-solving phase
   - Exam Prep Mode for final revision
4. **Tools & Resources (150 words):**
   - Direct recommendations for EduGenius features
   - Links to relevant portal sections
5. **Weekly/Monthly Plan (100 words):** Concrete timeline
6. **Next Step (100 words):** Clear CTA to start implementing with EduGenius
`,

  motivation: `
## MOTIVATION CONTENT STRUCTURE
1. **Relatable Opening (150 words):** Acknowledge the struggle
2. **Mindset Shift (200 words):** The key perspective change needed
3. **Success Story (150 words):** Student example (can be composite)
   - Mention how EduGenius features helped
4. **Practical Steps (200 words):** How to apply this mindset
   - Connect each step to a learning behavior
   - Subtly mention how portal supports these behaviors
5. **Daily Habits (150 words):** Small changes for big impact
6. **Encouragement (100 words):** Motivating close with soft CTA
`,
};

// ─── Exam-Specific Prompts (v1 + new exams) ──────────────────────────────────

export const examSpecificPrompts: Record<string, string> = {
  JEE: `
## JEE-SPECIFIC GUIDELINES
- Reference JEE Main and JEE Advanced patterns
- Use Physics/Chemistry/Mathematics examples
- Mention numerical answer type questions
- Reference expected marks distribution
- Connect to IIT/NIT goals
- Use competitive tone but not discouraging
- Link to JEE-specific resources: /exams/jee-main, /practice/jee-pyq
`,

  NEET: `
## NEET-SPECIFIC GUIDELINES
- Focus on Biology (more weight than Physics/Chemistry)
- Reference NCERT as the primary source
- Mention MBBS/BDS/BAMS admission context
- Use medical/health examples for Physics/Chemistry
- Include assertion-reason type questions
- Emphasize conceptual clarity over shortcuts
- Link to NEET-specific resources: /exams/neet, /practice/neet-pyq
`,

  CBSE: `
## CBSE-SPECIFIC GUIDELINES
- Follow NCERT strictly
- Reference board exam patterns
- Include HOTS (Higher Order Thinking Skills) questions
- Mention internal assessment and practicals
- Use moderate difficulty examples
- Emphasize complete syllabus coverage
- Link to CBSE resources: /exams/cbse-12, /exams/cbse-10
`,

  GATE: `
## GATE-SPECIFIC GUIDELINES
- Specify branch: CSE/ECE/ME/CE/EE
- Include Numerical Answer Type (NAT) strategy — no negative marking
- Reference GATE score normalization process
- Connect to PSU recruitment and M.Tech admissions
- Emphasize depth over breadth — GATE rewards expertise
- Link to: /exams/gate, /practice/gate-pyq
`,

  UPSC: `
## UPSC-SPECIFIC GUIDELINES
- Distinguish between Prelims (objective) and Mains (subjective)
- Include current affairs integration strategy
- Reference NCERT foundation for GS
- Mention optional subject selection strategy
- Emphasize answer writing skills for Mains
- Link to: /exams/upsc
`,

  CAT: `
## CAT-SPECIFIC GUIDELINES
- Three sections: VARC, DILR, QA (66 Qs, 2h total)
- Think in percentile terms, not raw scores
- Include time management for section-switching
- Reference IIM vs non-IIM CAT usage
- Emphasize mock test importance (50+ mocks recommended)
- Link to: /exams/cat
`,

  CUET: `
## CUET-SPECIFIC GUIDELINES
- Covers Domain Subjects + General Test + Languages
- NCERT-based for most domain subjects
- Reference university-specific program requirements
- Include score normalization awareness
- Multiple attempts across sessions
- Link to: /exams/cuet
`,
};

// ─── Topic-to-Feature Mapping (v1, preserved) ────────────────────────────────

export const topicFeatureMapping: Record<string, string[]> = {
  'mechanics': ['interactive_resources', 'learning_modes'],
  'kinematics': ['interactive_resources', 'exam_prep_mode'],
  'projectile motion': ['interactive_resources', 'exam_prep_mode'],
  'thermodynamics': ['learning_modes', 'smart_notebook'],
  'electromagnetism': ['interactive_resources', 'learning_modes'],
  'optics': ['interactive_resources', 'learning_modes'],
  'modern physics': ['learning_modes', 'exam_prep_mode'],
  'organic chemistry': ['learning_modes', 'smart_notebook'],
  'inorganic chemistry': ['exam_prep_mode', 'smart_notebook'],
  'physical chemistry': ['learning_modes', 'interactive_resources'],
  'chemical bonding': ['interactive_resources', 'learning_modes'],
  'electrochemistry': ['exam_prep_mode', 'smart_notebook'],
  'calculus': ['learning_modes', 'interactive_resources'],
  'algebra': ['exam_prep_mode', 'smart_notebook'],
  'coordinate geometry': ['interactive_resources', 'learning_modes'],
  'trigonometry': ['interactive_resources', 'exam_prep_mode'],
  'probability': ['learning_modes', 'exam_prep_mode'],
  'genetics': ['learning_modes', 'smart_notebook'],
  'human physiology': ['interactive_resources', 'learning_modes'],
  'ecology': ['learning_modes', 'smart_notebook'],
  'cell biology': ['interactive_resources', 'learning_modes'],
  'time management': ['exam_prep_mode', 'smart_notebook'],
  'revision': ['smart_notebook', 'exam_prep_mode'],
  'exam strategy': ['exam_prep_mode', 'learning_modes'],
  'study planning': ['smart_notebook', 'multi_channel'],
  'note-taking': ['smart_notebook', 'multi_channel'],
  // GATE-specific
  'algorithms': ['learning_modes', 'interactive_resources'],
  'operating systems': ['learning_modes', 'smart_notebook'],
  'database management': ['exam_prep_mode', 'smart_notebook'],
  'computer networks': ['learning_modes', 'interactive_resources'],
  // UPSC-specific
  'current affairs': ['smart_notebook', 'multi_channel'],
  'answer writing': ['learning_modes', 'smart_notebook'],
  'optional subject': ['learning_modes', 'exam_prep_mode'],
  // CAT-specific
  'verbal ability': ['learning_modes', 'smart_notebook'],
  'data interpretation': ['interactive_resources', 'exam_prep_mode'],
  'quantitative aptitude': ['interactive_resources', 'learning_modes'],
  // General
  'general': ['learning_modes', 'smart_notebook', 'multi_channel'],
};

export function getFeaturesToHighlight(topic: string): string[] {
  const normalizedTopic = topic.toLowerCase();
  if (topicFeatureMapping[normalizedTopic]) return topicFeatureMapping[normalizedTopic];
  for (const [key, features] of Object.entries(topicFeatureMapping)) {
    if (normalizedTopic.includes(key) || key.includes(normalizedTopic)) return features;
  }
  return topicFeatureMapping['general'];
}

// ─── Enhanced generateCompleteBlogPrompt ─────────────────────────────────────

export function generateCompleteBlogPrompt(
  topic: string,
  exam: 'JEE' | 'NEET' | 'CBSE' | string,
  contentType: keyof typeof contentTypePrompts = 'educational',
  primaryKeyword?: string,
  signal?: StrategySignal
): string {
  const features = getFeaturesToHighlight(topic);

  const context: BlogGenerationContext = {
    topic,
    targetExam: (exam as 'JEE' | 'NEET' | 'CBSE') || 'JEE',
    contentType: contentType as BlogGenerationContext['contentType'],
    primaryKeyword: primaryKeyword || `${topic} for ${exam}`,
    targetWordCount: 1200,
    featurestoHighlight: features,
  };

  let prompt = buildBlogPrompt(context);

  // Inject strategy signal context if provided
  if (signal) {
    const signalBlock = buildSignalContextBlock(signal);
    prompt = signalBlock + '\n' + prompt;

    // Get the registry entry for this signal type
    const registryEntry = PROMPT_REGISTRY[signal.signalType];
    if (registryEntry) {
      prompt += '\n\n## Signal-Specific Instructions\n' + registryEntry.userPromptTemplate;

      // Inject exam-specific modifier from registry
      const examModifier = registryEntry.examSpecificModifiers?.[exam as ExtendedExamTag];
      if (examModifier) {
        prompt += '\n\n' + examModifier;
      }

      // Quality checks
      prompt += '\n\n## Quality Checks (Atlas must verify before submitting)\n';
      registryEntry.qualityChecks.forEach((check, i) => {
        prompt += `${i + 1}. ${check}\n`;
      });
    }
  }

  // Append content type structure
  if (contentTypePrompts[contentType]) {
    prompt += '\n' + contentTypePrompts[contentType];
  }

  // Append exam-specific prompt
  const examKey = exam.replace('_10', '').replace('_12', '');
  if (examSpecificPrompts[examKey]) {
    prompt += '\n' + examSpecificPrompts[examKey];
  }

  return prompt;
}

// ─── Export (v1 compatible + new) ────────────────────────────────────────────

export const BlogPromptModifiers = {
  buildBlogPrompt,
  contentTypePrompts,
  examSpecificPrompts,
  topicFeatureMapping,
  getFeaturesToHighlight,
  generateCompleteBlogPrompt,
  PROMPT_REGISTRY,
  EXAM_TAG_META,
  buildSignalContextBlock,
};

export default BlogPromptModifiers;
