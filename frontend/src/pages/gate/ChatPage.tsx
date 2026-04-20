/**
 * ChatPage — AI Tutor chat interface with streaming responses.
 * Mobile-first, supports LaTeX rendering, suggested prompts.
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Loader2, Sparkles, Trash2, BookOpen } from 'lucide-react';
import { useSession } from '@/hooks/useSession';
import { useStorageMode } from '@/hooks/useStorageMode';
import { CameraInput } from '@/components/gate/CameraInput';
import { streamGroundedChat } from '@/lib/gbrain/client';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at?: string;
}

const SUGGESTIONS = [
  { text: 'Explain eigenvalues with examples', dot: 'bg-sky-400' },
  { text: 'What should I focus on for GATE 2027?', dot: 'bg-emerald-400' },
  { text: 'Verify my answer to a problem', dot: 'bg-amber-400' },
];

const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

export default function ChatPage() {
  const sessionId = useSession();
  const { effectiveMode, groundingCount } = useStorageMode();
  const [searchParams, setSearchParams] = useSearchParams();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [attachedImage, setAttachedImage] = useState<{ base64: string; mimeType: string } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Pre-fill from URL param (e.g. /chat?prompt=Explain+eigenvalues)
  useEffect(() => {
    const prompt = searchParams.get('prompt');
    if (prompt) {
      setInput(prompt.slice(0, 500));
      setSearchParams({}, { replace: true });
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [searchParams, setSearchParams]);

  // Load chat history on mount
  useEffect(() => {
    if (!sessionId || loaded) return;
    fetch(`${API_BASE}/api/chat/${sessionId}`)
      .then(r => r.ok ? r.json() : { messages: [] })
      .then(data => {
        if (data.messages?.length) {
          setMessages(data.messages.map((m: any) => ({
            id: m.id,
            role: m.role,
            content: m.content,
            created_at: m.created_at,
          })));
        }
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, [sessionId, loaded]);

  // Auto-scroll on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isStreaming || !sessionId) return;

    const currentImage = attachedImage;
    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: currentImage ? `[Photo attached] ${text.trim()}` : text.trim(),
    };

    const assistantMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: '',
    };

    setMessages(prev => [...prev, userMsg, assistantMsg]);
    setInput('');
    setAttachedImage(null);
    setIsStreaming(true);

    try {
      // IndexedDB mode: use client-side GBrain with material grounding.
      if (effectiveMode === 'indexeddb') {
        await streamGroundedChat(
          sessionId,
          text.trim(),
          messages.slice(-10).map(m => ({ role: m.role, content: m.content })),
          (chunk) => {
            setMessages(prev => {
              const updated = [...prev];
              const last = updated[updated.length - 1];
              if (last.role === 'assistant') {
                updated[updated.length - 1] = { ...last, content: last.content + chunk };
              }
              return updated;
            });
          },
          () => { /* done handled by finally */ },
          (err) => { throw new Error(err); },
        );
        setIsStreaming(false);
        return;
      }

      // DB mode: original server chat endpoint.
      const chatBody: any = {
        sessionId,
        message: text.trim(),
        history: messages.slice(-10).map(m => ({ role: m.role, content: m.content })),
      };
      if (currentImage) {
        chatBody.image = currentImage.base64;
        chatBody.imageMimeType = currentImage.mimeType;
      }

      const response = await fetch(`${API_BASE}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(chatBody),
      });

      if (!response.ok) throw new Error('Chat request failed');

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) throw new Error('No response body');

      let buffer = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const data = JSON.parse(line.slice(6));
            if (data.type === 'chunk') {
              setMessages(prev => {
                const updated = [...prev];
                const last = updated[updated.length - 1];
                if (last.role === 'assistant') {
                  updated[updated.length - 1] = { ...last, content: last.content + data.content };
                }
                return updated;
              });
            }
          } catch { /* skip non-JSON lines */ }
        }
      }
    } catch (err) {
      console.error('[chat] Error:', err);
      setMessages(prev => {
        const updated = [...prev];
        const last = updated[updated.length - 1];
        if (last.role === 'assistant' && !last.content) {
          updated[updated.length - 1] = { ...last, content: 'Sorry, I had trouble responding. Please try again.' };
        }
        return updated;
      });
    }

    setIsStreaming(false);
  }, [sessionId, isStreaming, messages, attachedImage, effectiveMode]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const clearChat = () => {
    setMessages([]);
  };

  const isEmpty = messages.length === 0;

  return (
    <div className="flex flex-col h-[calc(100dvh-128px)] -m-4">
      {/* Grounding indicator */}
      {effectiveMode === 'indexeddb' && groundingCount > 0 && (
        <div className="mx-4 mt-2 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center gap-2">
          <BookOpen size={11} className="text-emerald-400 shrink-0" />
          <p className="text-[10px] text-emerald-300">
            Grounded in your materials — {groundingCount} chunk{groundingCount === 1 ? '' : 's'} available
          </p>
        </div>
      )}
      {/* Messages or Welcome */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {isEmpty ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center h-full gap-6"
          >
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500 to-sky-500 flex items-center justify-center shadow-2xl shadow-emerald-500/30">
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            <div className="text-center">
              <h2 className="text-xl font-bold text-white mb-2">GATE Math Tutor</h2>
              <p className="text-surface-400 text-sm max-w-xs">
                Ask me anything about GATE Engineering Mathematics.
              </p>
            </div>

            <div className="flex flex-wrap justify-center gap-2 w-full max-w-lg">
              {SUGGESTIONS.map((s, i) => (
                <motion.button
                  key={i}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 + i * 0.05 }}
                  onClick={() => sendMessage(s.text)}
                  className="flex items-center gap-2 px-3 py-2 rounded-full bg-surface-900/80 border border-surface-800 hover:border-surface-700 transition-all text-left group"
                >
                  <div className={`w-2 h-2 rounded-full ${s.dot} shrink-0`} />
                  <span className="text-xs text-surface-300 group-hover:text-white transition-colors">
                    {s.text}
                  </span>
                </motion.button>
              ))}
            </div>
          </motion.div>
        ) : (
          <div className="max-w-3xl mx-auto space-y-4">
            <AnimatePresence mode="popLayout">
              {messages.map((msg) => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
                      msg.role === 'user'
                        ? 'bg-sky-600 text-white rounded-br-md'
                        : 'bg-surface-800/80 text-surface-200 rounded-bl-md border border-surface-700/50'
                    }`}
                  >
                    {msg.content || (
                      <span className="flex items-center gap-2 text-surface-400">
                        <Loader2 size={14} className="animate-spin" />
                        Thinking...
                      </span>
                    )}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input bar */}
      <div className="border-t border-surface-800/80 bg-surface-950/95 backdrop-blur-md px-4 py-3">
        {/* Image preview */}
        {attachedImage && (
          <div className="max-w-3xl mx-auto mb-2">
            <CameraInput
              onCapture={(b, m) => setAttachedImage({ base64: b, mimeType: m })}
              onClear={() => setAttachedImage(null)}
              preview={attachedImage.base64}
              compact
            />
          </div>
        )}
        <div className="max-w-3xl mx-auto flex items-end gap-2">
          {messages.length > 0 && (
            <button
              onClick={clearChat}
              className="p-2.5 rounded-xl text-surface-500 hover:text-surface-300 hover:bg-surface-800 transition-colors flex-shrink-0"
              title="Clear chat"
            >
              <Trash2 size={18} />
            </button>
          )}
          <CameraInput
            onCapture={(b, m) => setAttachedImage({ base64: b, mimeType: m })}
            onClear={() => setAttachedImage(null)}
            preview={null}
            compact
          />
          <div className="flex-1 relative">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask anything about GATE math..."
              rows={1}
              className="w-full resize-none rounded-xl bg-surface-900 border border-surface-700 px-4 py-3 pr-12 text-sm text-white placeholder-surface-500 focus:outline-none focus:border-sky-500/50 focus:ring-1 focus:ring-sky-500/30 transition-all max-h-32"
              style={{ minHeight: '44px' }}
              onInput={(e) => {
                const target = e.target as HTMLTextAreaElement;
                target.style.height = '44px';
                target.style.height = Math.min(target.scrollHeight, 128) + 'px';
              }}
            />
            <button
              onClick={() => sendMessage(input)}
              disabled={!input.trim() || isStreaming}
              className="absolute right-2 bottom-2 p-2 rounded-lg bg-sky-600 text-white disabled:opacity-30 disabled:cursor-not-allowed hover:bg-sky-500 transition-colors"
            >
              {isStreaming ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Send size={16} />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
