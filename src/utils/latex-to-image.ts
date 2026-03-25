// @ts-nocheck
/**
 * LaTeX to Image Renderer
 * Renders LaTeX math expressions as PNG images for Telegram.
 * Uses CodeCogs API (free, no local dependencies).
 * Fallback: returns null and caller sends plain text instead.
 */

const CODECOGS_BASE = 'https://latex.codecogs.com/png.latex';

/**
 * Render a LaTeX expression to a PNG buffer via CodeCogs API.
 * Returns null if rendering fails (caller should fall back to text).
 */
export async function renderLatexToPng(latex: string): Promise<Buffer | null> {
  try {
    const encoded = encodeURIComponent(latex);
    const url = `${CODECOGS_BASE}?\\dpi{200}\\bg{white}\\fg{black}${encoded}`;

    const response = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    if (!response.ok) {
      console.warn(`[latex-to-image] CodeCogs returned ${response.status} for: ${latex.slice(0, 80)}`);
      return null;
    }

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch (err) {
    console.warn(`[latex-to-image] Render failed: ${(err as Error).message}`);
    return null;
  }
}

/**
 * Check if text contains LaTeX-like notation that benefits from image rendering.
 * Simple heuristic: contains backslash commands or common math delimiters.
 */
export function hasComplexMath(text: string): boolean {
  return /\\(frac|int|sum|prod|sqrt|begin|matrix|lim|partial)/.test(text)
    || /\$.*\$/.test(text);
}
