/**
 * Client-side embedder using transformers.js (ONNX/WASM).
 *
 * Uses all-MiniLM-L6-v2 (384-dim). ~22MB model download (cached by browser).
 * First embed: ~500ms cold. Warm: ~50ms per text.
 */

let _pipe: any = null;
let _loading: Promise<any> | null = null;

async function loadPipeline() {
  if (_pipe) return _pipe;
  if (_loading) return _loading;

  _loading = (async () => {
    // Dynamic import — transformers.js is large, don't block app startup
    const { pipeline, env } = await import('@xenova/transformers');
    // Avoid trying to load from local path (browser context)
    (env as any).allowLocalModels = false;
    (env as any).useBrowserCache = true;
    _pipe = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
    return _pipe;
  })();

  return _loading;
}

/** Embed a string → 384-dim Float32Array. Lazy-loads model on first call. */
export async function embed(text: string): Promise<Float32Array> {
  const pipe = await loadPipeline();
  const output = await pipe(text, { pooling: 'mean', normalize: true });
  return output.data as Float32Array;
}

/** Embed multiple texts in batch. */
export async function embedBatch(texts: string[]): Promise<Float32Array[]> {
  const results: Float32Array[] = [];
  for (const text of texts) {
    results.push(await embed(text));
  }
  return results;
}

/** Check if embedder is ready (doesn't trigger load). */
export function isReady(): boolean {
  return _pipe !== null;
}

/** Warmup — call during idle time to preload the model. */
export async function warmup(): Promise<void> {
  await loadPipeline();
}
