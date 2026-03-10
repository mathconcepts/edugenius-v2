/**
 * dynamicPromptsSkill.ts — Template-Driven Prompt Construction
 * VoltAgent pattern: Dynamic prompts built from templates + live data.
 *
 * Replaces hardcoded strings in atlasTaskService and sagePersonaPrompts
 * with composable, versioned, testable prompt templates.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PromptTemplate {
  id: string;
  agentId: string; // 'sage' | 'atlas' | 'herald' | 'scout' | 'oracle' | 'mentor'
  name: string;
  description: string;
  version: string; // semver e.g. "1.2.0"
  template: string; // Handlebars-style: {{variable}}
  variables: { key: string; description: string; required: boolean }[];
  tags: string[];
  metrics?: { avgScore?: number; uses?: number };
}

// ─── Built-in templates ───────────────────────────────────────────────────────

export const PROMPT_TEMPLATES: PromptTemplate[] = [
  // ── Sage templates ──────────────────────────────────────────────────────────
  {
    id: 'sage-mcq-socratic',
    agentId: 'sage',
    name: 'MCQ Socratic Guide',
    version: '1.0.0',
    description: 'Guide student to MCQ answer via questions, never reveal directly',
    template: `You are Sage, an expert {{exam}} tutor. The student is attempting:

{{question}}

Options: {{options}}

Do NOT reveal the answer. Instead:
1. Ask what concepts relate to this
2. Guide them to eliminate wrong options
3. Celebrate when they get it right

Student level: {{difficulty}}. Emotional state: {{mood}}.`,
    variables: [
      { key: 'exam',       description: 'Exam name',            required: true },
      { key: 'question',   description: 'The MCQ question',     required: true },
      { key: 'options',    description: 'A, B, C, D options',   required: true },
      { key: 'difficulty', description: 'easy/medium/hard',     required: false },
      { key: 'mood',       description: 'frustrated/confident/neutral', required: false },
    ],
    tags: ['sage', 'mcq', 'socratic'],
  },

  {
    id: 'sage-worked-example',
    agentId: 'sage',
    name: 'Worked Example Explainer',
    version: '1.0.0',
    description: 'Full worked solution with labelled steps and common mistakes',
    template: `You are Sage. Solve this {{exam}} {{topic}} problem step by step:

{{question}}

Requirements:
1. Label every step clearly
2. Show all algebra — skip nothing
3. State the formula before using it
4. Call out ONE common mistake students make here
5. End with: "Key insight: [one sentence takeaway]"

Student tier: {{tier}}. Use {{language}} where helpful.`,
    variables: [
      { key: 'exam',      description: 'Exam name',            required: true },
      { key: 'topic',     description: 'Topic name',           required: true },
      { key: 'question',  description: 'The problem to solve', required: true },
      { key: 'tier',      description: 'struggling/average/good/advanced', required: false },
      { key: 'language',  description: 'Language preference',  required: false },
    ],
    tags: ['sage', 'worked-example', 'math', 'physics'],
  },

  // ── Atlas templates ─────────────────────────────────────────────────────────
  {
    id: 'atlas-content-gen',
    agentId: 'atlas',
    name: 'Content Atom Generator',
    version: '1.0.0',
    description: 'Generate a ContentAtom for a specific topic and atom type',
    template: `You are Atlas, EduGenius content engine. Generate a {{atomType}} for:

Topic: {{topic}}
Exam: {{exam}}
Difficulty: {{difficulty}}
Target student level: {{level}}
Strategy: {{strategy}}

Output as valid JSON matching the ContentAtom schema.`,
    variables: [
      { key: 'atomType',   description: 'mcq/flashcard/formula_card/worked_example etc.', required: true },
      { key: 'topic',      description: 'Specific topic',          required: true },
      { key: 'exam',       description: 'Exam name',               required: true },
      { key: 'difficulty', description: 'easy/medium/hard',        required: false },
      { key: 'level',      description: 'beginner/intermediate/advanced', required: false },
      { key: 'strategy',   description: 'Content strategy ID',     required: false },
    ],
    tags: ['atlas', 'generation'],
  },

  {
    id: 'atlas-pyq-explainer',
    agentId: 'atlas',
    name: 'PYQ Explainer',
    version: '1.0.0',
    description: 'Full explanation of a previous year question with teaching notes',
    template: `You are Atlas. Create a detailed explanation of this {{exam}} PYQ from {{year}}:

{{question}}

Official Answer: {{answer}}

Produce:
1. Step-by-step solution (label each step)
2. Key concept tested
3. Why wrong options are wrong (for MCQ)
4. Related topic connections
5. Teaching note for Sage (1 sentence on how to guide a stuck student)

Output as JSON: { solution, keyConcept, optionAnalysis, topicLinks, teachingNote }`,
    variables: [
      { key: 'exam',      description: 'Exam name',         required: true },
      { key: 'year',      description: 'Year of PYQ',       required: true },
      { key: 'question',  description: 'Full question text', required: true },
      { key: 'answer',    description: 'Official answer',   required: true },
    ],
    tags: ['atlas', 'pyq', 'explained'],
  },

  // ── Herald templates ────────────────────────────────────────────────────────
  {
    id: 'herald-blog-seo',
    agentId: 'herald',
    name: 'SEO Blog Post',
    version: '1.0.0',
    description: 'Full SEO blog post for a trending exam topic',
    template: `You are Herald, EduGenius marketing agent. Write a {{wordCount}}-word SEO blog post.

Keyword: {{keyword}}
Exam: {{exam}}
Angle: {{angle}}
Tone: {{tone}}
Target reader: {{reader}}

Structure: H1 → Hook → 3-5 H2 sections → FAQ → CTA
SEO: Include keyword in H1, first paragraph, 2 H2s, meta description at end.`,
    variables: [
      { key: 'keyword',   description: 'Primary SEO keyword',               required: true },
      { key: 'exam',      description: 'Target exam',                        required: true },
      { key: 'wordCount', description: 'Target word count',                  required: false },
      { key: 'angle',     description: 'Content angle/hook',                 required: false },
      { key: 'tone',      description: 'helpful/authoritative/conversational', required: false },
      { key: 'reader',    description: 'Student/teacher/parent',             required: false },
    ],
    tags: ['herald', 'blog', 'seo'],
  },

  {
    id: 'herald-whatsapp-blast',
    agentId: 'herald',
    name: 'WhatsApp Broadcast',
    version: '1.0.0',
    description: 'Exam-tip WhatsApp broadcast message for student community',
    template: `You are Herald. Write a WhatsApp broadcast message for {{exam}} students.

Topic tip: {{topic}}
Days to exam: {{daysToExam}}
Tone: {{tone}}

Rules:
- Max 300 characters
- Start with an emoji
- One clear tip + one action
- End with a CTA to the app
- No formal language — like a senior messaging juniors`,
    variables: [
      { key: 'exam',       description: 'Target exam',          required: true },
      { key: 'topic',      description: 'Topic for the tip',    required: true },
      { key: 'daysToExam', description: 'Days until exam',      required: false },
      { key: 'tone',       description: 'urgent/friendly/calm', required: false },
    ],
    tags: ['herald', 'whatsapp', 'broadcast'],
  },

  // ── Scout templates ─────────────────────────────────────────────────────────
  {
    id: 'scout-market-analysis',
    agentId: 'scout',
    name: 'Market Intelligence Brief',
    version: '1.0.0',
    description: 'Competitor and market analysis brief for a topic or exam segment',
    template: `You are Scout, EduGenius market intelligence agent.

Analyze the EdTech market for: {{segment}}

Provide:
1. Top 3 competitors and their weakness in this segment
2. Trending search queries students use
3. Content gaps (what competitors miss)
4. Recommended content type for EduGenius to win this segment
5. Estimated monthly search volume

Be specific and actionable.`,
    variables: [
      { key: 'segment', description: 'Market segment e.g. "GATE EM 2026"', required: true },
    ],
    tags: ['scout', 'market', 'intelligence'],
  },

  {
    id: 'scout-reddit-intel',
    agentId: 'scout',
    name: 'Reddit Student Voice Report',
    version: '1.0.0',
    description: 'Synthesise Reddit/Quora student discussions into actionable product insights',
    template: `You are Scout. Analyse these student discussions from r/{{subreddit}} and similar forums:

{{discussions}}

Extract:
1. Top 5 student pain points (verbatim quotes preferred)
2. Topics they find hardest
3. Resources they trust (competitors being praised)
4. Features they wish existed
5. Sentiment toward {{platform}} if mentioned

Output as: { painPoints[], hardTopics[], trustedResources[], wishedFeatures[], sentimentNote }`,
    variables: [
      { key: 'subreddit',   description: 'Subreddit name e.g. "GATE"', required: true },
      { key: 'discussions', description: 'Raw text of discussions',     required: true },
      { key: 'platform',    description: 'EduGenius or competitor name', required: false },
    ],
    tags: ['scout', 'reddit', 'voice-of-customer'],
  },

  // ── Mentor templates ────────────────────────────────────────────────────────
  {
    id: 'mentor-reengagement',
    agentId: 'mentor',
    name: 'Student Re-engagement',
    version: '1.0.0',
    description: 'Personalized re-engagement message for at-risk student',
    template: `You are Mentor, EduGenius student engagement agent.

Student: {{studentName}} | Exam: {{exam}} | Days inactive: {{daysInactive}} | Last topic: {{lastTopic}}
Streak lost: {{streakLost}} days | Score trend: {{scoreTrend}}

Write a {{channel}} message ({{maxChars}} chars max) that:
- Acknowledges their gap without guilt
- Reminds them of their goal
- Suggests one small action (5 min)
- Mentions {{daysToExam}} days remaining

Tone: warm, encouraging, real. No corporate fluff.`,
    variables: [
      { key: 'studentName',  description: 'Student first name',       required: true },
      { key: 'exam',         description: 'Target exam',              required: true },
      { key: 'daysInactive', description: 'Days since last login',    required: true },
      { key: 'lastTopic',    description: 'Last topic studied',       required: false },
      { key: 'streakLost',   description: 'Streak days lost',         required: false },
      { key: 'scoreTrend',   description: 'improving/declining/stable', required: false },
      { key: 'channel',      description: 'WhatsApp/Telegram/Email',  required: false },
      { key: 'maxChars',     description: 'Max character limit',      required: false },
      { key: 'daysToExam',   description: 'Days to exam',             required: false },
    ],
    tags: ['mentor', 'reengagement', 'whatsapp'],
  },

  {
    id: 'mentor-parent-update',
    agentId: 'mentor',
    name: 'Parent Progress Update',
    version: '1.0.0',
    description: 'Weekly progress summary for parents in plain language',
    template: `You are Mentor. Write a parent WhatsApp message for {{studentName}}'s progress this week.

Exam: {{exam}} | Days to exam: {{daysToExam}}
Topics covered: {{topicsCovered}}
Mock score: {{mockScore}} | Last week: {{lastWeekScore}}
Study time: {{studyHours}} hours | Streak: {{streak}} days

Write in warm, reassuring language (not report-card style).
Max 250 words. Parents are busy — get to the point.
End with one thing the parent can do to support.`,
    variables: [
      { key: 'studentName',   description: 'Student name',         required: true },
      { key: 'exam',          description: 'Target exam',          required: true },
      { key: 'daysToExam',    description: 'Days to exam',         required: false },
      { key: 'topicsCovered', description: 'Topics this week',     required: false },
      { key: 'mockScore',     description: 'Latest mock score',    required: false },
      { key: 'lastWeekScore', description: 'Last week mock score', required: false },
      { key: 'studyHours',    description: 'Hours studied',        required: false },
      { key: 'streak',        description: 'Study streak days',    required: false },
    ],
    tags: ['mentor', 'parent', 'weekly-report'],
  },

  // ── Oracle templates ────────────────────────────────────────────────────────
  {
    id: 'oracle-insight',
    agentId: 'oracle',
    name: 'Performance Insight',
    version: '1.0.0',
    description: 'Data-driven student performance insight for CEO briefing',
    template: `You are Oracle, EduGenius analytics agent.

Analyze this performance data for {{exam}}:

{{performanceData}}

Provide:
1. Top 3 actionable insights (specific, not generic)
2. Which topics need more content (high attempts, low scores)
3. Cohort comparison: how this student compares to top quartile
4. One recommendation for Sage (tutoring adjustment)
5. One recommendation for Atlas (content gap)

Be data-first. Every claim needs a number.`,
    variables: [
      { key: 'exam',            description: 'Target exam',                   required: true },
      { key: 'performanceData', description: 'JSON or text performance metrics', required: true },
    ],
    tags: ['oracle', 'analytics', 'insight'],
  },

  {
    id: 'oracle-churn-risk',
    agentId: 'oracle',
    name: 'Churn Risk Analysis',
    version: '1.0.0',
    description: 'Identify at-risk students and generate Mentor intervention triggers',
    template: `You are Oracle. Analyze this cohort data and identify at-risk students:

{{cohortData}}

For each at-risk student provide:
1. Risk score (0-100)
2. Primary churn signal (inactive/declining/frustrated)
3. Recommended Mentor message type (reengagement/encouragement/milestone)
4. Suggested content adjustment for Sage
5. Estimated days before dropout if no intervention

Output as JSON array: [{ studentId, riskScore, signal, mentorAction, sageAdjustment, daysToDropout }]`,
    variables: [
      { key: 'cohortData', description: 'Student activity + score data', required: true },
    ],
    tags: ['oracle', 'churn', 'risk'],
  },
];

// ─── Storage ──────────────────────────────────────────────────────────────────

const CUSTOM_TEMPLATES_KEY = 'edugenius_custom_prompt_templates';
const TEMPLATE_METRICS_KEY = 'edugenius_template_metrics';

// ─── Core functions ───────────────────────────────────────────────────────────

export function getTemplate(id: string): PromptTemplate | undefined {
  return getAllTemplates().find(t => t.id === id);
}

export function getTemplatesForAgent(agentId: string): PromptTemplate[] {
  return getAllTemplates().filter(t => t.agentId === agentId);
}

/**
 * Render a template with variables. Throws if a required variable is missing.
 */
export function renderTemplate(template: PromptTemplate, variables: Record<string, string>): string {
  // Validate required variables
  for (const v of template.variables) {
    if (v.required && !(v.key in variables)) {
      throw new Error(`Required variable "{{${v.key}}}" missing for template "${template.id}"`);
    }
  }

  // Replace all {{key}} occurrences
  let rendered = template.template;
  for (const [key, value] of Object.entries(variables)) {
    rendered = rendered.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
  }

  // Replace any unfilled optional variables with empty string
  rendered = rendered.replace(/\{\{[a-z_]+\}\}/g, '');

  return rendered.trim();
}

export function renderById(templateId: string, variables: Record<string, string>): string {
  const template = getTemplate(templateId);
  if (!template) throw new Error(`Template "${templateId}" not found`);
  return renderTemplate(template, variables);
}

// ─── Custom template CRUD ─────────────────────────────────────────────────────

export function saveCustomTemplate(template: Omit<PromptTemplate, 'metrics'>): void {
  const existing = getCustomTemplates();
  const idx = existing.findIndex(t => t.id === template.id);
  if (idx >= 0) {
    existing[idx] = { ...template, metrics: existing[idx].metrics };
  } else {
    existing.push({ ...template, metrics: { uses: 0 } });
  }
  try {
    localStorage.setItem(CUSTOM_TEMPLATES_KEY, JSON.stringify(existing));
  } catch { /* storage full */ }
}

export function getCustomTemplates(): PromptTemplate[] {
  try {
    const raw = localStorage.getItem(CUSTOM_TEMPLATES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function deleteCustomTemplate(id: string): void {
  const remaining = getCustomTemplates().filter(t => t.id !== id);
  try {
    localStorage.setItem(CUSTOM_TEMPLATES_KEY, JSON.stringify(remaining));
  } catch { /* storage full */ }
}

export function getAllTemplates(): PromptTemplate[] {
  const custom = getCustomTemplates();
  const metrics = getTemplateMetrics();

  // Merge metrics into built-in templates
  const builtInWithMetrics = PROMPT_TEMPLATES.map(t => ({
    ...t,
    metrics: metrics[t.id] ?? t.metrics ?? { uses: 0 },
  }));

  return [...builtInWithMetrics, ...custom];
}

// ─── Usage tracking ───────────────────────────────────────────────────────────

function getTemplateMetrics(): Record<string, { avgScore: number; uses: number }> {
  try {
    const raw = localStorage.getItem(TEMPLATE_METRICS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function recordTemplateUse(templateId: string, score?: number): void {
  try {
    const metrics = getTemplateMetrics();
    const existing = metrics[templateId] ?? { avgScore: 0, uses: 0 };
    const newUses = existing.uses + 1;
    const newAvg = score !== undefined
      ? Math.round((existing.avgScore * existing.uses + score) / newUses)
      : existing.avgScore;
    metrics[templateId] = { avgScore: newAvg, uses: newUses };
    localStorage.setItem(TEMPLATE_METRICS_KEY, JSON.stringify(metrics));
  } catch { /* silent */ }
}
