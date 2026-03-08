/**
 * LoginPage.tsx — EduGenius Authentication Page
 *
 * Supports: Email OTP, WhatsApp OTP, Telegram token, Passkey, Google OAuth
 * States: method selection → OTP entry → new user profile → success
 */

import { useState, useRef, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Mail, Phone, Key, Chrome, MessageSquare, Send, ArrowRight,
  Copy, Check, BookOpen, Loader2, ChevronLeft, GraduationCap,
} from 'lucide-react';
import { clsx } from 'clsx';
import { EXAM_CATALOG } from '@/services/userService';
import {
  requestOTP,
  verifyOTP,
  loginWithPasskey,
  loginWithGoogle,
  type LoginMethod,
  type LoginStep,
} from '@/services/authService';
import type { EGUser } from '@/services/userService';
import { updateUser } from '@/services/userService';

// ─── Types ────────────────────────────────────────────────────────────────────

type PageState = 'select' | 'otp' | 'profile' | 'success';

// ─── OTP Input Component ──────────────────────────────────────────────────────

function OTPInput({ onComplete }: { onComplete: (otp: string) => void }) {
  const [digits, setDigits] = useState(['', '', '', '', '', '']);
  const refs = useRef<(HTMLInputElement | null)[]>([]);

  const handleChange = (idx: number, val: string) => {
    const d = val.replace(/\D/g, '').slice(-1);
    const next = [...digits];
    next[idx] = d;
    setDigits(next);
    if (d && idx < 5) {
      refs.current[idx + 1]?.focus();
    }
    if (next.every((v) => v !== '')) {
      onComplete(next.join(''));
    }
  };

  const handleKeyDown = (idx: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !digits[idx] && idx > 0) {
      refs.current[idx - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted.length === 6) {
      setDigits(pasted.split(''));
      onComplete(pasted);
    }
  };

  return (
    <div className="flex gap-3 justify-center my-6">
      {digits.map((d, i) => (
        <input
          key={i}
          ref={(el) => { refs.current[i] = el; }}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={d}
          onChange={(e) => handleChange(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onPaste={handlePaste}
          className={clsx(
            'w-12 h-14 text-center text-xl font-bold rounded-xl border-2 transition-all duration-200',
            'bg-surface-800 text-white outline-none',
            d
              ? 'border-primary-500 shadow-[0_0_12px_rgba(99,102,241,0.3)]'
              : 'border-white/20 focus:border-primary-400'
          )}
        />
      ))}
    </div>
  );
}

// ─── Copyable UID Badge ───────────────────────────────────────────────────────

function UIDDisplay({ uid }: { uid: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(uid).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <button
      onClick={copy}
      className="flex items-center gap-2 px-4 py-2 rounded-full bg-primary-500/20 border border-primary-500/30 text-primary-300 text-sm font-mono hover:bg-primary-500/30 transition-colors group"
    >
      <GraduationCap size={14} />
      {uid}
      {copied ? <Check size={14} className="text-green-400" /> : <Copy size={14} className="opacity-60 group-hover:opacity-100" />}
    </button>
  );
}

// ─── Main LoginPage ───────────────────────────────────────────────────────────

export default function LoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [pageState, setPageState] = useState<PageState>('select');
  const [method, setMethod] = useState<LoginMethod>('email_otp');
  const [identifier, setIdentifier] = useState('');
  const [loginStep, setLoginStep] = useState<LoginStep | null>(null);
  const [loggedInUser, setLoggedInUser] = useState<EGUser | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [resendTimer, setResendTimer] = useState(0);

  // New user profile state
  const [profileName, setProfileName] = useState('');
  const [selectedExam, setSelectedExam] = useState('');

  // Resend timer
  useEffect(() => {
    if (resendTimer > 0) {
      const t = setTimeout(() => setResendTimer((v) => v - 1), 1000);
      return () => clearTimeout(t);
    }
  }, [resendTimer]);

  // Handle Telegram/channel token from URL
  useEffect(() => {
    const token = searchParams.get('token');
    const channel = searchParams.get('channel');
    if (token && channel) {
      setIdentifier(token);
      setMethod('telegram_token');
    }
  }, [searchParams]);

  const handleSendOTP = async () => {
    if (!identifier.trim()) {
      setError('Please enter your email or phone number.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const step = await requestOTP(method, identifier.trim());
      setLoginStep(step);
      setPageState('otp');
      setResendTimer(30);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to send OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async (otp: string) => {
    if (!loginStep) return;
    setLoading(true);
    setError('');
    try {
      const user = await verifyOTP(loginStep, otp);
      setLoggedInUser(user);
      // New user check (no auth methods previously except the one we just added, status is pending)
      if (user.status === 'pending' || !user.name || user.name === 'Student') {
        setProfileName(user.name !== 'Student' ? user.name : '');
        setPageState('profile');
      } else {
        setPageState('success');
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Invalid OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handlePasskey = async () => {
    setLoading(true);
    setError('');
    try {
      const user = await loginWithPasskey(identifier || undefined);
      setLoggedInUser(user);
      setPageState('success');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Passkey login failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setLoading(true);
    setError('');
    try {
      const user = await loginWithGoogle();
      setLoggedInUser(user);
      setPageState('success');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Google login failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleProfileSave = async () => {
    if (!loggedInUser) return;
    if (!profileName.trim()) {
      setError('Please enter your name.');
      return;
    }
    setLoading(true);
    try {
      const updated = updateUser(loggedInUser.uid, {
        name: profileName.trim(),
        status: 'active',
        preferences: {
          ...loggedInUser.preferences,
          preferredExamId: selectedExam || undefined,
        },
      });
      if (updated) setLoggedInUser(updated);
      setPageState('success');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (!loginStep || resendTimer > 0) return;
    await handleSendOTP();
  };

  const navigateToDashboard = () => {
    const role = loggedInUser?.role;
    if (role === 'admin' || role === 'owner') navigate('/user-portal');
    else if (role === 'teacher' || role === 'manager') navigate('/manager');
    else navigate('/');
  };

  const inputCls =
    'w-full px-4 py-3 rounded-xl bg-surface-700/60 border border-white/10 text-white placeholder-surface-400 focus:outline-none focus:border-primary-400 focus:ring-1 focus:ring-primary-400/30 transition-all text-sm';

  return (
    <div className="min-h-screen bg-surface-950 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Ambient blobs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-primary-600/20 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-violet-600/15 rounded-full blur-3xl" />
      </div>

      <motion.div
        className="relative w-full max-w-md"
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        {/* Card */}
        <div className="bg-surface-800/70 backdrop-blur-xl rounded-2xl border border-white/10 shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="px-8 pt-8 pb-6 border-b border-white/8">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-violet-600 flex items-center justify-center text-xl">
                🎓
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">EduGenius</h1>
                <p className="text-xs text-surface-400">AI-powered exam preparation</p>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="px-8 py-6">
            <AnimatePresence mode="wait">

              {/* ── STATE: Select Method ────────────────────────────────────── */}
              {pageState === 'select' && (
                <motion.div key="select" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <p className="text-white font-semibold mb-1">Sign in to continue</p>
                  <p className="text-surface-400 text-xs mb-5">Choose how you'd like to sign in</p>

                  {/* Channel quick-auth */}
                  <div className="grid grid-cols-2 gap-3 mb-5">
                    <button
                      onClick={() => { setMethod('whatsapp_otp'); }}
                      className={clsx(
                        'flex items-center gap-2 px-4 py-3 rounded-xl border text-sm font-medium transition-all',
                        method === 'whatsapp_otp'
                          ? 'border-green-500 bg-green-500/15 text-green-300'
                          : 'border-white/10 bg-surface-700/40 text-surface-300 hover:border-green-500/50 hover:text-green-300'
                      )}
                    >
                      <Phone size={16} />
                      WhatsApp
                    </button>
                    <button
                      onClick={() => { setMethod('telegram_token'); }}
                      className={clsx(
                        'flex items-center gap-2 px-4 py-3 rounded-xl border text-sm font-medium transition-all',
                        method === 'telegram_token'
                          ? 'border-blue-400 bg-blue-500/15 text-blue-300'
                          : 'border-white/10 bg-surface-700/40 text-surface-300 hover:border-blue-400/50 hover:text-blue-300'
                      )}
                    >
                      <Send size={16} />
                      Telegram
                    </button>
                  </div>

                  {/* Divider */}
                  <div className="flex items-center gap-3 mb-5">
                    <div className="flex-1 h-px bg-white/8" />
                    <span className="text-surface-500 text-xs">or</span>
                    <div className="flex-1 h-px bg-white/8" />
                  </div>

                  {/* Email / Phone */}
                  <div className="mb-4">
                    <label className="block text-xs text-surface-400 mb-2">
                      {method === 'whatsapp_otp' ? '📱 WhatsApp number (with country code)' :
                       method === 'telegram_token' ? '✈️ Telegram link token' :
                       '📧 Email or phone number'}
                    </label>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setMethod('email_otp')}
                        className={clsx(
                          'p-3 rounded-xl border transition-all',
                          method === 'email_otp'
                            ? 'border-primary-500 bg-primary-500/15 text-primary-300'
                            : 'border-white/10 bg-surface-700/40 text-surface-400 hover:border-primary-500/40'
                        )}
                      >
                        <Mail size={16} />
                      </button>
                      <input
                        type={method === 'whatsapp_otp' ? 'tel' : 'text'}
                        placeholder={
                          method === 'whatsapp_otp' ? '+91 98765 43210' :
                          method === 'telegram_token' ? 'Paste your link token' :
                          'you@example.com'
                        }
                        value={identifier}
                        onChange={(e) => { setIdentifier(e.target.value); setError(''); }}
                        onKeyDown={(e) => e.key === 'Enter' && handleSendOTP()}
                        className={inputCls + ' flex-1'}
                      />
                    </div>
                  </div>

                  {error && (
                    <p className="text-red-400 text-xs mb-3">{error}</p>
                  )}

                  <button
                    onClick={handleSendOTP}
                    disabled={loading}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-gradient-to-r from-primary-600 to-violet-600 text-white font-semibold text-sm hover:from-primary-500 hover:to-violet-500 transition-all disabled:opacity-60"
                  >
                    {loading ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />}
                    {loading ? 'Sending…' : 'Continue'}
                  </button>

                  {/* Divider */}
                  <div className="flex items-center gap-3 my-4">
                    <div className="flex-1 h-px bg-white/8" />
                    <span className="text-surface-500 text-xs">or</span>
                    <div className="flex-1 h-px bg-white/8" />
                  </div>

                  {/* Alternative methods */}
                  <div className="flex flex-col gap-2">
                    <button
                      onClick={handlePasskey}
                      disabled={loading}
                      className="flex items-center gap-2 px-4 py-3 rounded-xl border border-white/10 bg-surface-700/40 text-surface-300 text-sm hover:border-amber-500/50 hover:text-amber-300 transition-all"
                    >
                      <Key size={16} />
                      Sign in with Passkey
                    </button>
                    <button
                      onClick={handleGoogle}
                      disabled={loading}
                      className="flex items-center gap-2 px-4 py-3 rounded-xl border border-white/10 bg-surface-700/40 text-surface-300 text-sm hover:border-blue-500/50 hover:text-blue-300 transition-all"
                    >
                      <Chrome size={16} />
                      Sign in with Google
                    </button>
                  </div>

                  <p className="text-surface-500 text-xs text-center mt-5">
                    New here? Just sign in — we'll set up your account automatically.
                  </p>
                </motion.div>
              )}

              {/* ── STATE: OTP Entry ───────────────────────────────────────── */}
              {pageState === 'otp' && (
                <motion.div key="otp" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                  <button
                    onClick={() => setPageState('select')}
                    className="flex items-center gap-1 text-surface-400 text-xs hover:text-white transition-colors mb-4"
                  >
                    <ChevronLeft size={14} /> Back
                  </button>

                  <p className="text-white font-semibold mb-1">Enter verification code</p>
                  <p className="text-surface-400 text-xs mb-1">
                    Code sent to <span className="text-surface-200">{identifier}</span>
                  </p>
                  <p className="text-surface-500 text-xs mb-2">
                    (In demo mode, use <code className="text-amber-400 bg-amber-500/10 px-1 rounded">000000</code> to bypass)
                  </p>

                  <OTPInput onComplete={handleVerifyOTP} />

                  {error && <p className="text-red-400 text-xs text-center mb-3">{error}</p>}

                  {loading && (
                    <div className="flex justify-center mb-4">
                      <Loader2 size={20} className="animate-spin text-primary-400" />
                    </div>
                  )}

                  <div className="flex justify-center">
                    <button
                      onClick={handleResend}
                      disabled={resendTimer > 0 || loading}
                      className="text-xs text-surface-400 hover:text-white transition-colors disabled:opacity-40"
                    >
                      {resendTimer > 0 ? `Resend in ${resendTimer}s` : 'Resend code'}
                    </button>
                  </div>
                </motion.div>
              )}

              {/* ── STATE: New User Profile ────────────────────────────────── */}
              {pageState === 'profile' && (
                <motion.div key="profile" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                  <p className="text-white font-semibold mb-1">Welcome to EduGenius! 🎉</p>
                  <p className="text-surface-400 text-xs mb-5">Let's set up your profile</p>

                  <div className="mb-4">
                    <label className="block text-xs text-surface-400 mb-2">Your name</label>
                    <input
                      type="text"
                      placeholder="e.g. Arjun Sharma"
                      value={profileName}
                      onChange={(e) => setProfileName(e.target.value)}
                      className={inputCls}
                    />
                  </div>

                  <div className="mb-5">
                    <label className="block text-xs text-surface-400 mb-2">Which exam are you preparing for?</label>
                    <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
                      {EXAM_CATALOG.map((exam) => (
                        <button
                          key={exam.id}
                          onClick={() => setSelectedExam(exam.id)}
                          className={clsx(
                            'flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-medium text-left transition-all',
                            selectedExam === exam.id
                              ? 'border-primary-500 bg-primary-500/15 text-primary-200'
                              : 'border-white/10 bg-surface-700/40 text-surface-300 hover:border-primary-500/40'
                          )}
                        >
                          <span className="text-base">{exam.emoji}</span>
                          <span>{exam.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {error && <p className="text-red-400 text-xs mb-3">{error}</p>}

                  <button
                    onClick={handleProfileSave}
                    disabled={loading}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-gradient-to-r from-primary-600 to-violet-600 text-white font-semibold text-sm hover:from-primary-500 hover:to-violet-500 transition-all disabled:opacity-60"
                  >
                    {loading ? <Loader2 size={16} className="animate-spin" /> : <BookOpen size={16} />}
                    {loading ? 'Saving…' : 'Start Learning'}
                  </button>
                </motion.div>
              )}

              {/* ── STATE: Success ─────────────────────────────────────────── */}
              {pageState === 'success' && loggedInUser && (
                <motion.div key="success" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}>
                  <div className="text-center mb-6">
                    <div className="w-16 h-16 rounded-full bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center text-3xl mx-auto mb-4">
                      🎓
                    </div>
                    <p className="text-white font-bold text-lg mb-1">
                      Welcome, {loggedInUser.name}!
                    </p>
                    <p className="text-surface-400 text-sm mb-4">
                      You're all set. Your EduGenius ID:
                    </p>
                    <div className="flex justify-center">
                      <UIDDisplay uid={loggedInUser.uid} />
                    </div>
                    <p className="text-surface-500 text-xs mt-2">
                      Save this ID — it works across WhatsApp, Telegram & Web.
                    </p>
                  </div>

                  {loggedInUser.examSubscriptions.length > 0 && (
                    <div className="mb-5 p-3 rounded-xl bg-surface-700/40 border border-white/8">
                      <p className="text-xs text-surface-400 mb-2">Your exams:</p>
                      <div className="flex flex-wrap gap-2">
                        {loggedInUser.examSubscriptions.map((s) => (
                          <span key={s.examId} className="flex items-center gap-1 px-2 py-1 rounded-full bg-primary-500/20 text-primary-300 text-xs">
                            {EXAM_CATALOG.find((e) => e.id === s.examId)?.emoji} {s.examName}
                            <span className="text-primary-400/60">({s.plan})</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  <button
                    onClick={navigateToDashboard}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-gradient-to-r from-primary-600 to-violet-600 text-white font-semibold text-sm hover:from-primary-500 hover:to-violet-500 transition-all"
                  >
                    <ArrowRight size={16} />
                    Go to Dashboard
                  </button>
                </motion.div>
              )}

            </AnimatePresence>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-surface-600 text-xs mt-4">
          EduGenius v2.0 · AI-powered learning for competitive exams
        </p>
      </motion.div>
    </div>
  );
}
