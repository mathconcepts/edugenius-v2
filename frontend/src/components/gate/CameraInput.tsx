/**
 * CameraInput — Camera capture + gallery upload for math problem images.
 * Resizes images client-side to max 1024px for efficient base64 transmission.
 */

import { useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Camera, Image, X } from 'lucide-react';

interface CameraInputProps {
  onCapture: (base64: string, mimeType: string) => void;
  onClear: () => void;
  preview?: string | null;
  compact?: boolean;
}

const MAX_SIZE = 1024; // Max dimension in pixels
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

function resizeImage(file: File): Promise<{ base64: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new window.Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let { width, height } = img;

        if (width > MAX_SIZE || height > MAX_SIZE) {
          if (width > height) {
            height = Math.round((height * MAX_SIZE) / width);
            width = MAX_SIZE;
          } else {
            width = Math.round((width * MAX_SIZE) / height);
            height = MAX_SIZE;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0, width, height);

        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
        const base64 = dataUrl.split(',')[1];
        resolve({ base64, mimeType: 'image/jpeg' });
      };
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

export function CameraInput({ onCapture, onClear, preview, compact }: CameraInputProps) {
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleFile = useCallback(async (file: File) => {
    setError(null);
    if (file.size > MAX_FILE_SIZE) {
      setError('Image too large (max 5MB)');
      return;
    }
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file');
      return;
    }
    setLoading(true);
    try {
      const { base64, mimeType } = await resizeImage(file);
      onCapture(base64, mimeType);
    } catch {
      setError('Failed to process image');
    } finally {
      setLoading(false);
    }
  }, [onCapture]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = '';
  }, [handleFile]);

  if (preview) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative inline-block"
      >
        <img
          src={`data:image/jpeg;base64,${preview}`}
          alt="Captured problem"
          className={compact ? 'h-12 w-12 rounded-lg object-cover' : 'max-h-48 rounded-xl object-contain border border-surface-700'}
        />
        <button
          onClick={onClear}
          className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center shadow-lg"
        >
          <X size={12} className="text-white" />
        </button>
      </motion.div>
    );
  }

  return (
    <div>
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" onChange={handleChange} className="hidden" />
      <input ref={galleryRef} type="file" accept="image/*" onChange={handleChange} className="hidden" />

      <div className={compact ? 'flex gap-1' : 'flex gap-3'}>
        <button
          onClick={() => cameraRef.current?.click()}
          disabled={loading}
          className={compact
            ? 'p-2.5 rounded-xl bg-surface-800 hover:bg-surface-700 text-emerald-400 transition-colors'
            : 'flex-1 flex items-center justify-center gap-2 py-4 rounded-xl bg-surface-900 border border-surface-700 hover:border-emerald-500/50 text-surface-300 hover:text-emerald-400 transition-all'
          }
        >
          <Camera size={compact ? 18 : 24} />
          {!compact && <span className="text-sm font-medium">Take Photo</span>}
        </button>
        {!compact && (
          <button
            onClick={() => galleryRef.current?.click()}
            disabled={loading}
            className="flex-1 flex items-center justify-center gap-2 py-4 rounded-xl bg-surface-900 border border-surface-700 hover:border-sky-500/50 text-surface-300 hover:text-sky-400 transition-all"
          >
            <Image size={24} />
            <span className="text-sm font-medium">From Gallery</span>
          </button>
        )}
      </div>

      <AnimatePresence>
        {loading && (
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-xs text-surface-400 mt-2">
            Processing image...
          </motion.p>
        )}
        {error && (
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-xs text-red-400 mt-2">
            {error}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}
