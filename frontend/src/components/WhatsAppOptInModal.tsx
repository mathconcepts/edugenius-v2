/**
 * WhatsAppOptInModal
 * Beautiful mobile-first bottom-sheet / modal for capturing WhatsApp opt-in.
 * Design: dark theme, WhatsApp green accent (#25D366), frugal copy.
 */

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Check } from 'lucide-react';
import { clsx } from 'clsx';
import {
  saveWhatsAppOptIn,
  saveWhatsAppSkip,
  validateIndianPhone,
} from '@/services/whatsappOptIn';

// ── WhatsApp SVG icon ────────────────────────────────────────────────────────

function WhatsAppIcon({ size = 24 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M12 2C6.477 2 2 6.477 2 12c0 1.89.525 3.66 1.438 5.168L2.1 21.9l4.863-1.274A9.947 9.947 0 0012 22c5.523 0 10-4.477 10-10S17.523 2 12 2z"
        fill="#25D366"
      />
      <path
        d="M17.006 14.547c-.274-.137-1.62-.8-1.871-.89-.252-.092-.435-.137-.617.137-.183.274-.708.891-.868 1.074-.16.183-.32.206-.594.069-.274-.137-1.157-.426-2.203-1.36-.815-.726-1.364-1.622-1.524-1.896-.16-.274-.017-.422.12-.559.124-.123.274-.32.411-.48.137-.16.183-.274.274-.457.092-.183.046-.343-.023-.48-.069-.137-.617-1.487-.845-2.036-.222-.534-.449-.462-.617-.47L8 7.998c-.16 0-.411.069-.627.32-.217.252-.823.805-.823 1.963 0 1.158.845 2.277.962 2.437.117.16 1.655 2.535 4.014 3.555.56.242 1 .387 1.34.495.563.179 1.076.154 1.48.093.452-.068 1.391-.568 1.588-1.118.196-.549.196-1.018.137-1.117-.058-.1-.24-.16-.514-.297z"
        fill="#fff"
      />
    </svg>
  );
}

// ── Toast ────────────────────────────────────────────────────────────────────

function Toast({ message, visible }: { message: string; visible: boolean }) {
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 40, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.95 }}
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[200] px-6 py-3 bg-[#25D366] text-white rounded-2xl shadow-xl font-semibold text-sm whitespace-nowrap"
        >
          {message}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ── Country codes ────────────────────────────────────────────────────────────

const COUNTRY_CODES = [
  { code: '+91', label: '🇮🇳 +91', country: 'IN' },
  { code: '+1',  label: '🇺🇸 +1',  country: 'US' },
  { code: '+44', label: '🇬🇧 +44', country: 'GB' },
  { code: '+61', label: '🇦🇺 +61', country: 'AU' },
  { code: '+971',label: '🇦🇪 +971',country: 'AE' },
  { code: '+65', label: '🇸🇬 +65', country: 'SG' },
];

// ── Props ────────────────────────────────────────────────────────────────────

export interface WhatsAppOptInModalProps {
  /** Close the modal */
  onClose: () => void;
  /** Exam context — auto-fills the opt-in record */
  exam?: string;
  /** Override the headline for peak moments */
  headline?: string;
  /** Source attribution */
  source?: 'onboarding' | 'post_session' | 'referral_share' | 'exit_intent';
  /** Optional userId */
  userId?: string;
}

// ── Modal ────────────────────────────────────────────────────────────────────

export function WhatsAppOptInModal({
  onClose,
  exam = 'JEE Main',
  headline,
  source = 'onboarding',
  userId,
}: WhatsAppOptInModalProps) {
  const [countryCode, setCountryCode] = useState('+91');
  const [phone, setPhone] = useState('');
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const phoneRef = useRef<HTMLInputElement>(null);

  // Focus phone on mount
  useEffect(() => {
    const t = setTimeout(() => phoneRef.current?.focus(), 200);
    return () => clearTimeout(t);
  }, []);

  // ── Submit ──────────────────────────────────────────────────────────────────

  const handleSubmit = () => {
    setError('');
    const { valid, normalized } = validateIndianPhone(
      countryCode === '+91' ? phone : `${countryCode}${phone}`
    );

    if (!valid) {
      setError('Please enter a valid 10-digit mobile number.');
      return;
    }
    if (!consent) {
      setError('Please accept the consent to continue.');
      return;
    }

    setSubmitting(true);

    // Save to localStorage
    saveWhatsAppOptIn({
      phone: normalized,
      countryCode: COUNTRY_CODES.find(c => c.code === countryCode)?.country ?? 'IN',
      exam,
      consentTimestamp: new Date().toISOString(),
      source,
      userId,
    });

    // Show toast, then close
    setShowToast(true);
    setTimeout(() => {
      setShowToast(false);
      onClose();
    }, 1800);
  };

  // ── Skip ────────────────────────────────────────────────────────────────────

  const handleSkip = () => {
    saveWhatsAppSkip();
    onClose();
  };

  const displayHeadline = headline ?? 'Get nudges on WhatsApp 📲';

  return (
    <>
      {/* Backdrop */}
      <AnimatePresence>
        <motion.div
          key="backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100]"
          onClick={handleSkip}
        />

        {/* Sheet */}
        <motion.div
          key="sheet"
          initial={{ opacity: 0, y: 80 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 80 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          className={clsx(
            'fixed z-[110] w-full max-w-md rounded-t-3xl md:rounded-3xl',
            'bg-surface-800 border border-surface-700',
            'shadow-2xl p-6',
            // Mobile: pinned to bottom; md+: centered
            'bottom-0 left-0 right-0 md:bottom-auto md:top-1/2 md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2'
          )}
          onClick={e => e.stopPropagation()}
        >
          {/* Drag handle (mobile) */}
          <div className="w-10 h-1 bg-surface-600 rounded-full mx-auto mb-5 md:hidden" />

          {/* Close button */}
          <button
            onClick={handleSkip}
            className="absolute top-5 right-5 p-1.5 rounded-lg hover:bg-surface-700 transition-colors text-surface-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>

          {/* WhatsApp icon + headline */}
          <div className="flex items-start gap-4 mb-4">
            <div className="flex-shrink-0 w-12 h-12 bg-[#25D366]/10 border border-[#25D366]/30 rounded-2xl flex items-center justify-center">
              <WhatsAppIcon size={26} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white leading-tight">{displayHeadline}</h2>
              <p className="text-surface-300 text-sm mt-1 leading-relaxed">
                We'll send you exam tips, streak reminders, and your weekly progress — directly on WhatsApp. No spam, ever.
              </p>
            </div>
          </div>

          {/* Benefits */}
          <ul className="space-y-2 mb-5">
            {[
              'Weekly progress digest',
              'Streak reminders before you break it',
              'Exam day countdown + last-minute tips',
            ].map(benefit => (
              <li key={benefit} className="flex items-center gap-2 text-sm text-surface-200">
                <span className="flex-shrink-0 w-5 h-5 bg-[#25D366]/15 rounded-full flex items-center justify-center">
                  <Check className="w-3 h-3 text-[#25D366]" />
                </span>
                {benefit}
              </li>
            ))}
          </ul>

          {/* Phone input */}
          <div className="flex gap-2 mb-3">
            <select
              value={countryCode}
              onChange={e => setCountryCode(e.target.value)}
              className="flex-shrink-0 bg-surface-700 border border-surface-600 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-[#25D366]/60 transition-colors"
            >
              {COUNTRY_CODES.map(c => (
                <option key={c.code} value={c.code}>{c.label}</option>
              ))}
            </select>
            <input
              ref={phoneRef}
              type="tel"
              inputMode="numeric"
              placeholder="10-digit mobile number"
              value={phone}
              onChange={e => {
                setPhone(e.target.value.replace(/[^\d\s\-().]/g, ''));
                setError('');
              }}
              onKeyDown={e => { if (e.key === 'Enter') handleSubmit(); }}
              className={clsx(
                'flex-1 bg-surface-700 border rounded-xl px-4 py-2.5 text-sm text-white placeholder-surface-500',
                'focus:outline-none transition-colors',
                error ? 'border-red-500/60' : 'border-surface-600 focus:border-[#25D366]/60'
              )}
            />
          </div>

          {/* Exam chip */}
          <div className="mb-3">
            <span className="inline-flex items-center gap-1.5 text-xs px-3 py-1 bg-surface-700 border border-surface-600 rounded-full text-surface-300">
              📚 {exam}
            </span>
          </div>

          {/* Consent checkbox */}
          <label className={clsx(
            'flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors mb-4',
            consent ? 'bg-[#25D366]/5 border-[#25D366]/30' : 'border-surface-700 hover:border-surface-600'
          )}>
            <div className="flex-shrink-0 mt-0.5">
              <input
                type="checkbox"
                checked={consent}
                onChange={e => { setConsent(e.target.checked); setError(''); }}
                className="sr-only"
              />
              <div className={clsx(
                'w-4 h-4 rounded border-2 flex items-center justify-center transition-colors',
                consent ? 'bg-[#25D366] border-[#25D366]' : 'border-surface-500'
              )}>
                {consent && <Check className="w-2.5 h-2.5 text-white" />}
              </div>
            </div>
            <p className="text-xs text-surface-400 leading-relaxed">
              I agree to receive WhatsApp messages from EduGenius. I can unsubscribe anytime by replying <span className="font-mono font-semibold text-surface-300">STOP</span>.
            </p>
          </label>

          {/* Error message */}
          {error && (
            <p className="text-xs text-red-400 mb-3 -mt-2">{error}</p>
          )}

          {/* Primary button */}
          <button
            onClick={handleSubmit}
            disabled={submitting}
            style={{ backgroundColor: '#25D366' }}
            className={clsx(
              'w-full py-3.5 rounded-xl text-white font-bold text-sm flex items-center justify-center gap-2 transition-all',
              submitting ? 'opacity-70 cursor-not-allowed' : 'hover:opacity-90 active:scale-[0.98]'
            )}
          >
            <WhatsAppIcon size={18} />
            {submitting ? 'Saving…' : 'Yes, send me tips 💬'}
          </button>

          {/* Skip link */}
          <div className="text-center mt-3">
            <button
              onClick={handleSkip}
              className="text-xs text-surface-500 hover:text-surface-300 transition-colors"
            >
              Maybe later
            </button>
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Toast */}
      <Toast message="You're in! 🎉 Expect your first nudge soon." visible={showToast} />
    </>
  );
}

export default WhatsAppOptInModal;
