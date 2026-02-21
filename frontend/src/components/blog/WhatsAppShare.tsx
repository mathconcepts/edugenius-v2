/**
 * WhatsAppShare — WhatsApp share buttons for blog posts
 *
 * Two variants:
 *   <WhatsAppShareButton /> — inline button (desktop + mobile)
 *   <WhatsAppShareFAB />    — floating action button, sticky bottom (mobile only)
 *
 * Share URL format: https://wa.me/?text=[encoded post title + URL]
 * Tracks via utm_source=whatsapp for Prism analytics.
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// ─── WhatsApp SVG icon ──────────────────────────────────────────────────────────

function WhatsAppIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}

// ─── Shared logic ──────────────────────────────────────────────────────────────

function buildShareUrl(title: string, pageUrl: string): string {
  const text = `${title}\n\n${pageUrl}?utm_source=whatsapp&utm_medium=share&utm_campaign=blog_share`;
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

function getPageUrl(): string {
  return typeof window !== 'undefined' ? window.location.href.split('?')[0] : '';
}

// ─── Inline share button ───────────────────────────────────────────────────────

interface WhatsAppShareButtonProps {
  /** Post title included in the share text */
  postTitle: string;
  /** Optional label override — defaults to "Share this with your batch 📲" */
  label?: string;
  /** Button variant */
  variant?: 'default' | 'compact' | 'outline';
  className?: string;
}

export function WhatsAppShareButton({
  postTitle,
  label = 'Share with your batch 📲',
  variant = 'default',
  className = '',
}: WhatsAppShareButtonProps) {
  const [shared, setShared] = useState(false);

  const handleShare = () => {
    const url = buildShareUrl(postTitle, getPageUrl());
    window.open(url, '_blank', 'noopener,noreferrer');
    setShared(true);
    setTimeout(() => setShared(false), 3000);
  };

  const baseClass = 'inline-flex items-center gap-2 font-medium transition-all rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500/40';

  const variantClass = {
    default: 'bg-[#25D366] hover:bg-[#1db954] text-white px-4 py-2.5 text-sm shadow-lg shadow-green-500/20 hover:shadow-green-500/30',
    compact: 'bg-[#25D366]/10 hover:bg-[#25D366]/20 text-green-400 px-3 py-1.5 text-xs border border-green-500/20',
    outline: 'border border-[#25D366]/50 hover:border-[#25D366] text-[#25D366] hover:bg-[#25D366]/10 px-4 py-2.5 text-sm',
  }[variant];

  return (
    <button
      onClick={handleShare}
      className={`${baseClass} ${variantClass} ${className}`}
      aria-label="Share on WhatsApp"
    >
      <AnimatePresence mode="wait" initial={false}>
        {shared ? (
          <motion.span
            key="shared"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="flex items-center gap-2"
          >
            <span>✓</span>
            <span>Shared!</span>
          </motion.span>
        ) : (
          <motion.span
            key="label"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="flex items-center gap-2"
          >
            <WhatsAppIcon className="w-4 h-4 flex-shrink-0" />
            <span>{label}</span>
          </motion.span>
        )}
      </AnimatePresence>
    </button>
  );
}

// ─── Floating Action Button (mobile sticky) ────────────────────────────────────

interface WhatsAppShareFABProps {
  postTitle: string;
  /** Offset from bottom in px (useful when a bottom nav is present) */
  bottomOffset?: number;
}

export function WhatsAppShareFAB({ postTitle, bottomOffset = 24 }: WhatsAppShareFABProps) {
  const [shared, setShared] = useState(false);
  const [visible, setVisible] = useState(true);

  const handleShare = () => {
    const url = buildShareUrl(postTitle, getPageUrl());
    window.open(url, '_blank', 'noopener,noreferrer');
    setShared(true);
    setTimeout(() => setShared(false), 3000);
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          className="fixed right-4 z-40 flex flex-col items-end gap-2 md:hidden"
          style={{ bottom: bottomOffset }}
        >
          {/* Dismiss */}
          <button
            onClick={() => setVisible(false)}
            className="w-6 h-6 rounded-full bg-surface-700 text-surface-400 flex items-center justify-center text-xs hover:bg-surface-600 transition-colors"
            aria-label="Dismiss share button"
          >
            ×
          </button>

          {/* FAB */}
          <motion.button
            onClick={handleShare}
            whileTap={{ scale: 0.93 }}
            className={`
              flex items-center gap-2 px-4 py-3 rounded-2xl font-medium text-sm shadow-xl transition-all
              ${shared
                ? 'bg-green-600 text-white'
                : 'bg-[#25D366] hover:bg-[#1db954] text-white shadow-green-500/30'
              }
            `}
            aria-label="Share on WhatsApp"
          >
            <AnimatePresence mode="wait" initial={false}>
              {shared ? (
                <motion.span
                  key="shared"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex items-center gap-2"
                >
                  <span>✓</span>
                  <span>Shared!</span>
                </motion.span>
              ) : (
                <motion.span
                  key="share"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex items-center gap-2"
                >
                  <WhatsAppIcon className="w-5 h-5" />
                  <span>Share with batch</span>
                </motion.span>
              )}
            </AnimatePresence>
          </motion.button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
