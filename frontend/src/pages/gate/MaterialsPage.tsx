/**
 * MaterialsPage — student-uploaded study materials.
 *
 * Upload PDFs, DOCX, markdown, or handwritten images. Parsed client-side
 * (except vision OCR), embedded via transformers.js, stored in IndexedDB.
 * Retrieved as grounding context during chat.
 *
 * This is the headline DB-less feature: privacy-first personalization.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { trackEvent } from '@/lib/analytics';
import { fadeInUp, staggerContainer } from '@/lib/animations';
import {
  Upload, FileText, Image as ImageIcon, FileCode, Trash2, Loader2,
  CheckCircle2, AlertCircle, Shield, Sparkles, BookOpen,
} from 'lucide-react';
import { clsx } from 'clsx';
import {
  ingestMaterial,
} from '@/lib/gbrain/materials';
import {
  getAllMaterials, deleteMaterial, getChunksForMaterial,
  type GBrainDB,
} from '@/lib/gbrain/db';
import { warmup as warmupEmbedder } from '@/lib/gbrain/embedder';

type Material = GBrainDB['materials']['value'];

const ACCEPTED = '.pdf,.docx,.md,.txt,image/*';

const TYPE_ICONS: Record<Material['type'], typeof FileText> = {
  pdf: FileText,
  docx: FileText,
  md: FileCode,
  txt: FileCode,
  'image-notes': ImageIcon,
  'image-work': ImageIcon,
};

const TYPE_COLORS: Record<Material['type'], string> = {
  pdf: 'text-red-400 bg-red-500/10',
  docx: 'text-sky-400 bg-sky-500/10',
  md: 'text-purple-400 bg-purple-500/10',
  txt: 'text-surface-400 bg-surface-800',
  'image-notes': 'text-emerald-400 bg-emerald-500/10',
  'image-work': 'text-amber-400 bg-amber-500/10',
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function MaterialsPage() {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState<{ filename: string; stage: string; pct: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [chunkCounts, setChunkCounts] = useState<Record<string, number>>({});
  const inputRef = useRef<HTMLInputElement>(null);

  const loadMaterials = useCallback(async () => {
    setLoading(true);
    try {
      const all = await getAllMaterials();
      all.sort((a, b) => (b.uploaded_at > a.uploaded_at ? 1 : -1));
      setMaterials(all);
      // Load chunk counts for each
      const counts: Record<string, number> = {};
      for (const m of all) {
        const chunks = await getChunksForMaterial(m.id);
        counts[m.id] = chunks.length;
      }
      setChunkCounts(counts);
    } catch (err) {
      setError(`Failed to load materials: ${(err as Error).message}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    trackEvent('page_view', { page: 'materials' });
    loadMaterials();
    // Warm up the embedder in the background
    warmupEmbedder().catch(() => {});
  }, [loadMaterials]);

  const handleFile = async (file: File) => {
    setError(null);
    setUploading({ filename: file.name, stage: 'starting', pct: 0 });
    try {
      await ingestMaterial(file, (stage, pct) => {
        setUploading({ filename: file.name, stage, pct });
      });
      trackEvent('material_uploaded', { type: file.type, size: file.size });
      setUploading(null);
      await loadMaterials();
    } catch (err) {
      setError(`Upload failed: ${(err as Error).message}`);
      setUploading(null);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this material and its embeddings? This cannot be undone.')) return;
    await deleteMaterial(id);
    await loadMaterials();
    trackEvent('material_deleted', { id });
  };

  return (
    <motion.div className="space-y-5" initial="hidden" animate="visible" variants={staggerContainer}>
      {/* Header */}
      <motion.div variants={fadeInUp}>
        <h1 className="text-xl font-bold text-surface-100 flex items-center gap-2">
          <BookOpen size={20} className="text-emerald-400" />
          Your Materials
        </h1>
        <p className="text-xs text-surface-500 mt-1">
          Upload notes, textbooks, handwritten work. GBrain learns from them.
        </p>
      </motion.div>

      {/* Privacy banner */}
      <motion.div variants={fadeInUp} className="p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/15 flex items-start gap-2">
        <Shield size={14} className="text-emerald-400 shrink-0 mt-0.5" />
        <div className="text-xs text-surface-400 leading-relaxed">
          <span className="text-emerald-400 font-semibold">Privacy-first.</span>{' '}
          Files are parsed and embedded entirely in your browser. Only handwritten
          images briefly touch the server for OCR. Your materials never leave your device.
        </div>
      </motion.div>

      {/* Upload drop zone */}
      <motion.div
        variants={fadeInUp}
        onDragOver={e => { e.preventDefault(); setDragActive(true); }}
        onDragLeave={() => setDragActive(false)}
        onDrop={handleDrop}
        className={clsx(
          'relative p-6 rounded-xl border-2 border-dashed text-center transition-colors',
          dragActive ? 'border-emerald-500 bg-emerald-500/5' : 'border-surface-700 bg-surface-900',
          uploading && 'pointer-events-none opacity-60',
        )}
      >
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED}
          onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])}
          className="hidden"
        />

        {uploading ? (
          <div className="space-y-2">
            <Loader2 className="animate-spin text-emerald-400 mx-auto" size={24} />
            <p className="text-sm font-medium text-surface-200 truncate">{uploading.filename}</p>
            <p className="text-[10px] text-surface-500 uppercase tracking-wide">{uploading.stage}</p>
            <div className="max-w-xs mx-auto h-1.5 rounded-full bg-surface-800 overflow-hidden">
              <motion.div
                className="h-full bg-emerald-500 rounded-full"
                animate={{ width: `${Math.round(uploading.pct * 100)}%` }}
                transition={{ duration: 0.3 }}
              />
            </div>
          </div>
        ) : (
          <>
            <Upload size={28} className="text-surface-500 mx-auto mb-2" />
            <p className="text-sm font-medium text-surface-200 mb-1">
              Drop a file here or{' '}
              <button onClick={() => inputRef.current?.click()} className="text-emerald-400 underline">browse</button>
            </p>
            <p className="text-[10px] text-surface-500">
              PDF, DOCX, Markdown, TXT, or images (up to ~50 MB)
            </p>
          </>
        )}
      </motion.div>

      {error && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 flex items-start gap-2">
          <AlertCircle size={14} className="text-red-400 shrink-0 mt-0.5" />
          <p className="text-xs text-red-300">{error}</p>
        </motion.div>
      )}

      {/* Grounding indicator */}
      {materials.length > 0 && (
        <motion.div variants={fadeInUp} className="p-3 rounded-xl bg-sky-500/5 border border-sky-500/15 flex items-center gap-2">
          <Sparkles size={14} className="text-sky-400 shrink-0" />
          <p className="text-xs text-surface-300">
            <span className="font-semibold text-sky-300">{materials.length}</span> material{materials.length === 1 ? '' : 's'} ·{' '}
            <span className="font-semibold text-sky-300">
              {Object.values(chunkCounts).reduce((a, b) => a + b, 0)}
            </span>{' '}
            chunks ready for chat grounding
          </p>
        </motion.div>
      )}

      {/* Materials list */}
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-16 rounded-xl bg-surface-800/60 animate-pulse" />)}
        </div>
      ) : materials.length === 0 ? (
        <motion.div variants={fadeInUp} className="text-center py-8 space-y-2">
          <BookOpen size={32} className="text-surface-700 mx-auto" />
          <p className="text-sm text-surface-500">No materials yet. Upload your first file above.</p>
        </motion.div>
      ) : (
        <motion.div variants={fadeInUp} className="space-y-2">
          <AnimatePresence>
            {materials.map(m => {
              const Icon = TYPE_ICONS[m.type];
              const colorCls = TYPE_COLORS[m.type];
              return (
                <motion.div
                  key={m.id}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  className="flex items-center gap-3 p-3 rounded-xl bg-surface-900 border border-surface-800"
                >
                  <div className={clsx('p-2 rounded-lg shrink-0', colorCls)}>
                    <Icon size={14} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-surface-200 truncate">{m.filename}</p>
                    <p className="text-[10px] text-surface-500">
                      {formatBytes(m.size_bytes)}
                      {m.page_count ? ` · ${m.page_count} pages` : ''}
                      {chunkCounts[m.id] !== undefined ? ` · ${chunkCounts[m.id]} chunks` : ''}
                      {' · '}
                      {formatDate(m.uploaded_at)}
                    </p>
                  </div>
                  <CheckCircle2 size={14} className="text-emerald-400 shrink-0" />
                  <button
                    onClick={() => handleDelete(m.id)}
                    className="p-1.5 rounded-lg hover:bg-red-500/10 text-surface-500 hover:text-red-400 transition-colors cursor-pointer"
                    aria-label="Delete material"
                  >
                    <Trash2 size={13} />
                  </button>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </motion.div>
      )}

      {/* Tip */}
      {materials.length > 0 && (
        <motion.div variants={fadeInUp} className="p-3 rounded-xl bg-surface-900 border border-surface-800">
          <p className="text-[10px] text-surface-500 uppercase tracking-wide mb-1">Tip</p>
          <p className="text-xs text-surface-400 leading-relaxed">
            Ask the tutor about your materials — e.g. "Explain the chain rule example from my notes"
            or "Generate practice problems like the ones in chapter 3". GBrain will automatically
            pull the most relevant chunks.
          </p>
        </motion.div>
      )}
    </motion.div>
  );
}
