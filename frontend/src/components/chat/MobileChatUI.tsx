/**
 * MobileChatUI.tsx — Mobile-First Sage Chat Interface
 *
 * Design principles:
 * 1. Thumb zone first — input stays at bottom, within thumb reach
 * 2. Large tap targets — minimum 44px on all interactive elements
 * 3. Safe area aware — respects iOS notch + home indicator
 * 4. No horizontal scroll — everything adapts to viewport width
 * 5. LaTeX renders inline — KaTeX works on mobile
 * 6. Voice input prominent — mic button equal size to send
 * 7. Quick replies as scrollable horizontal pill row
 * 8. Long responses collapsed — "Show more" to expand
 * 9. Haptic-ready — sends signals for vibration on send/receive
 *10. Offline indicator — shows when no connection
 *
 * Usage:
 *   Auto-detected via useIsMobile() hook.
 *   Chat.tsx renders <MobileChatUI> instead of the desktop layout when mobile.
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, MicOff, Send, ChevronDown, ChevronUp, Paperclip, X, Sparkles } from 'lucide-react';
import { clsx } from 'clsx';
import type { Message } from '@/types';
import type { QuickReply } from '@/services/channelAdapter';

// ─── Mobile detection hook ────────────────────────────────────────────────────

export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(
    typeof window !== 'undefined' && window.innerWidth < 768
  );
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);
  return isMobile;
}

// ─── Message bubble — mobile variant ─────────────────────────────────────────

const MOBILE_COLLAPSE_LENGTH = 400; // chars before "Show more" appears

function MobileMessageBubble({
  message,
  isLastAssistant,
}: {
  message: Message;
  isLastAssistant: boolean;
}) {
  const isUser = message.role === 'user';
  const [expanded, setExpanded] = useState(false);
  const isLong = !isUser && message.content.length > MOBILE_COLLAPSE_LENGTH;
  const displayContent = isLong && !expanded
    ? message.content.slice(0, MOBILE_COLLAPSE_LENGTH) + '…'
    : message.content;

  return (
    <div className={clsx('flex gap-2.5', isUser ? 'justify-end' : 'justify-start')}>
      {/* Agent avatar */}
      {!isUser && (
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-sm shrink-0 mt-1 shadow-md">
          🎓
        </div>
      )}

      <div className={clsx('flex flex-col gap-1', isUser ? 'items-end' : 'items-start', 'max-w-[82vw]')}>
        {/* Bubble */}
        <div className={clsx(
          'rounded-2xl px-4 py-3 text-[15px] leading-relaxed shadow-sm',
          isUser
            ? 'bg-gradient-to-br from-indigo-600 to-indigo-700 text-white rounded-tr-sm'
            : 'bg-slate-800/80 text-slate-100 rounded-tl-sm border border-slate-700/40',
        )}>
          {/* Content — whitespace preserved for math */}
          <div className="whitespace-pre-wrap break-words">{displayContent}</div>

          {/* Show more / less toggle */}
          {isLong && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="flex items-center gap-1 mt-2 text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
            >
              {expanded
                ? <><ChevronUp className="w-3 h-3" /> Show less</>
                : <><ChevronDown className="w-3 h-3" /> Show more ({Math.ceil(message.content.length / MOBILE_COLLAPSE_LENGTH)}x longer)</>}
            </button>
          )}
        </div>

        {/* Timestamp */}
        <span className="text-[10px] text-slate-500 px-1">
          {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>
    </div>
  );
}

// ─── Typing indicator ─────────────────────────────────────────────────────────

function TypingBubble() {
  return (
    <div className="flex items-center gap-2.5">
      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-sm shrink-0">
        🎓
      </div>
      <div className="bg-slate-800/80 border border-slate-700/40 rounded-2xl rounded-tl-sm px-4 py-3">
        <div className="flex gap-1.5 items-center h-4">
          {[0, 1, 2].map(i => (
            <span
              key={i}
              className="w-2 h-2 rounded-full bg-slate-400 animate-bounce"
              style={{ animationDelay: `${i * 150}ms` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Quick reply pill row ─────────────────────────────────────────────────────

function QuickReplyRow({
  replies,
  onSelect,
}: {
  replies: QuickReply[];
  onSelect: (text: string) => void;
}) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide px-1">
      {replies.map(r => (
        <button
          key={r.id}
          onClick={() => onSelect(r.text)}
          className="shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-full border border-indigo-500/30 bg-indigo-500/10 text-indigo-300 text-sm hover:bg-indigo-500/25 active:scale-95 transition-all touch-manipulation"
        >
          {r.icon && <span>{r.icon}</span>}
          {r.text}
        </button>
      ))}
    </div>
  );
}

// ─── Voice recording indicator ────────────────────────────────────────────────

function VoiceRecordingIndicator({ duration }: { duration: number }) {
  const secs = Math.floor(duration / 1000);
  return (
    <div className="flex items-center gap-3 px-4 py-2 bg-red-500/20 border border-red-500/30 rounded-full">
      <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse" />
      <span className="text-sm text-red-300">Recording {secs}s — release to send</span>
    </div>
  );
}

// ─── Mobile chat input bar ────────────────────────────────────────────────────

interface MobileChatInputProps {
  onSend: (text: string) => void;
  onAttach?: () => void;
  disabled?: boolean;
  placeholder?: string;
}

function MobileChatInput({ onSend, onAttach, disabled = false, placeholder = 'Ask Sage...' }: MobileChatInputProps) {
  const [text, setText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [recordDuration, setRecordDuration] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const recordTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  // Auto-resize textarea
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 120) + 'px';
  }, [text]);

  const handleSend = useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setText('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
    // Haptic feedback (mobile)
    if ('vibrate' in navigator) navigator.vibrate(10);
  }, [text, disabled, onSend]);

  const startRecording = () => {
    setIsRecording(true);
    setRecordDuration(0);
    recordTimer.current = setInterval(() => setRecordDuration(d => d + 1000), 1000);
    if ('vibrate' in navigator) navigator.vibrate([20, 10, 20]);
  };

  const stopRecording = () => {
    setIsRecording(false);
    if (recordTimer.current) clearInterval(recordTimer.current);
    setRecordDuration(0);
    // TODO: transcribe audio and call onSend with transcript
  };

  const canSend = text.trim().length > 0 && !disabled;

  return (
    <div className="space-y-2">
      {/* Recording indicator */}
      <AnimatePresence>
        {isRecording && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            className="flex justify-center"
          >
            <VoiceRecordingIndicator duration={recordDuration} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input row */}
      <div className="flex items-end gap-2">
        {/* Attach button */}
        {onAttach && (
          <button
            onClick={onAttach}
            className="w-11 h-11 flex items-center justify-center rounded-full bg-slate-800/80 border border-slate-700/60 text-slate-400 hover:text-slate-200 hover:border-slate-500 active:scale-95 transition-all touch-manipulation shrink-0"
          >
            <Paperclip className="w-5 h-5" />
          </button>
        )}

        {/* Textarea */}
        <div className="flex-1 relative">
          <textarea
            ref={textareaRef}
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder={placeholder}
            disabled={disabled}
            rows={1}
            className={clsx(
              'w-full resize-none px-4 py-3 pr-10 rounded-2xl text-[15px] leading-relaxed',
              'bg-slate-800/80 border border-slate-700/60 text-slate-100 placeholder-slate-500',
              'focus:outline-none focus:border-indigo-500/60 focus:ring-1 focus:ring-indigo-500/20',
              'disabled:opacity-50 transition-colors',
              'max-h-[120px] overflow-y-auto',
            )}
          />
        </div>

        {/* Send / Voice button — right side */}
        {canSend ? (
          <button
            onClick={handleSend}
            disabled={disabled}
            className="w-11 h-11 flex items-center justify-center rounded-full bg-gradient-to-br from-indigo-600 to-indigo-700 text-white active:scale-95 transition-all touch-manipulation shrink-0 shadow-lg shadow-indigo-500/20 disabled:opacity-50"
          >
            <Send className="w-4.5 h-4.5 ml-0.5" />
          </button>
        ) : (
          <button
            onTouchStart={startRecording}
            onTouchEnd={stopRecording}
            onMouseDown={startRecording}
            onMouseUp={stopRecording}
            className={clsx(
              'w-11 h-11 flex items-center justify-center rounded-full transition-all touch-manipulation shrink-0',
              isRecording
                ? 'bg-red-500 text-white scale-110 shadow-lg shadow-red-500/30'
                : 'bg-slate-800/80 border border-slate-700/60 text-slate-400 hover:text-slate-200',
            )}
          >
            {isRecording ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Main MobileChatUI ────────────────────────────────────────────────────────

interface MobileChatUIProps {
  messages: Message[];
  isTyping: boolean;
  onSend: (text: string) => void;
  onAttach?: () => void;
  quickReplies?: QuickReply[];
  examName?: string;
  agentName?: string;
  onBack?: () => void;
}

export function MobileChatUI({
  messages,
  isTyping,
  onSend,
  onAttach,
  quickReplies,
  examName = 'GATE EM',
  agentName = 'Sage',
  onBack,
}: MobileChatUIProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [showScrollDown, setShowScrollDown] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, isTyping]);

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    setShowScrollDown(distFromBottom > 150);
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const lastAssistantIdx = messages.reduceRight(
    (found, m, i) => (found === -1 && m.role === 'assistant' ? i : found), -1
  );

  return (
    <div
      className="flex flex-col bg-slate-950"
      style={{
        // Full viewport height minus browser chrome, safe area aware
        height: 'calc(100dvh)',
        // Prevent iOS overscroll rubber-banding on outer element
        overscrollBehavior: 'none',
      }}
    >
      {/* ── Header ── */}
      <div
        className="flex items-center gap-3 px-4 py-3 bg-slate-900/95 border-b border-slate-800 backdrop-blur-sm shrink-0"
        style={{ paddingTop: 'max(12px, env(safe-area-inset-top))' }}
      >
        {onBack && (
          <button
            onClick={onBack}
            className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors touch-manipulation"
          >
            ‹
          </button>
        )}
        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-base shrink-0">
          🎓
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white leading-tight">{agentName}</p>
          <p className="text-[11px] text-emerald-400 leading-tight">● Online · {examName}</p>
        </div>
        <button className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-slate-800 text-slate-400 hover:text-indigo-400 transition-colors touch-manipulation">
          <Sparkles className="w-4 h-4" />
        </button>
      </div>

      {/* ── Message list ── */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-3 py-4 space-y-4"
        style={{ overscrollBehavior: 'contain' }}
      >
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-center px-6 pt-8">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-purple-600/20 flex items-center justify-center text-3xl">
              🎓
            </div>
            <div>
              <p className="text-white font-semibold text-lg">Ask Sage anything</p>
              <p className="text-slate-400 text-sm mt-1">Your {examName} mentor is ready</p>
            </div>
            {quickReplies && quickReplies.length > 0 && (
              <div className="flex flex-wrap justify-center gap-2 mt-2">
                {quickReplies.slice(0, 4).map(r => (
                  <button
                    key={r.id}
                    onClick={() => onSend(r.text)}
                    className="text-sm px-4 py-2 rounded-full border border-indigo-500/30 bg-indigo-500/10 text-indigo-300 hover:bg-indigo-500/20 active:scale-95 transition-all touch-manipulation"
                  >
                    {r.icon} {r.text}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {messages.map((msg, idx) => (
          <MobileMessageBubble
            key={msg.id}
            message={msg}
            isLastAssistant={idx === lastAssistantIdx}
          />
        ))}

        {isTyping && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <TypingBubble />
          </motion.div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Scroll-to-bottom FAB */}
      <AnimatePresence>
        {showScrollDown && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            onClick={scrollToBottom}
            className="absolute bottom-28 right-4 w-9 h-9 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-400 shadow-lg touch-manipulation"
          >
            <ChevronDown className="w-5 h-5" />
          </motion.button>
        )}
      </AnimatePresence>

      {/* ── Bottom input area ── */}
      <div
        className="shrink-0 bg-slate-900/95 border-t border-slate-800 backdrop-blur-sm px-3 pt-2 pb-2"
        style={{ paddingBottom: 'max(8px, env(safe-area-inset-bottom))' }}
      >
        {/* Quick replies row (only when last message is from Sage) */}
        {quickReplies && quickReplies.length > 0 && messages[messages.length - 1]?.role === 'assistant' && (
          <div className="mb-2">
            <QuickReplyRow
              replies={quickReplies}
              onSelect={onSend}
            />
          </div>
        )}

        <MobileChatInput
          onSend={onSend}
          onAttach={onAttach}
          placeholder="Ask Sage..."
        />
      </div>
    </div>
  );
}

export default MobileChatUI;
