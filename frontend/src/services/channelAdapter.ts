/**
 * channelAdapter.ts — EduGenius Multi-Channel Content Adapter
 *
 * Every channel has different constraints. This adapter transforms
 * Sage's rich response into the right format per channel.
 *
 * Channel capabilities matrix:
 * ┌─────────────────┬───────┬──────────┬──────────┬──────────┬─────────┐
 * │ Feature         │ Web   │ Mobile   │ WhatsApp │ Telegram │ Widget  │
 * ├─────────────────┼───────┼──────────┼──────────┼──────────┼─────────┤
 * │ Markdown        │  ✅   │  ✅      │  ⚠️ *   │  ✅      │  ✅     │
 * │ LaTeX / KaTeX   │  ✅   │  ✅      │  ❌      │  ❌      │  ✅     │
 * │ Images/Manim    │  ✅   │  ✅      │  ✅ (img)│  ✅ (img)│  ✅     │
 * │ Code blocks     │  ✅   │  ✅      │  ❌      │  ✅      │  ✅     │
 * │ Tables          │  ✅   │  ⚠️     │  ❌      │  ❌      │  ✅     │
 * │ Buttons/CTAs    │  ✅   │  ✅      │  ✅ (btn)│  ✅ (btn)│  ✅     │
 * │ Quick replies   │  ✅   │  ✅      │  ✅ (btn)│  ✅ (kbd)│  ✅     │
 * │ Voice input     │  ✅   │  ✅      │  ✅      │  ✅      │  ❌     │
 * │ File uploads    │  ✅   │  ✅      │  ✅      │  ✅      │  ❌     │
 * │ Character limit │  none │  none    │  4096    │  4096    │  1000   │
 * └─────────────────┴───────┴──────────┴──────────┴──────────┴─────────┘
 * * WhatsApp supports *bold*, _italic_ but not full CommonMark
 */

export type Channel = 'web' | 'mobile' | 'whatsapp' | 'telegram' | 'widget';

export interface ChannelCapabilities {
  supportsMarkdown: boolean;
  supportsLatex: boolean;
  supportsImages: boolean;
  supportsCode: boolean;
  supportsTables: boolean;
  supportsButtons: boolean;
  supportsQuickReplies: boolean;
  supportsVoice: boolean;
  supportsFiles: boolean;
  charLimit: number | null;
  prefersBullets: boolean;       // channel benefits from bullet lists
  prefersShortParagraphs: boolean; // break at ~100 chars
}

export const CHANNEL_CAPS: Record<Channel, ChannelCapabilities> = {
  web: {
    supportsMarkdown: true,
    supportsLatex: true,
    supportsImages: true,
    supportsCode: true,
    supportsTables: true,
    supportsButtons: true,
    supportsQuickReplies: true,
    supportsVoice: true,
    supportsFiles: true,
    charLimit: null,
    prefersBullets: false,
    prefersShortParagraphs: false,
  },
  mobile: {
    supportsMarkdown: true,
    supportsLatex: true,
    supportsImages: true,
    supportsCode: true,
    supportsTables: false, // too wide on mobile
    supportsButtons: true,
    supportsQuickReplies: true,
    supportsVoice: true,
    supportsFiles: true,
    charLimit: null,
    prefersBullets: true,
    prefersShortParagraphs: true,
  },
  whatsapp: {
    supportsMarkdown: false, // only *bold* and _italic_
    supportsLatex: false,
    supportsImages: true,
    supportsCode: false,
    supportsTables: false,
    supportsButtons: true, // WhatsApp buttons (max 3 per message)
    supportsQuickReplies: true,
    supportsVoice: true,
    supportsFiles: true,
    charLimit: 4096,
    prefersBullets: true,
    prefersShortParagraphs: true,
  },
  telegram: {
    supportsMarkdown: true, // Telegram MarkdownV2
    supportsLatex: false,
    supportsImages: true,
    supportsCode: true,
    supportsTables: false,
    supportsButtons: true, // inline keyboards
    supportsQuickReplies: true,
    supportsVoice: true,
    supportsFiles: true,
    charLimit: 4096,
    prefersBullets: true,
    prefersShortParagraphs: true,
  },
  widget: {
    supportsMarkdown: true,
    supportsLatex: true,
    supportsImages: true,
    supportsCode: true,
    supportsTables: true,
    supportsButtons: true,
    supportsQuickReplies: true,
    supportsVoice: false,
    supportsFiles: false,
    charLimit: null,
    prefersBullets: false,
    prefersShortParagraphs: false,
  },
};

// ─── Quick reply button type ──────────────────────────────────────────────────

export interface QuickReply {
  id: string;
  text: string;
  value?: string; // if different from display text
  icon?: string;
}

export interface AdaptedResponse {
  text: string;
  channel: Channel;
  quickReplies?: QuickReply[];
  imageUrl?: string;      // for Manim renders sent as images
  buttons?: Array<{ text: string; action: string }>;
  splitMessages?: string[]; // for WhatsApp/Telegram when response must be chunked
}

// ─── Main adapter ─────────────────────────────────────────────────────────────

export function adaptForChannel(
  rawText: string,
  channel: Channel,
  options: {
    topicId?: string;
    examId?: string;
    manimImageUrl?: string;
    suggestQuickReplies?: boolean;
  } = {}
): AdaptedResponse {
  const caps = CHANNEL_CAPS[channel];
  let text = rawText;

  // 1. LaTeX → plain text for channels that don't render it
  if (!caps.supportsLatex) {
    text = stripLatex(text);
  }

  // 2. Tables → bullet lists for channels without table support
  if (!caps.supportsTables) {
    text = tableToBullets(text);
  }

  // 3. Code blocks → plain text for WhatsApp
  if (!caps.supportsCode) {
    text = stripCodeBlocks(text);
  }

  // 4. Full markdown → channel-appropriate formatting
  if (!caps.supportsMarkdown) {
    text = markdownToWhatsApp(text);
  } else if (channel === 'telegram') {
    text = markdownToTelegram(text);
  }

  // 5. Short paragraphs for mobile/WhatsApp/Telegram
  if (caps.prefersShortParagraphs) {
    text = breakLongParagraphs(text, 120);
  }

  // 6. Truncate to char limit
  if (caps.charLimit && text.length > caps.charLimit) {
    text = text.slice(0, caps.charLimit - 100) + '\n\n_[Message truncated — ask me to continue]_';
  }

  // 7. Build quick replies
  const quickReplies = caps.supportsQuickReplies && options.suggestQuickReplies !== false
    ? buildQuickReplies(options.topicId, options.examId, channel)
    : undefined;

  // 8. Chunk if over single-message limit
  const splitMessages = needsChunking(text, channel)
    ? chunkMessage(text, channel)
    : undefined;

  return {
    text: splitMessages ? splitMessages[0] : text,
    channel,
    quickReplies,
    imageUrl: options.manimImageUrl,
    splitMessages,
  };
}

// ─── Format transformers ──────────────────────────────────────────────────────

/** Remove LaTeX delimiters, keep the expression as plain text */
function stripLatex(text: string): string {
  // Display math: $$...$$ or \[...\]
  text = text.replace(/\$\$([^$]+)\$\$/gs, (_, expr) => `[${expr.trim()}]`);
  text = text.replace(/\\\[([^\]]+)\\\]/gs, (_, expr) => `[${expr.trim()}]`);
  // Inline math: $...$ or \(...\)
  text = text.replace(/\$([^$]+)\$/g, (_, expr) => expr.trim());
  text = text.replace(/\\\(([^)]+)\\\)/g, (_, expr) => expr.trim());
  return text;
}

/** Convert markdown tables to bullet lists */
function tableToBullets(text: string): string {
  const tableRegex = /\|(.+)\|[\r\n]+\|[-| :]+\|[\r\n]+((?:\|.+\|[\r\n]*)+)/g;
  return text.replace(tableRegex, (_, headerRow, bodyRows) => {
    const headers = headerRow.split('|').map((h: string) => h.trim()).filter(Boolean);
    const rows = bodyRows.trim().split('\n').map((row: string) =>
      row.split('|').map((c: string) => c.trim()).filter(Boolean)
    );
    const bullets = rows.map((cells: string[]) =>
      '• ' + cells.map((c, i) => `${headers[i] ? headers[i] + ': ' : ''}${c}`).join(' | ')
    );
    return bullets.join('\n');
  });
}

/** Strip code blocks for WhatsApp */
function stripCodeBlocks(text: string): string {
  return text.replace(/```[\w]*\n?([\s\S]*?)```/g, (_, code) =>
    code.trim().split('\n').map((l: string) => '  ' + l).join('\n')
  );
}

/** Convert CommonMark to WhatsApp-style: *bold*, _italic_, no headers */
function markdownToWhatsApp(text: string): string {
  // Headers → bold + newline
  text = text.replace(/^#{1,3}\s+(.+)$/gm, '*$1*');
  // Bold: **text** → *text*
  text = text.replace(/\*\*(.+?)\*\*/g, '*$1*');
  // Italic: _text_ stays, *text* → _text_
  text = text.replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, '_$1_');
  // Remove horizontal rules
  text = text.replace(/^[-*_]{3,}$/gm, '---');
  // Numbered/unordered lists: already mostly fine
  return text.trim();
}

/** Convert CommonMark to Telegram MarkdownV2 */
function markdownToTelegram(text: string): string {
  // Escape special chars that Telegram requires escaping outside formatting
  const escape = (s: string) => s.replace(/([_*[\]()~`>#+\-=|{}.!])/g, '\\$1');
  // Bold: **text** → *text*
  text = text.replace(/\*\*(.+?)\*\*/g, '*$1*');
  // Inline code stays as `code`
  // Headers → bold
  text = text.replace(/^#{1,3}\s+(.+)$/gm, '*$1*');
  return text;
}

/** Break paragraphs longer than maxChars at sentence boundaries */
function breakLongParagraphs(text: string, maxChars = 120): string {
  return text.split('\n\n').map(para => {
    if (para.length <= maxChars) return para;
    // Break at sentence endings
    return para.replace(/([.!?])\s+/g, '$1\n').trim();
  }).join('\n\n');
}

function needsChunking(text: string, channel: Channel): boolean {
  const limit = CHANNEL_CAPS[channel].charLimit;
  return !!limit && text.length > limit;
}

function chunkMessage(text: string, channel: Channel): string[] {
  const limit = CHANNEL_CAPS[channel].charLimit ?? 4000;
  const chunks: string[] = [];
  const paragraphs = text.split('\n\n');
  let current = '';

  for (const para of paragraphs) {
    if ((current + '\n\n' + para).length > limit - 50) {
      if (current) chunks.push(current.trim());
      current = para;
    } else {
      current = current ? current + '\n\n' + para : para;
    }
  }
  if (current) chunks.push(current.trim());
  return chunks;
}

// ─── Quick replies builder ────────────────────────────────────────────────────

const TOPIC_QUICK_REPLIES: Record<string, QuickReply[]> = {
  'linear-algebra': [
    { id: 'qr1', text: '🧮 Show me an example', icon: '🧮' },
    { id: 'qr2', text: '📋 Practice MCQs', icon: '📋' },
    { id: 'qr3', text: '🔢 Formula sheet', icon: '🔢' },
  ],
  'calculus': [
    { id: 'qr1', text: '📈 Draw the curve', icon: '📈' },
    { id: 'qr2', text: '🎯 PYQ questions', icon: '🎯' },
    { id: 'qr3', text: '💡 Give me a trick', icon: '💡' },
  ],
  'general': [
    { id: 'qr1', text: '📝 Practice now', icon: '📝' },
    { id: 'qr2', text: '🔢 Show formula', icon: '🔢' },
    { id: 'qr3', text: '📋 Previous year Q', icon: '📋' },
    { id: 'qr4', text: "🤔 I didn't get it", icon: '🤔' },
  ],
};

function buildQuickReplies(
  topicId?: string,
  _examId?: string,
  channel: Channel = 'web'
): QuickReply[] {
  const base = TOPIC_QUICK_REPLIES[topicId ?? ''] ?? TOPIC_QUICK_REPLIES['general'];
  // WhatsApp supports max 3 buttons
  if (channel === 'whatsapp') return base.slice(0, 3);
  // Telegram inline keyboard: 4 is fine
  return base.slice(0, 4);
}

// ─── Channel system prompt modifier ──────────────────────────────────────────

/**
 * Injects channel-awareness into Sage's system prompt.
 * Sage adapts its writing style based on where the student is chatting from.
 */
export function getChannelSystemHint(channel: Channel): string {
  const hints: Record<Channel, string> = {
    web: '',
    mobile: `MOBILE CHANNEL: Student is on a phone.
- Use bullet points over long paragraphs
- Keep each thought under 2 sentences
- Prefer vertical layouts (not side-by-side comparisons)
- Bold the KEY formula or answer upfront, explanation after`,

    whatsapp: `WHATSAPP CHANNEL: This response goes to WhatsApp.
- NO markdown tables. NO LaTeX. NO code blocks.
- Use *bold* for key terms, _italic_ for emphasis
- Max 3 sentences per paragraph — use line breaks liberally
- Write equations in plain text: "x^2 + 2x + 1 = (x+1)^2"
- End with ONE clear question or action (not multiple CTAs)
- Keep total response under 800 characters when possible`,

    telegram: `TELEGRAM CHANNEL: This response goes to Telegram.
- Markdown is supported (bold, italic, code blocks, inline code)
- No LaTeX — write equations as: \`x² + 2x + 1 = (x+1)²\`
- Code blocks work: use them for step-by-step solutions
- Keep paragraphs short — 2-3 sentences max
- Use inline keyboard buttons for follow-up actions`,

    widget: `WIDGET CHANNEL: Student using the embedded chat widget.
- Concise responses — widget viewport is limited
- Avoid very long explanations without check-in questions
- Quick replies will appear below your message
- Keep responses under 300 words`,
  };
  return hints[channel];
}
