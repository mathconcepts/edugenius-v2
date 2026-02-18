/**
 * OutputBlockRenderer — renders multimodal AI response blocks
 * Uses KaTeX for proper equation rendering ($...$ inline, $$...$$ block)
 */
import { MathMarkdown } from './MathMarkdown';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import type { OutputBlock } from '@/types';

interface Props {
  blocks: OutputBlock[];
  fallback: string;
}

function EquationBlock({ content }: { content: string }) {
  let rendered = content;
  let renderError = false;
  try {
    rendered = katex.renderToString(content, { displayMode: true, throwOnError: false });
  } catch {
    renderError = true;
  }

  if (renderError) {
    return (
      <div className="my-3 px-4 py-3 bg-surface-900 border border-primary-500/20 rounded-lg font-mono text-center">
        <span className="text-primary-300 text-lg">{content}</span>
      </div>
    );
  }

  return (
    <div
      className="my-4 px-4 py-4 bg-surface-900 border border-primary-500/20 rounded-xl overflow-x-auto text-center"
      dangerouslySetInnerHTML={{ __html: rendered }}
    />
  );
}

function StepsBlock({ block }: { block: OutputBlock }) {
  const allItems = block.items || [];
  return (
    <div className="my-3 space-y-2">
      {block.label && <p className="text-sm font-semibold text-white mb-2">{block.label}</p>}
      <p className="text-sm font-semibold text-primary-400">{block.content}</p>
      {allItems.map((item, i) => (
        <div key={i} className="flex gap-3 text-sm text-surface-300">
          <span className="text-primary-400 font-mono w-5 flex-shrink-0">{i + 1}.</span>
          <span>{item}</span>
        </div>
      ))}
    </div>
  );
}

function TableBlock({ block }: { block: OutputBlock }) {
  if (!block.headers || !block.rows) {
    return <p className="text-sm text-surface-400 italic">[Table data unavailable]</p>;
  }
  return (
    <div className="my-3 overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="bg-surface-800">
            {block.headers.map((h, i) => (
              <th key={i} className="px-3 py-2 text-left text-surface-300 border border-surface-700 font-medium">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {block.rows.map((row, ri) => (
            <tr key={ri} className="border-b border-surface-700/50 hover:bg-surface-800/30">
              {row.map((cell, ci) => (
                <td key={ci} className="px-3 py-2 text-surface-400 border-r border-surface-700/50 last:border-r-0">{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CardBlock({ block }: { block: OutputBlock }) {
  return (
    <div className="my-3 p-4 bg-gradient-to-br from-primary-900/30 to-surface-800 border border-primary-500/20 rounded-xl">
      {block.label && <p className="text-xs text-primary-400 font-semibold uppercase tracking-wide mb-2">{block.label}</p>}
      <p className="text-white">{block.content}</p>
      {block.items && block.items.length > 0 && (
        <ul className="mt-2 space-y-1">
          {block.items.map((item, i) => (
            <li key={i} className="flex gap-2 text-sm text-surface-300">
              <span className="text-primary-400">•</span>{item}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function OutputBlockRenderer({ blocks, fallback }: Props) {
  if (!blocks || blocks.length === 0) {
    return <MathMarkdown>{fallback}</MathMarkdown>;
  }

  return (
    <div className="space-y-1">
      {blocks.map((block, i) => {
        switch (block.type) {
          case 'equation':
            return <EquationBlock key={i} content={block.content} />;
          case 'steps':
            return <StepsBlock key={i} block={block} />;
          case 'table':
            return <TableBlock key={i} block={block} />;
          case 'card':
            return <CardBlock key={i} block={block} />;
          case 'image_description':
            return (
              <div key={i} className="my-2 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg text-sm text-blue-300">
                📸 <span className="italic">{block.content}</span>
              </div>
            );
          case 'audio_url':
            return (
              <div key={i} className="my-2">
                <audio controls src={block.content} className="w-full h-10 rounded-lg" />
              </div>
            );
          default:
            return <MathMarkdown key={i}>{block.content}</MathMarkdown>;
        }
      })}
    </div>
  );
}
