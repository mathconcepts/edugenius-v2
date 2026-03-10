/**
 * contentRepurposingService.ts — Content Repurposing Engine
 *
 * Takes any ContentAtom or generated content and repurposes it across:
 *   - Channels: blog → X thread, YouTube → Instagram story, etc.
 *   - Exams: GATE EM → JEE Maths, CAT → JEE Quant, etc.
 *   - Audiences: student content → teacher guide, parent explainer
 *
 * All localStorage keys prefixed `edugenius_content_`.
 */

import { callLLM } from './llmService';
import type { ContentAtom } from './contentFramework';
import type {
  ContentChannel, ContentAudience, SupportedExam, GeneratedContent,
} from './contentGenerationHub';
import { generateContent } from './contentGenerationHub';

// ─── Exam overlap map ─────────────────────────────────────────────────────────

export interface ExamOverlapEntry {
  sharedTopics: string[];
  adapterNote: string;
}

export const EXAM_OVERLAP_MAP: Partial<Record<SupportedExam, Partial<Record<SupportedExam, ExamOverlapEntry>>>> = {
  GATE: {
    JEE: {
      sharedTopics: ['calculus', 'linear algebra', 'complex numbers', 'differential equations', 'probability'],
      adapterNote: 'Adapt engineering framing to JEE/advanced maths context. Remove engineering-specific applications.',
    },
    UPSC: {
      sharedTopics: ['engineering concepts', 'basic physics', 'mechanics', 'electricity'],
      adapterNote: 'Simplify to conceptual understanding. Remove deep maths. Add real-world policy context.',
    },
    CBSE: {
      sharedTopics: ['calculus', 'vectors', 'electromagnetism', 'thermodynamics'],
      adapterNote: 'Simplify to CBSE Class 11-12 level. Use NCERT terminology and examples.',
    },
  },
  JEE: {
    GATE: {
      sharedTopics: ['calculus', 'linear algebra', 'complex numbers', 'mechanics', 'electromagnetism'],
      adapterNote: 'Deepen engineering applications. Add signal processing and control systems context.',
    },
    NEET: {
      sharedTopics: ['physics fundamentals', 'optics', 'thermodynamics', 'waves'],
      adapterNote: 'Shift from engineering physics to biological physics. Add medical context.',
    },
    CAT: {
      sharedTopics: ['permutations', 'combinations', 'probability', 'algebra', 'geometry'],
      adapterNote: 'Reframe as quant aptitude. Remove calculus. Add data interpretation context.',
    },
    CBSE: {
      sharedTopics: ['calculus', 'algebra', 'coordinate geometry', 'probability', 'vectors'],
      adapterNote: 'Reduce difficulty to Class 12 board level. Use NCERT examples.',
    },
  },
  CAT: {
    JEE: {
      sharedTopics: ['permutations', 'combinations', 'probability', 'algebra', 'geometry', 'number theory'],
      adapterNote: 'Add engineering maths framing. Increase difficulty and depth.',
    },
    CBSE: {
      sharedTopics: ['algebra', 'geometry', 'statistics', 'probability'],
      adapterNote: 'Reduce to Class 10-12 board level. Use simpler numbers and standard formats.',
    },
  },
  NEET: {
    JEE: {
      sharedTopics: ['physics', 'chemistry', 'optics', 'thermodynamics', 'organic chemistry'],
      adapterNote: 'Add engineering applications. Chemistry moves from medical to industrial.',
    },
    CBSE: {
      sharedTopics: ['biology', 'chemistry', 'physics', 'human body systems'],
      adapterNote: 'Simplify to NCERT board level. Remove clinical depth.',
    },
  },
};

// ─── Channel repurpose directions ────────────────────────────────────────────

const CHANNEL_REPURPOSE_INSTRUCTIONS: Record<ContentChannel, Partial<Record<ContentChannel, string>>> = {
  blog: {
    x_twitter: 'Extract the 5-7 most impactful sentences. Turn them into a numbered thread. First tweet is the hook.',
    instagram: 'Rewrite as an Instagram carousel caption. Extract 3 key visual moments for story slides.',
    linkedin: 'Rewrite as a professional insight post. Add a personal anecdote opener. 300 words max.',
    short_video: 'Extract the core insight. Write as a 60-second spoken script with hook, 3 points, CTA.',
    youtube: 'Expand to a full video script. Add intro, chapters, visual directions, and outro.',
    reddit: 'Rewrite as a value-first Reddit post with TL;DR. No promotional language.',
    quora: 'Extract the main question + answer. Add credentials line.',
    email: 'Rewrite as an email with subject line, preview text, body with CTA.',
    vlog: 'Convert to vlog script outline with timestamps and visual cues.',
  },
  youtube: {
    blog: 'Convert the script into a written blog post. Add intro, 3 sections, conclusion, SEO keywords.',
    x_twitter: 'Summarize each chapter as one tweet. Add hook tweet at start and CTA tweet at end.',
    instagram: 'Take the hook moment and 3 key insights for carousel. Write captions for each slide.',
    short_video: 'Extract the most shareable 60-second moment. Rewrite as a punchy short script.',
    reddit: 'Write a value-first Reddit post summarizing the video content.',
    quora: 'Turn the core concept into a Quora Q&A.',
    linkedin: 'Write a professional reflection post based on the video topic.',
    email: 'Summarize the video into an email with subject, body, and link CTA.',
    vlog: 'Adapt as a vlog script with personal commentary style.',
  },
  x_twitter: {
    blog: 'Expand each tweet into a paragraph. Turn the thread into a full blog post with intro and conclusion.',
    instagram: 'Take the best tweet as caption hook. Create 3 story slides from the thread points.',
    linkedin: 'Weave the thread into a professional LinkedIn post narrative.',
    short_video: 'Use the thread structure as a 60-second script. Each tweet = one visual moment.',
    youtube: 'Expand to a full video script using each tweet as a chapter.',
    reddit: 'Expand the thread into a detailed Reddit post.',
    quora: 'Turn the core claim into a Quora question + expert answer.',
    email: 'Expand thread into an email newsletter.',
    vlog: 'Convert thread into a vlog outline.',
  },
  instagram: {
    blog: 'Expand the caption into a full blog post. Use story slides as section headings.',
    x_twitter: 'Convert caption into a Twitter thread. Each story slide = one tweet.',
    linkedin: 'Rewrite caption as professional LinkedIn post.',
    short_video: 'Turn the story sequence into a 60-second short video script.',
    youtube: 'Expand caption topic into a full YouTube video script.',
    reddit: 'Convert caption topic into a Reddit community post.',
    quora: 'Turn the caption topic into a Quora question + answer.',
    email: 'Expand caption into a full email.',
    vlog: 'Convert caption to a vlog script outline.',
  },
  short_video: {
    blog: 'Expand each script point into a full section. Add intro, conclusion, SEO keywords.',
    x_twitter: 'Convert the 3 main script points into a tweet thread.',
    instagram: 'Use the hook as caption opener. Create 3 story slides from the script points.',
    linkedin: 'Rewrite as a professional LinkedIn article stub.',
    youtube: 'Expand to a full 5-10 minute video script.',
    reddit: 'Write a Reddit post based on the core topic.',
    quora: 'Convert core tip into a Quora Q&A.',
    email: 'Rewrite as email with subject and CTA.',
    vlog: 'Convert to a longer vlog script outline.',
  },
  reddit: {
    blog: 'Expand the Reddit post into a formal blog post with SEO title, intro, and sections.',
    x_twitter: 'Convert TL;DR and key points into a Twitter thread.',
    instagram: 'Extract the most visual/relatable insight for an Instagram caption.',
    linkedin: 'Rewrite as a professional LinkedIn post.',
    short_video: 'Extract the most shareable insight for a short video script.',
    youtube: 'Expand to a full YouTube video script.',
    quora: 'Convert to a formal Quora Q&A.',
    email: 'Rewrite as an email newsletter.',
    vlog: 'Convert to a vlog outline.',
  },
  quora: {
    blog: 'Expand the Quora answer into a full blog post.',
    x_twitter: 'Summarize the answer as a Twitter thread. Question as first tweet.',
    instagram: 'Convert the key insight into an Instagram carousel caption.',
    linkedin: 'Rewrite as a LinkedIn insight post.',
    short_video: 'Use the key answer as a short video script.',
    youtube: 'Expand to a full tutorial video.',
    reddit: 'Post the question and answer as a Reddit resource post.',
    email: 'Rewrite as an email newsletter.',
    vlog: 'Convert to a vlog script outline.',
  },
  linkedin: {
    blog: 'Expand the LinkedIn post into a full SEO blog article.',
    x_twitter: 'Summarize the key insights as a Twitter thread.',
    instagram: 'Convert to a more casual Instagram caption with emojis and hashtags.',
    short_video: 'Extract the core insight for a short video script.',
    youtube: 'Expand to a full YouTube video script.',
    reddit: 'Rewrite as a value-first Reddit post.',
    quora: 'Convert the main point to a Quora Q&A.',
    email: 'Rewrite as an email with subject and CTA.',
    vlog: 'Convert to a vlog outline.',
  },
  email: {
    blog: 'Expand the email body into a full blog post.',
    x_twitter: 'Summarize subject + body as a Twitter thread.',
    instagram: 'Extract the core message as an Instagram caption.',
    linkedin: 'Rewrite as a LinkedIn post.',
    short_video: 'Use the email CTA and core insight as a short video script.',
    youtube: 'Expand to a YouTube video script.',
    reddit: 'Rewrite as a Reddit post.',
    quora: 'Convert the email topic to a Quora Q&A.',
    vlog: 'Convert to a vlog outline.',
  },
  vlog: {
    blog: 'Convert the vlog script into a written blog post.',
    x_twitter: 'Extract key moments as a Twitter thread.',
    instagram: 'Use the hook moment as an Instagram caption.',
    linkedin: 'Rewrite as a LinkedIn post.',
    short_video: 'Extract the best 60-second segment.',
    reddit: 'Summarize as a Reddit post.',
    quora: 'Convert the core topic to Quora Q&A.',
    email: 'Rewrite as email newsletter.',
    youtube: 'Use the vlog outline as YouTube video structure.',
  },
};

// ─── Repurpose for channel ────────────────────────────────────────────────────

export async function repurposeForChannel(
  sourceContent: string | GeneratedContent,
  sourceChannel: ContentChannel,
  targetChannel: ContentChannel,
  context: { exam: SupportedExam; topic: string; audience: ContentAudience },
): Promise<GeneratedContent> {
  const sourceText = typeof sourceContent === 'string'
    ? sourceContent
    : JSON.stringify(sourceContent);

  const instruction = CHANNEL_REPURPOSE_INSTRUCTIONS[sourceChannel]?.[targetChannel]
    ?? `Convert this ${sourceChannel} content into ${targetChannel} format.`;

  const prompt = `You are Atlas, EduGenius content agent. Repurpose existing content for a new channel.

ORIGINAL CHANNEL: ${sourceChannel}
TARGET CHANNEL: ${targetChannel}
EXAM: ${context.exam} | TOPIC: ${context.topic} | AUDIENCE: ${context.audience}

REPURPOSING INSTRUCTION: ${instruction}

ORIGINAL CONTENT:
${sourceText}

Generate the repurposed content for ${targetChannel}. Return as JSON matching the standard ${targetChannel} content structure.`;

  try {
    const response = await callLLM({ agent: 'atlas', message: prompt, intent: 'generate_content' });
    const raw = response?.text ?? '';
    try {
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return { channel: targetChannel, ...parsed } as GeneratedContent;
      }
    } catch { /* fall through */ }
    // Fallback: generate fresh for target channel
    return generateContent({ exam: context.exam, topic: context.topic, channel: targetChannel, audience: context.audience });
  } catch {
    return generateContent({ exam: context.exam, topic: context.topic, channel: targetChannel, audience: context.audience });
  }
}

// ─── Repurpose for exam ───────────────────────────────────────────────────────

export async function repurposeForExam(
  sourceContent: string,
  sourceExam: SupportedExam,
  targetExam: SupportedExam,
  context: { topic: string; channel: ContentChannel; audience: ContentAudience },
): Promise<GeneratedContent> {
  const overlap = EXAM_OVERLAP_MAP[sourceExam]?.[targetExam];
  const adapterNote = overlap?.adapterNote
    ?? `Adapt the content from ${sourceExam} context to ${targetExam} context. Adjust difficulty, terminology, and examples.`;

  const prompt = `You are Atlas, EduGenius content agent. Repurpose exam-specific content for a different exam.

SOURCE EXAM: ${sourceExam} → TARGET EXAM: ${targetExam}
TOPIC: ${context.topic} | CHANNEL: ${context.channel} | AUDIENCE: ${context.audience}

ADAPTATION GUIDANCE: ${adapterNote}
${overlap ? `SHARED TOPICS: ${overlap.sharedTopics.join(', ')}` : ''}

ORIGINAL CONTENT:
${sourceContent}

Repurpose this for ${targetExam} students. Keep the channel format (${context.channel}). Return as JSON.`;

  try {
    const response = await callLLM({ agent: 'atlas', message: prompt, intent: 'generate_content' });
    const raw = response?.text ?? '';
    try {
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return { channel: context.channel, ...parsed } as GeneratedContent;
      }
    } catch { /* fall through */ }
    return generateContent({ exam: targetExam, topic: context.topic, channel: context.channel, audience: context.audience });
  } catch {
    return generateContent({ exam: targetExam, topic: context.topic, channel: context.channel, audience: context.audience });
  }
}

// ─── Repurpose for audience ───────────────────────────────────────────────────

export async function repurposeForAudience(
  sourceContent: string,
  sourceAudience: ContentAudience,
  targetAudience: ContentAudience,
  context: { exam: SupportedExam; topic: string; channel: ContentChannel },
): Promise<GeneratedContent> {
  const same = 'Keep same audience level — no adaptation needed.';
  const audienceAdaptations: Record<ContentAudience, Record<ContentAudience, string>> = {
    student_beginner: {
      student_beginner: same,
      student_intermediate: 'Add more depth, assume basic concepts are known. Introduce advanced patterns.',
      student_advanced: 'Maximise depth. Add edge cases, tricky variations, and exam-level difficulty.',
      teacher: 'Add pedagogy notes. Explain common misconceptions to address. Add classroom activities.',
      parent: 'Remove all jargon. Explain in plain English. Focus on what the child is learning and how to support them.',
      aspirant: 'Add professional context. Frame learning as career-relevant skill building.',
    },
    student_intermediate: {
      student_beginner: 'Simplify. Start from scratch. Use analogies. Remove assumed knowledge.',
      student_intermediate: same,
      student_advanced: 'Push the difficulty. Add challenging variations and time-pressure techniques.',
      teacher: 'Add pedagogy notes, discussion questions, and common student struggles.',
      parent: 'Translate to plain English. Focus on progress indicators and how to encourage.',
      aspirant: 'Frame for professional context. Add real-world applications.',
    },
    student_advanced: {
      student_beginner: 'Fundamentally simplify. Build from zero. Use stories and analogies.',
      student_intermediate: 'Remove the hardest parts. Focus on core understanding.',
      student_advanced: same,
      teacher: 'Add lesson plan structure, assessment ideas, and differentiation strategies.',
      parent: 'Summarize key achievements in plain language. Explain what mastering this means for their child.',
      aspirant: 'Add industry context and how this knowledge applies in professional settings.',
    },
    teacher: {
      student_beginner: 'Remove pedagogy notes. Simplify language. Direct student-friendly tone.',
      student_intermediate: 'Remove teacher-only notes. Standard student-facing tone and depth.',
      student_advanced: 'Remove teacher notes. Increase challenge and depth.',
      teacher: same,
      parent: 'Translate classroom content to parent-friendly progress update.',
      aspirant: 'Remove classroom framing. Add professional development context.',
    },
    parent: {
      student_beginner: 'Convert parent summary back to direct student content. Add study tips.',
      student_intermediate: 'Add depth. Convert parent-friendly language back to educational content.',
      student_advanced: 'Add full academic depth and challenge.',
      teacher: 'Add professional pedagogy context and teaching strategies.',
      parent: same,
      aspirant: 'Add professional framing and career relevance.',
    },
    aspirant: {
      student_beginner: 'Simplify professional framing. Focus on fundamentals.',
      student_intermediate: 'Reduce professional context. Focus on exam-relevant concepts.',
      student_advanced: 'Keep full depth. Shift framing from career to exam performance.',
      teacher: 'Add classroom applicability and pedagogy notes.',
      parent: 'Simplify to parent-friendly progress update.',
      aspirant: same,
    },
  };

  const instruction = audienceAdaptations[sourceAudience]?.[targetAudience]
    ?? `Adapt this content from ${sourceAudience} to ${targetAudience}.`;

  const prompt = `You are Atlas, EduGenius content agent. Repurpose content for a different audience.

SOURCE AUDIENCE: ${sourceAudience} → TARGET AUDIENCE: ${targetAudience}
EXAM: ${context.exam} | TOPIC: ${context.topic} | CHANNEL: ${context.channel}

ADAPTATION: ${instruction}

ORIGINAL CONTENT:
${sourceContent}

Repurpose for ${targetAudience}. Keep the channel format (${context.channel}). Return as JSON.`;

  try {
    const response = await callLLM({ agent: 'atlas', message: prompt, intent: 'generate_content' });
    const raw = response?.text ?? '';
    try {
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return { channel: context.channel, ...parsed } as GeneratedContent;
      }
    } catch { /* fall through */ }
    return generateContent({ exam: context.exam, topic: context.topic, channel: context.channel, audience: targetAudience });
  } catch {
    return generateContent({ exam: context.exam, topic: context.topic, channel: context.channel, audience: targetAudience });
  }
}

// ─── Bulk repurpose ───────────────────────────────────────────────────────────

export interface BulkRepurposeRequest {
  sourceAtom?: ContentAtom;
  sourceText?: string;
  sourceChannel: ContentChannel;
  exam: SupportedExam;
  topic: string;
  audience: ContentAudience;
  targetChannels?: ContentChannel[];
  targetExams?: SupportedExam[];
  targetAudiences?: ContentAudience[];
}

export interface BulkRepurposeResult {
  byChannel: Map<ContentChannel, GeneratedContent>;
  byExam: Map<SupportedExam, GeneratedContent>;
  byAudience: Map<ContentAudience, GeneratedContent>;
  generatedAt: string;
}

export async function bulkRepurpose(req: BulkRepurposeRequest): Promise<BulkRepurposeResult> {
  const sourceText = req.sourceText
    ?? (req.sourceAtom ? JSON.stringify(req.sourceAtom) : `Content about ${req.topic} for ${req.exam}`);

  const allChannels: ContentChannel[] = req.targetChannels ?? [
    'blog', 'x_twitter', 'instagram', 'email', 'reddit', 'linkedin', 'quora', 'short_video',
  ];

  const byChannel = new Map<ContentChannel, GeneratedContent>();
  const byExam = new Map<SupportedExam, GeneratedContent>();
  const byAudience = new Map<ContentAudience, GeneratedContent>();

  // Repurpose by channel
  await Promise.all(
    allChannels
      .filter(c => c !== req.sourceChannel)
      .map(async targetChannel => {
        const result = await repurposeForChannel(sourceText, req.sourceChannel, targetChannel, {
          exam: req.exam, topic: req.topic, audience: req.audience,
        });
        byChannel.set(targetChannel, result);
      })
  );

  // Repurpose by exam
  if (req.targetExams && req.targetExams.length > 0) {
    await Promise.all(
      req.targetExams.map(async targetExam => {
        const result = await repurposeForExam(sourceText, req.exam, targetExam, {
          topic: req.topic, channel: req.sourceChannel, audience: req.audience,
        });
        byExam.set(targetExam, result);
      })
    );
  }

  // Repurpose by audience
  if (req.targetAudiences && req.targetAudiences.length > 0) {
    await Promise.all(
      req.targetAudiences.map(async targetAudience => {
        const result = await repurposeForAudience(sourceText, req.audience, targetAudience, {
          exam: req.exam, topic: req.topic, channel: req.sourceChannel,
        });
        byAudience.set(targetAudience, result);
      })
    );
  }

  // Persist result
  const result: BulkRepurposeResult = {
    byChannel,
    byExam,
    byAudience,
    generatedAt: new Date().toISOString(),
  };

  try {
    const stored = {
      byChannel: Object.fromEntries(byChannel),
      byExam: Object.fromEntries(byExam),
      byAudience: Object.fromEntries(byAudience),
      generatedAt: result.generatedAt,
    };
    localStorage.setItem('edugenius_content_bulk_repurpose_last', JSON.stringify(stored));
  } catch { /* ignore */ }

  return result;
}

// ─── Atom-based repurpose ─────────────────────────────────────────────────────

/**
 * Repurpose a ContentAtom (educational content) into a marketing/distribution format.
 */
export async function repurposeAtomForChannel(
  atom: ContentAtom,
  targetChannel: ContentChannel,
  audience: ContentAudience,
): Promise<GeneratedContent> {
  const exam = (atom.examId.toUpperCase() || 'GATE') as SupportedExam;
  const sourceText = `Title: ${atom.title}\n\nContent: ${atom.body}\n\nType: ${atom.type}\nTopic: ${atom.topic}`;

  return repurposeForChannel(sourceText, 'blog', targetChannel, {
    exam,
    topic: atom.topic,
    audience,
  });
}
