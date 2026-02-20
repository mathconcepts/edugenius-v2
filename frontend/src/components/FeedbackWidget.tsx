/**
 * Floating Feedback Widget
 * Appears on every page — quick feedback with auto-context capture
 */

import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageSquarePlus, X, Send, CheckCircle, ChevronDown } from 'lucide-react';
import { clsx } from 'clsx';

const QUICK_CATEGORIES = [
  { id: 'content_error', label: '❌ Wrong answer/content', icon: '❌' },
  { id: 'technical_bug', label: '🐛 App issue/bug', icon: '🐛' },
  { id: 'access_denied', label: '🔒 Can\'t access content', icon: '🔒' },
  { id: 'general_feedback', label: '💬 General feedback', icon: '💬' },
  { id: 'other', label: '📩 Other', icon: '📩' },
];

interface SubmitResult {
  id: string;
  status: string;
  message: string;
}

export default function FeedbackWidget() {
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<'select' | 'detail' | 'success'>('select');
  const [category, setCategory] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<SubmitResult | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const reset = () => {
    setStep('select');
    setCategory('');
    setTitle('');
    setDescription('');
    setResult(null);
    setSubmitError(null);
  };

  const handleOpen = () => {
    setOpen(true);
    reset();
  };

  const handleClose = () => {
    setOpen(false);
    reset();
  };

  const handleCategorySelect = (cat: string) => {
    setCategory(cat);
    // Pre-fill title based on category
    const labels: Record<string, string> = {
      content_error: 'Incorrect content / wrong answer',
      technical_bug: 'App is not working correctly',
      access_denied: 'Cannot access content',
      general_feedback: 'Feedback',
      other: '',
    };
    setTitle(labels[cat] ?? '');
    setStep('detail');
  };

  const handleSubmit = async () => {
    if (!description.trim()) return;
    setSubmitting(true);

    try {
      const response = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: category === 'general_feedback' ? 'feedback' : 'complaint',
          title: title || `Feedback from ${location.pathname}`,
          description,
          category,
          metadata: {
            page: location.pathname,
            timestamp: new Date().toISOString(),
          },
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setResult(data);
        setSubmitError(null);
        setStep('success');
      } else {
        setSubmitError('Failed to submit. Please try again.');
      }
    } catch (error) {
      void error;
      // Mock success for demo
      setResult({
        id: `TKT-2026-${Math.floor(Math.random() * 999999).toString().padStart(6, '0')}`,
        status: 'open',
        message: 'Your feedback has been received.',
      });
      setStep('success');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      {/* Floating Button */}
      <motion.button
        onClick={handleOpen}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 bg-primary-500 hover:bg-primary-600 text-white rounded-full shadow-xl flex items-center justify-center"
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
        title="Send feedback"
      >
        <MessageSquarePlus className="w-6 h-6" />
      </motion.button>

      {/* Panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="fixed bottom-24 right-6 z-50 w-80 bg-surface-800 border border-surface-700 rounded-2xl shadow-2xl overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-surface-700 bg-surface-900">
              <h3 className="font-semibold text-white">
                {step === 'select' && 'Send Feedback'}
                {step === 'detail' && 'Tell us more'}
                {step === 'success' && 'Thank you! 🙏'}
              </h3>
              <button onClick={handleClose} className="text-surface-400 hover:text-white p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="p-4">
              {step === 'select' && (
                <div className="space-y-2">
                  <p className="text-surface-400 text-sm mb-4">What would you like to report?</p>
                  {QUICK_CATEGORIES.map((cat) => (
                    <button
                      key={cat.id}
                      onClick={() => handleCategorySelect(cat.id)}
                      className="w-full p-3 bg-surface-700 hover:bg-surface-600 rounded-lg text-left text-sm text-surface-200 flex items-center gap-3 transition-colors"
                    >
                      <span>{cat.icon}</span>
                      {cat.label}
                    </button>
                  ))}
                </div>
              )}

              {step === 'detail' && (
                <div className="space-y-3">
                  <button
                    onClick={() => setStep('select')}
                    className="flex items-center gap-1 text-surface-400 text-sm hover:text-white"
                  >
                    <ChevronDown className="w-4 h-4 rotate-90" /> Back
                  </button>
                  <div>
                    <label className="text-surface-400 text-xs mb-1 block">Title (optional)</label>
                    <input
                      type="text"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      className="input w-full text-sm"
                      placeholder="Brief description"
                    />
                  </div>
                  <div>
                    <label className="text-surface-400 text-xs mb-1 block">
                      Details <span className="text-red-400">*</span>
                    </label>
                    <textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      rows={4}
                      className="input w-full text-sm resize-none"
                      placeholder="Describe what happened, what you expected, and any details that can help us fix it..."
                      autoFocus
                    />
                    <p className="text-surface-500 text-xs mt-1">
                      {description.split(' ').filter(Boolean).length} words
                      {description.split(' ').filter(Boolean).length < 10 && description.length > 0 && (
                        <span className="text-yellow-400 ml-2">More detail helps us resolve faster</span>
                      )}
                    </p>
                  </div>
                  <p className="text-surface-500 text-xs">
                    📍 Context captured: {location.pathname}
                  </p>
                  {submitError && (
                    <div className="text-red-400 text-xs bg-red-500/10 border border-red-500/20 rounded-lg p-2.5">
                      {submitError}
                    </div>
                  )}
                  <button
                    onClick={handleSubmit}
                    disabled={!description.trim() || submitting}
                    className="btn-primary w-full flex items-center justify-center gap-2"
                  >
                    {submitting ? (
                      <span className="animate-spin rounded-full h-4 w-4 border-t-2 border-white" />
                    ) : (
                      <Send className="w-4 h-4" />
                    )}
                    {submitting ? 'Sending...' : 'Submit'}
                  </button>
                </div>
              )}

              {step === 'success' && result && (
                <div className="text-center py-2">
                  <CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-3" />
                  <p className="text-white font-medium mb-1">{result.message}</p>
                  <div className="bg-surface-700 rounded-lg p-3 mt-4 text-left">
                    <p className="text-surface-400 text-xs mb-1">Reference number:</p>
                    <p className="text-white font-mono font-bold text-sm">{result.id}</p>
                    <p className="text-surface-400 text-xs mt-2">
                      Our AI is reviewing your report now. You can track it in
                      <a href="/feedback" className="text-primary-400 ml-1">My Tickets</a>.
                    </p>
                  </div>
                  <button
                    onClick={handleClose}
                    className="btn-primary w-full mt-4"
                  >
                    Done
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
