/**
 * MathMarkdown — Markdown renderer with KaTeX math support
 *
 * Handles both inline ($...$) and block ($$...$$) LaTeX equations.
 * Used throughout the chat UI for AI tutor responses.
 */
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';

const PROSE_CLASSES = `
  prose prose-invert prose-sm max-w-none
  prose-headings:text-white prose-headings:font-semibold
  prose-p:text-surface-300 prose-p:leading-relaxed
  prose-strong:text-white
  prose-code:text-accent-300 prose-code:bg-surface-900 prose-code:px-1 prose-code:rounded
  prose-pre:bg-surface-900 prose-pre:border prose-pre:border-surface-700
  prose-blockquote:border-primary-500 prose-blockquote:text-surface-400
  prose-li:text-surface-300 prose-li:marker:text-primary-400
  [&_.katex]:text-primary-200 [&_.katex-display]:my-4 [&_.katex-display]:overflow-x-auto
`.trim();

interface Props {
  children: string;
  className?: string;
}

export function MathMarkdown({ children, className }: Props) {
  return (
    <ReactMarkdown
      className={`${PROSE_CLASSES} ${className ?? ''}`}
      remarkPlugins={[remarkMath]}
      rehypePlugins={[rehypeKatex]}
    >
      {children}
    </ReactMarkdown>
  );
}

export { PROSE_CLASSES };
