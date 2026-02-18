/**
 * Blog Prompt Modifiers for Herald Agent
 * 
 * These prompts ensure blog content:
 * 1. Showcases portal features naturally
 * 2. Includes proper internal linking
 * 3. Has SEO optimization
 * 4. Drives traffic to the portal
 * 
 * NO SIDE IMPACTS: These are new additions, not modifications
 */

import { featureMarketingConfigs, internalLinkLibrary, contentPromptModifiers } from './marketingIntegration';

// ============================================
// BLOG GENERATION PROMPT BUILDER
// ============================================

export interface BlogGenerationContext {
  topic: string;
  targetExam: 'JEE' | 'NEET' | 'CBSE';
  contentType: 'educational' | 'tips' | 'strategy' | 'motivation' | 'news';
  primaryKeyword: string;
  targetWordCount: number;
  featurestoHighlight: string[];
}

export function buildBlogPrompt(context: BlogGenerationContext): string {
  const { topic, targetExam, contentType, primaryKeyword, targetWordCount, featurestoHighlight } = context;
  
  // Get feature configs for highlighted features
  const featureConfigs = featurestoHighlight
    .map(f => featureMarketingConfigs[f])
    .filter(Boolean);
  
  // Get relevant internal links
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
    prompt += `
Naturally showcase these EduGenius features (do NOT be salesy):
`;
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

// ============================================
// CONTENT-SPECIFIC PROMPTS
// ============================================

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

// ============================================
// EXAM-SPECIFIC MODIFICATIONS
// ============================================

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
};

// ============================================
// TOPIC-TO-FEATURE MAPPING
// ============================================

export const topicFeatureMapping: Record<string, string[]> = {
  // Physics topics
  'mechanics': ['interactive_resources', 'learning_modes'],
  'kinematics': ['interactive_resources', 'exam_prep_mode'],
  'projectile motion': ['interactive_resources', 'exam_prep_mode'],
  'thermodynamics': ['learning_modes', 'smart_notebook'],
  'electromagnetism': ['interactive_resources', 'learning_modes'],
  'optics': ['interactive_resources', 'learning_modes'],
  'modern physics': ['learning_modes', 'exam_prep_mode'],
  
  // Chemistry topics
  'organic chemistry': ['learning_modes', 'smart_notebook'],
  'inorganic chemistry': ['exam_prep_mode', 'smart_notebook'],
  'physical chemistry': ['learning_modes', 'interactive_resources'],
  'chemical bonding': ['interactive_resources', 'learning_modes'],
  'electrochemistry': ['exam_prep_mode', 'smart_notebook'],
  
  // Mathematics topics
  'calculus': ['learning_modes', 'interactive_resources'],
  'algebra': ['exam_prep_mode', 'smart_notebook'],
  'coordinate geometry': ['interactive_resources', 'learning_modes'],
  'trigonometry': ['interactive_resources', 'exam_prep_mode'],
  'probability': ['learning_modes', 'exam_prep_mode'],
  
  // Biology topics (NEET)
  'genetics': ['learning_modes', 'smart_notebook'],
  'human physiology': ['interactive_resources', 'learning_modes'],
  'ecology': ['learning_modes', 'smart_notebook'],
  'cell biology': ['interactive_resources', 'learning_modes'],
  
  // Study strategies
  'time management': ['exam_prep_mode', 'smart_notebook'],
  'revision': ['smart_notebook', 'exam_prep_mode'],
  'exam strategy': ['exam_prep_mode', 'learning_modes'],
  'study planning': ['smart_notebook', 'multi_channel'],
  'note-taking': ['smart_notebook', 'multi_channel'],
  
  // Default
  'general': ['learning_modes', 'smart_notebook', 'multi_channel'],
};

export function getFeaturesToHighlight(topic: string): string[] {
  const normalizedTopic = topic.toLowerCase();
  
  // Check for exact match
  if (topicFeatureMapping[normalizedTopic]) {
    return topicFeatureMapping[normalizedTopic];
  }
  
  // Check for partial match
  for (const [key, features] of Object.entries(topicFeatureMapping)) {
    if (normalizedTopic.includes(key) || key.includes(normalizedTopic)) {
      return features;
    }
  }
  
  // Default features
  return topicFeatureMapping['general'];
}

// ============================================
// COMPLETE BLOG GENERATION
// ============================================

export function generateCompleteBlogPrompt(
  topic: string,
  exam: 'JEE' | 'NEET' | 'CBSE',
  contentType: keyof typeof contentTypePrompts = 'educational',
  primaryKeyword?: string
): string {
  const features = getFeaturesToHighlight(topic);
  
  const context: BlogGenerationContext = {
    topic,
    targetExam: exam,
    contentType: contentType as any,
    primaryKeyword: primaryKeyword || `${topic} for ${exam}`,
    targetWordCount: 1200,
    featurestoHighlight: features,
  };
  
  let prompt = buildBlogPrompt(context);
  prompt += '\n' + contentTypePrompts[contentType];
  prompt += '\n' + examSpecificPrompts[exam];
  
  return prompt;
}

// ============================================
// EXPORT
// ============================================

export const BlogPromptModifiers = {
  buildBlogPrompt,
  contentTypePrompts,
  examSpecificPrompts,
  topicFeatureMapping,
  getFeaturesToHighlight,
  generateCompleteBlogPrompt,
};

export default BlogPromptModifiers;
