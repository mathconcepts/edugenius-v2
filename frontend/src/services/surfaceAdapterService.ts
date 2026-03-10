/**
 * surfaceAdapterService.ts — Surface-Specific Content Formatters
 *
 * Takes a ContentOrchestrationResult and formats it for a specific delivery surface.
 * Does NOT import from contentOrchestratorService (avoid circular dep).
 * Instead, accepts the result as a typed param via a local interface mirror.
 */

import type { DeliverySurface } from './contentTierService';

// ─── Minimal result shape (mirrors ContentOrchestrationResult) ────────────────
// We use a minimal interface to avoid the circular dep with contentOrchestratorService.

export interface AdaptableResult {
  textContent?: string;
  imagePrompt?: string;
  thumbnailBrief?: {
    headline: string;
    subtext?: string;
    visualConcept: string;
    colorScheme: string;
    imagePrompt: string;
  };
  videoScript?: {
    title: string;
    hook: string;
    chapters: { title: string; duration: string; content: string }[];
    callToAction: string;
    totalDuration: string;
    tags: string[];
    description: string;
  };
  infographicSpec?: {
    title: string;
    format: 'vertical' | 'horizontal' | 'square';
    sections: { heading: string; content: string }[];
    imagePrompt: string;
  };
  tier: string;
  strategy: string;
  surface: DeliverySurface;
  // We derive topic/exam from context — using atom if available
  atom?: {
    title?: string;
    examId?: string;
    topic?: string;
  };
}

// ─── Helper: truncate with ellipsis ──────────────────────────────────────────

function truncate(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  return text.slice(0, maxChars - 3) + '...';
}

// ─── Helper: strip markdown for plain-text channels ──────────────────────────

function stripMarkdown(text: string): string {
  return text
    .replace(/#{1,6}\s/g, '')           // headings
    .replace(/\*\*([^*]+)\*\*/g, '$1') // bold
    .replace(/\*([^*]+)\*/g, '$1')     // italic
    .replace(/`([^`]+)`/g, '$1')       // inline code
    .replace(/```[\s\S]*?```/g, '')    // code blocks
    .replace(/!\[.*?\]\(.*?\)/g, '')   // images
    .replace(/\[([^\]]+)\]\(.*?\)/g, '$1') // links
    .replace(/^\s*[-*]\s/gm, '• ')     // bullets
    .replace(/\n{3,}/g, '\n\n')        // excess newlines
    .trim();
}

// ─── WhatsApp ─────────────────────────────────────────────────────────────────

/**
 * Max 1000 chars, emoji-friendly, formula as text, key points bulleted.
 * If imagePrompt exists: appends thumbnail headline reference.
 */
export function formatForWhatsApp(result: AdaptableResult): string {
  const raw = result.textContent ?? '';
  const plain = stripMarkdown(raw);
  const topic = result.atom?.title ?? result.atom?.topic ?? 'Content';
  const exam = (result.atom?.examId ?? '').toUpperCase() || 'Exam';

  let out = `📚 *${topic}* — ${exam} Study Pack\n\n`;
  out += truncate(plain, 700);

  // Key points (extract lines starting with • or numbers)
  const bullets = plain
    .split('\n')
    .filter((l) => /^[•\d]/.test(l.trim()))
    .slice(0, 4);
  if (bullets.length > 0) {
    out += '\n\n🔑 *Key Points:*\n' + bullets.join('\n');
  }

  if (result.thumbnailBrief?.headline) {
    out += `\n\n📸 [Image: ${result.thumbnailBrief.headline}]`;
  } else if (result.imagePrompt) {
    out += `\n\n📸 [Visual aid available]`;
  }

  return truncate(out, 1000);
}

// ─── Telegram ─────────────────────────────────────────────────────────────────

/**
 * Telegram markdown. Can be longer, code blocks for formulas.
 * Sections separated by ─────
 */
export function formatForTelegram(result: AdaptableResult): string {
  const raw = result.textContent ?? '';
  const topic = result.atom?.title ?? result.atom?.topic ?? 'Content';
  const exam = (result.atom?.examId ?? '').toUpperCase() || 'Exam';
  const divider = '\n─────────────────\n';

  let out = `📚 **${topic}** — *${exam}*\n`;
  out += `🏷 Tier: ${result.tier} | Strategy: ${result.strategy}\n`;
  out += divider;
  out += raw;

  if (result.imagePrompt) {
    out += divider;
    out += `🎨 *Image prompt:* \`${truncate(result.imagePrompt, 200)}\``;
  }

  if (result.videoScript) {
    out += divider;
    out += `🎬 *Video: ${result.videoScript.title}*\n`;
    out += `⏱ ${result.videoScript.totalDuration} | Tags: ${result.videoScript.tags.slice(0, 3).join(', ')}`;
  }

  // Telegram has 4096 char limit
  return truncate(out, 4000);
}

// ─── Email ────────────────────────────────────────────────────────────────────

/**
 * HTML email format with subject line suggestion at top.
 */
export function formatForEmail(result: AdaptableResult): string {
  const raw = result.textContent ?? '';
  const topic = result.atom?.title ?? result.atom?.topic ?? 'Topic';
  const exam = (result.atom?.examId ?? '').toUpperCase() || 'Exam';

  // Convert markdown to minimal HTML
  const htmlBody = raw
    .replace(/^#{1}\s(.+)$/gm, '<h1>$1</h1>')
    .replace(/^#{2}\s(.+)$/gm, '<h2>$1</h2>')
    .replace(/^#{3}\s(.+)$/gm, '<h3>$1</h3>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/^\s*[-•]\s(.+)$/gm, '<li>$1</li>')
    .replace(/(<li>[\s\S]+?<\/li>)/g, '<ul>$1</ul>')
    .replace(/\n\n/g, '</p><p>')
    .replace(/^(.+)$/, '<p>$1</p>');

  let out = `<!-- Subject: 📚 ${topic} — ${exam} Study Pack -->\n\n`;
  out += `<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#222;">\n`;
  out += `<h1 style="color:#1a56db;">📚 ${topic}</h1>\n`;
  out += `<p style="color:#666;font-size:14px;">${exam} Study Pack</p>\n`;
  out += `<hr>\n`;
  out += `<div>${htmlBody}</div>\n`;

  if (result.thumbnailBrief) {
    out += `<hr><div style="background:#f0f4ff;padding:16px;border-radius:8px;">`;
    out += `<strong>🎨 Visual: ${result.thumbnailBrief.headline}</strong>`;
    if (result.thumbnailBrief.subtext) out += `<br><em>${result.thumbnailBrief.subtext}</em>`;
    out += `</div>\n`;
  }

  out += `<hr><p style="color:#999;font-size:12px;">Generated by EduGenius AI — Tier: ${result.tier}</p>\n`;
  out += `</body></html>`;

  return out;
}

// ─── Blog / Web ───────────────────────────────────────────────────────────────

/**
 * Full markdown blog post with H1/H2/H3, SEO meta section at bottom.
 * Includes image placeholder.
 */
export function formatForBlog(result: AdaptableResult): string {
  const raw = result.textContent ?? '';
  const topic = result.atom?.title ?? result.atom?.topic ?? 'Topic';
  const exam = (result.atom?.examId ?? '').toUpperCase() || 'Exam';

  let out = `# ${topic} — Complete ${exam} Guide\n\n`;

  if (result.thumbnailBrief) {
    out += `![${result.thumbnailBrief.headline}](${result.imagePrompt ?? 'image-placeholder.jpg'})\n`;
    out += `*${result.thumbnailBrief.subtext ?? result.thumbnailBrief.headline}*\n\n`;
  }

  out += raw;

  if (result.videoScript) {
    out += `\n\n## 🎬 Watch: ${result.videoScript.title}\n\n`;
    out += `> ${result.videoScript.hook}\n\n`;
    out += `**In this video (${result.videoScript.totalDuration}):**\n`;
    result.videoScript.chapters.forEach((ch, i) => {
      out += `${i + 1}. **${ch.title}** *(${ch.duration})*\n`;
    });
    out += `\n${result.videoScript.description}\n`;
  }

  if (result.infographicSpec) {
    out += `\n\n## 📊 ${result.infographicSpec.title}\n\n`;
    result.infographicSpec.sections.forEach((s) => {
      out += `### ${s.heading}\n${s.content}\n\n`;
    });
  }

  // SEO meta block
  out += `\n\n---\n\n`;
  out += `<!-- SEO Meta\n`;
  out += `title: ${topic} — ${exam} Preparation Guide\n`;
  out += `description: Master ${topic} for ${exam} with this comprehensive guide. Includes theory, formulas, solved examples, and exam tips.\n`;
  out += `keywords: ${topic}, ${exam}, exam preparation, study guide, EduGenius\n`;
  out += `-->\n`;

  return out;
}

// ─── YouTube ──────────────────────────────────────────────────────────────────

/**
 * Returns structured YouTube output: script, description, tags, thumbnailBrief.
 */
export function formatForYouTube(result: AdaptableResult): {
  script: string;
  description: string;
  tags: string[];
  thumbnailBrief: string;
} {
  const topic = result.atom?.title ?? result.atom?.topic ?? 'Topic';
  const exam = (result.atom?.examId ?? '').toUpperCase() || 'Exam';

  if (result.videoScript) {
    const vs = result.videoScript;
    let script = `# ${vs.title}\n\n`;
    script += `## 🎬 HOOK (0:00 – 0:30)\n${vs.hook}\n\n`;
    vs.chapters.forEach((ch, i) => {
      script += `## Chapter ${i + 1}: ${ch.title} (${ch.duration})\n${ch.content}\n\n`;
    });
    script += `## CALL TO ACTION\n${vs.callToAction}\n`;

    const thumbnailText = result.thumbnailBrief
      ? `Headline: "${result.thumbnailBrief.headline}"\n` +
        `Color Scheme: ${result.thumbnailBrief.colorScheme}\n` +
        `Visual: ${result.thumbnailBrief.visualConcept}\n` +
        `DALL-E Prompt: ${result.thumbnailBrief.imagePrompt}`
      : `Headline: "${topic} — ${exam} Guide"\nColor Scheme: Dark blue + orange\nDALL-E Prompt: ${result.imagePrompt ?? 'Educational YouTube thumbnail'}`;

    return {
      script,
      description: vs.description,
      tags: vs.tags,
      thumbnailBrief: thumbnailText,
    };
  }

  // No video script — build minimal from text
  const raw = result.textContent ?? '';
  return {
    script: `# ${topic} — ${exam} Guide\n\n${raw}`,
    description: `Master ${topic} for ${exam}. ${raw.slice(0, 150)}`,
    tags: [topic, exam, 'education', 'exam prep', 'EduGenius'],
    thumbnailBrief: `Headline: "${topic}"\nColor Scheme: Blue + orange\nDALL-E Prompt: ${result.imagePrompt ?? 'Educational thumbnail'}`,
  };
}

// ─── PDF ──────────────────────────────────────────────────────────────────────

/**
 * Structured markdown suitable for PDF generation.
 */
export function formatForPDF(result: AdaptableResult): string {
  const raw = result.textContent ?? '';
  const topic = result.atom?.title ?? result.atom?.topic ?? 'Topic';
  const exam = (result.atom?.examId ?? '').toUpperCase() || 'Exam';
  const now = new Date().toLocaleDateString('en-IN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  let out = `---\ntitle: "${topic} — ${exam} Study Pack"\ndate: "${now}"\nauthor: "EduGenius AI"\n---\n\n`;
  out += `# ${topic}\n\n`;
  out += `**Exam:** ${exam} | **Generated:** ${now} | **Tier:** ${result.tier}\n\n`;
  out += `---\n\n`;
  out += raw;

  if (result.infographicSpec) {
    out += `\n\n---\n\n## ${result.infographicSpec.title}\n\n`;
    result.infographicSpec.sections.forEach((s) => {
      out += `### ${s.heading}\n${s.content}\n\n`;
    });
  }

  out += `\n\n---\n\n*Generated by EduGenius AI. For personal study use only.*\n`;
  return out;
}

// ─── Router ───────────────────────────────────────────────────────────────────

/**
 * Routes to the right formatter based on the delivery surface.
 */
export function adaptForSurface(
  result: AdaptableResult,
  surface: DeliverySurface,
): string | Record<string, unknown> {
  switch (surface) {
    case 'whatsapp':
      return formatForWhatsApp(result);
    case 'telegram':
      return formatForTelegram(result);
    case 'email':
      return formatForEmail(result);
    case 'blog_web':
      return formatForBlog(result);
    case 'youtube':
      return formatForYouTube(result) as unknown as Record<string, unknown>;
    case 'pdf':
      return formatForPDF(result);
    case 'in_app':
    case 'chat':
    default:
      return result.textContent ?? '';
  }
}
