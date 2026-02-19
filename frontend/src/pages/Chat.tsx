/**
 * Chat — Multimodal AI Interface
 * Supports: text, image upload, voice input, file upload, drawing/whiteboard
 * Intent detection auto-routes to the best agent
 * Output: rich markdown, equations, step-by-step cards, tables, image analysis
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Send, Plus, Trash2, User, Sparkles, Copy, Check, RefreshCw,
  ChevronDown, Settings2, Paperclip, Mic, PenTool,
  Image as ImageIcon, FileText, Zap, Brain, Eye,
  StopCircle,
} from 'lucide-react';
import { useChatStore } from '@/stores/chatStore';
import { useAppStore } from '@/stores/appStore';
import { useVoiceInput } from '@/hooks/useVoiceInput';
import { AttachmentPreview } from '@/components/chat/AttachmentPreview';
import { OutputBlockRenderer } from '@/components/chat/OutputBlockRenderer';
import { DrawingCanvas } from '@/components/chat/DrawingCanvas';
import { LearningModeSelector } from '@/components/tutor/LearningModeSelector';
import { SmartMemoryChip } from '@/components/ux/UXEnhancements';
import { detectIntent, generateOutputBlocks } from '@/services/intentEngine';
import { callLLM, isLLMConfigured, getActiveProvider } from '@/services/llmService';
import type { AgentType, Message, MediaAttachment, IntentResult } from '@/types';
import type { LearningMode } from '@/types/personalization';
import { clsx } from 'clsx';

// ─── Agent config ─────────────────────────────────────────────────────────────

const agentOptions = [
  { id: 'sage' as AgentType, name: 'Sage', emoji: '🎓', description: 'AI Tutor — learns, solves, explains', color: 'from-blue-500 to-cyan-500' },
  { id: 'atlas' as AgentType, name: 'Atlas', emoji: '📚', description: 'Content creator — questions, lessons', color: 'from-purple-500 to-pink-500' },
  { id: 'mentor' as AgentType, name: 'Mentor', emoji: '👨🏫', description: 'Study plans, motivation, streaks', color: 'from-green-500 to-emerald-500' },
  { id: 'oracle' as AgentType, name: 'Oracle', emoji: '📊', description: 'Analytics & performance insights', color: 'from-orange-500 to-yellow-500' },
  { id: 'scout' as AgentType, name: 'Scout', emoji: '🔍', description: 'Market research & intelligence', color: 'from-red-500 to-pink-500' },
  { id: 'herald' as AgentType, name: 'Herald', emoji: '📢', description: 'Marketing & content growth', color: 'from-indigo-500 to-purple-500' },
  { id: 'forge' as AgentType, name: 'Forge', emoji: '⚙️', description: 'DevOps & infrastructure', color: 'from-gray-500 to-slate-500' },
];

// ─── Mock AI responses (swap for real LLM calls) ──────────────────────────────

const MOCK_RESPONSES: Record<string, string[]> = {
  analyze_image: [
    `**Image Analysis Complete** 🔍\n\nI can see a mathematical problem in your image. Let me solve it step by step:\n\n**Given:** The equation from your diagram\n\n**Step 1:** Identify the type of problem\n**Step 2:** Apply the relevant formula\n**Step 3:** Solve and verify\n\n> Note: For best results, ensure your handwriting is clear and the problem is fully visible.\n\n**Key Formula Used:** [Connect to your specific problem]\n\nWould you like me to explain any step in more detail?`,
  ],
  solve_math: [
    `Let me solve this step by step! 🧮\n\n**Approach:** I'll use the standard method for this type of problem.\n\n**Step 1: Identify what's given**\n- Extract the variables\n- Note any constraints\n\n**Step 2: Apply the formula**\n\n*Formula:* The relevant equation for this problem\n\n**Step 3: Calculate**\n\nSubstitute values and simplify...\n\n**Final Answer:** ✅\n\n*Would you like to verify this with a different approach?*`,
  ],
  solve_physics: [
    `Physics problem detected! ⚡\n\n**Concept:** Let me identify the physics principle here.\n\n**Given:**\n- Variables from your problem\n- Relevant constants (g = 9.8 m/s², etc.)\n\n**Formula:**\n\n*[Relevant physics formula]*\n\n**Solution:**\n\n1. Convert units if needed\n2. Substitute values\n3. Calculate the result\n\n**Answer:** [Result with proper units]\n\n*Exam Tip: Always mention the formula first, then substitute — examiners love structured answers!* 🎯`,
  ],
  explain_concept: [
    `Great question! Let me break this down clearly. 💡\n\n**The Core Idea:**\n\nThis concept can be understood through three key aspects:\n\n1. **What it is:** The fundamental definition\n2. **Why it matters:** Real-world and exam relevance\n3. **How it works:** The mechanism behind it\n\n**Quick Intuition:**\n\n> Think of it like [simple analogy]...\n\n**Exam Perspective:**\n- High weightage in JEE/NEET\n- Usually appears in [section] of paper\n- Common question types: MCQ, assertion-reason\n\nShall I give you practice questions on this? 📝`,
  ],
  doubt_clearing: [
    `No worries — let me clear this up! 🤝\n\n**Your confusion is valid.** Many students get stuck here. Here's the clearest explanation:\n\n**The key distinction:**\n\nWhat you might be thinking vs. what actually happens:\n\n- ❌ Common misconception: [incorrect thinking]\n- ✅ Correct understanding: [right explanation]\n\n**Remember this:**\n\nA simple way to remember: [memory aid or trick]\n\n**Check your understanding:**\nTry this: If [scenario], what would happen? Take a guess, then I'll explain!`,
  ],
  exam_strategy: [
    `Exam strategy time! 📋\n\n**Based on the latest patterns, here's what matters:**\n\n**High Weightage Topics (focus here first):**\n- Topic A — ~15% of paper\n- Topic B — ~12% of paper\n- Topic C — ~10% of paper\n\n**Time Management Strategy:**\n\n| Phase | Duration | Action |\n|-------|----------|--------|\n| First pass | 45 min | Attempt easy Qs |\n| Second pass | 30 min | Tackle medium Qs |\n| Review | 15 min | Check marked Qs |\n\n**The #1 rule:** Never leave any question unattempted if there's no negative marking.\n\nWant a personalised study plan based on your weak areas?`,
  ],
  create_study_plan: [
    `Let me build you a structured study plan! 📅\n\n**Recommended Schedule:**\n\n**Morning Block (6–8 AM):** Strong subjects — build momentum\n**Main Study Block (9 AM–1 PM):** Weak subjects — peak focus hours\n**Revision Block (4–6 PM):** Previous day's topics\n**Problem Practice (7–9 PM):** Mixed questions\n\n**Weekly Structure:**\n- Mon–Fri: New topics\n- Saturday: Full mock test\n- Sunday: Analysis + weak area revision\n\n**Key Principle:** Quality > Quantity. 6 focused hours beat 10 distracted hours.\n\nWant me to customise this for your specific exam and timeline?`,
  ],
  motivation: [
    `I hear you — this is tough. But you're stronger than you think. 💪\n\n**Here's what the data says about students like you:**\n\n> Students who push through their hardest phase (usually months 3–4 of preparation) are 3x more likely to hit their target score.\n\n**Your current struggle is normal.** Every JEE/NEET topper has felt exactly what you're feeling right now.\n\n**Small action to take RIGHT NOW:**\n\nOpen one chapter. Read for just 15 minutes. Don't worry about anything else.\n\n*"You don't have to be great to start, but you have to start to be great."*\n\nI'm here whenever you need a push. What's the one topic you've been avoiding? Let's tackle it together. 🎯`,
  ],
  generate_questions: [
    `Question bank generated! 📝\n\n**Easy (1 mark each):**\n1. [Conceptual MCQ]\n2. [Definition-based]\n3. [True/False with reason]\n\n**Medium (2 marks each):**\n4. [Application problem]\n5. [Assertion-Reason]\n6. [Match the column]\n\n**Hard (4 marks each):**\n7. [Multi-step numerical]\n8. [Paragraph-based MCQ set]\n\n**Difficulty:** Mixed | **Estimated Time:** 45 minutes\n\nShall I also generate detailed answer keys with explanations?`,
  ],
  analytics_query: [
    `📊 **Analytics Summary**\n\n**Active Users (Last 7 Days):** 2,847 (+12%)\n**Avg Session Duration:** 23 min\n**Questions Solved:** 14,523\n**Completion Rate:** 78%\n\n**Top Performing Subjects:**\n| Subject | Engagement | Avg Score |\n|---------|------------|----------|\n| Math | 89% | 72/100 |\n| Physics | 76% | 65/100 |\n| Chemistry | 71% | 68/100 |\n\n**Key Insight:** Peak activity is 7–9 PM. Consider scheduling live sessions in this window.\n\nWant a detailed cohort analysis or performance prediction?`,
  ],
  general: [
    `I'm here to help! 🤝 Could you give me a bit more context about what you're working on?\n\nI can help with:\n- **Solving problems** (Math, Physics, Chemistry, Biology)\n- **Explaining concepts** in depth\n- **Exam strategy** and preparation tips\n- **Study plans** customised to your timeline\n- **Practice questions** on any topic\n\nOr just share what's on your mind — I'll figure out the best way to help! 😊`,
  ],
};

function getMockResponse(intent: string, agent: AgentType): string {
  const intentResponses = MOCK_RESPONSES[intent] || MOCK_RESPONSES.general;
  const agentOverrides: Partial<Record<AgentType, string>> = {
    oracle: MOCK_RESPONSES.analytics_query[0],
    scout: `📊 **Market Intelligence Report**\n\nBased on current EdTech landscape analysis:\n\n**Opportunity:** Vernacular content gap in competitive exam prep (only 23% coverage)\n**Competitor weakness:** No adaptive AI tutoring in regional languages\n**Recommendation:** Focus on Hindi + Tamil markets for next 6 months\n\nWant a detailed competitor analysis?`,
    herald: `✍️ **Marketing Content Ready**\n\n**Blog Post Draft:**\n\n# 5 AI-Powered Study Hacks Toppers Use\n\nHook: What if your study time could be 3x more effective?\n\n**SEO Keywords:** AI study tips, JEE preparation 2026, smart studying\n\nShall I write the full post or create social media versions?`,
    forge: `⚙️ **System Status**\n\n✅ All services operational\n- API Gateway: 45ms latency\n- LLM Services: 3/3 providers active\n- Database: 12ms read latency\n\n⚠️ **Advisory:** Main bundle 797KB — consider additional code splitting\n\nReady to run any maintenance tasks?`,
  };

  return agentOverrides[agent] || intentResponses[Math.floor(Math.random() * intentResponses.length)];
}

// ─── Intent Badge ──────────────────────────────────────────────────────────────

function IntentBadge({ intent, confidence, targetAgent }: IntentResult) {
  const intentLabels: Record<string, string> = {
    solve_math: '🧮 Solving Math',
    solve_physics: '⚡ Physics Problem',
    solve_chemistry: '🧪 Chemistry',
    solve_biology: '🧬 Biology',
    explain_concept: '💡 Explaining Concept',
    analyze_image: '📸 Analysing Image',
    check_handwriting: '✍️ Checking Work',
    analyze_diagram: '📊 Reading Diagram',
    exam_strategy: '📋 Exam Strategy',
    doubt_clearing: '🤔 Clearing Doubt',
    quick_reference: '⚡ Quick Reference',
    create_study_plan: '📅 Study Plan',
    generate_questions: '📝 Generating Questions',
    generate_content: '✍️ Creating Content',
    analytics_query: '📊 Analytics',
    market_research: '🔍 Market Research',
    system_status: '⚙️ System Status',
    student_progress: '👥 Student Progress',
    motivation: '💪 Motivation',
    general: '💬 Conversation',
  };

  const agent = agentOptions.find(a => a.id === targetAgent);
  const label = intentLabels[intent] || intent;

  return (
    <div className="flex items-center gap-2 mb-2 flex-wrap">
      <span className="text-xs px-2 py-0.5 bg-accent-500/10 text-accent-400 border border-accent-500/20 rounded-full flex items-center gap-1">
        <Brain className="w-3 h-3" /> {label}
      </span>
      <span className="text-xs text-surface-600">
        {Math.round(confidence * 100)}% confidence
      </span>
      {agent && (
        <span className="text-xs px-2 py-0.5 bg-primary-500/10 text-primary-400 border border-primary-500/20 rounded-full">
          → {agent.emoji} {agent.name}
        </span>
      )}
    </div>
  );
}

// ─── Message Bubble ───────────────────────────────────────────────────────────

function MessageBubble({
  message,
  onCopy,
  isExpanded,
  onToggleExpand,
  userRole,
}: {
  message: Message;
  onCopy: () => void;
  isExpanded: boolean;
  onToggleExpand: () => void;
  userRole: string;
}) {
  const [copied, setCopied] = useState(false);
  const isUser = message.role === 'user';
  const agent = agentOptions.find(a => a.id === message.agent);
  const COLLAPSE_THRESHOLD = 600;
  const PREVIEW_LENGTH = 300;
  const shouldCollapse = !isUser && userRole === 'student' && message.content.length > COLLAPSE_THRESHOLD;

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content);
    setCopied(true);
    onCopy();
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={clsx('flex gap-3', isUser && 'flex-row-reverse')}
    >
      {/* Avatar */}
      <div className={clsx(
        'w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-1',
        isUser ? 'bg-gradient-to-br from-primary-400 to-accent-400' : 'bg-surface-800'
      )}>
        {isUser ? <User className="w-4 h-4 text-white" /> : <span className="text-lg">{agent?.emoji || '🤖'}</span>}
      </div>

      {/* Bubble */}
      <div className={clsx('max-w-[75%] group', isUser && 'items-end flex flex-col')}>
        {/* Intent badge (AI messages only) */}
        {!isUser && message.intent && message.intent.intent !== 'general' && (
          <IntentBadge {...message.intent} />
        )}

        {/* User attachments */}
        {isUser && message.attachments && message.attachments.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-2 justify-end">
            {message.attachments.map(att => (
              <div key={att.id} className="max-w-xs">
                {att.type === 'image' || att.type === 'drawing' ? (
                  <img src={att.url} alt={att.name} className="rounded-xl max-h-48 object-contain border border-surface-700" />
                ) : att.type === 'audio' ? (
                  <div className="px-3 py-2 bg-green-500/10 border border-green-500/20 rounded-xl text-xs text-green-400 flex items-center gap-2">
                    <Mic className="w-3 h-3" />
                    {att.transcript || att.name}
                  </div>
                ) : (
                  <div className="px-3 py-2 bg-surface-800 border border-surface-700 rounded-xl text-xs text-surface-400 flex items-center gap-2">
                    <FileText className="w-3 h-3" /> {att.name}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Message content */}
        {message.content && (
          <div className={clsx(
            'rounded-2xl px-4 py-3',
            isUser
              ? 'bg-primary-600 text-white rounded-br-md'
              : 'bg-surface-800 text-white rounded-bl-md'
          )}>
            {isUser ? (
              <p className="text-sm leading-relaxed">{message.content}</p>
            ) : shouldCollapse && !isExpanded ? (
              <>
                <p className="text-sm leading-relaxed">{message.content.slice(0, PREVIEW_LENGTH)}...</p>
                <button
                  onClick={onToggleExpand}
                  className="mt-2 text-xs font-semibold text-primary-400 hover:text-primary-300 transition-colors"
                >
                  Show full answer ↓
                </button>
              </>
            ) : (
              <>
                <OutputBlockRenderer
                  blocks={message.outputBlocks || []}
                  fallback={message.content}
                />
                {shouldCollapse && isExpanded && (
                  <button
                    onClick={onToggleExpand}
                    className="mt-2 text-xs font-semibold text-primary-400 hover:text-primary-300 transition-colors"
                  >
                    Show less ↑
                  </button>
                )}
              </>
            )}
          </div>
        )}

        {/* AI message footer */}
        {!isUser && (
          <div className="flex items-center gap-2 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button onClick={handleCopy} className="flex items-center gap-1 text-xs text-surface-500 hover:text-white transition-colors">
              {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
              {copied ? 'Copied' : 'Copy'}
            </button>
            {message.metadata?.processingMs && (
              <span className="text-xs text-surface-600">{message.metadata.processingMs}ms</span>
            )}
          </div>
        )}

        <p className="text-xs text-surface-600 mt-1">
          {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </p>
      </div>
    </motion.div>
  );
}

// ─── Voice Button ─────────────────────────────────────────────────────────────

function VoiceButton({ onTranscript }: { onTranscript: (text: string) => void }) {
  const { state, startListening, stopListening, error, isSupported } = useVoiceInput(onTranscript);

  if (!isSupported) return null;

  return (
    <div className="relative">
      <button
        onClick={state === 'listening' ? stopListening : startListening}
        title={state === 'listening' ? 'Stop recording' : 'Voice input'}
        className={clsx(
          'p-2 rounded-lg transition-all',
          state === 'listening'
            ? 'bg-red-500 text-white animate-pulse'
            : state === 'error'
              ? 'bg-red-500/10 text-red-400'
              : 'hover:bg-surface-800 text-surface-400 hover:text-white'
        )}
      >
        {state === 'listening' ? <StopCircle className="w-5 h-5" /> : state === 'processing' ? <Mic className="w-5 h-5 text-yellow-400" /> : <Mic className="w-5 h-5" />}
      </button>
      {error && (
        <div className="absolute bottom-full right-0 mb-1 w-48 text-xs text-red-400 bg-surface-900 border border-red-500/30 rounded-lg px-2 py-1">
          {error}
        </div>
      )}
    </div>
  );
}

// ─── Suggestions ─────────────────────────────────────────────────────────────

const SUGGESTIONS_BY_AGENT: Record<AgentType, string[]> = {
  sage: [
    'Explain Newton\'s second law with examples',
    'Solve: x² - 5x + 6 = 0',
    'What is the difference between mitosis and meiosis?',
    'Help me understand electromagnetic induction',
  ],
  atlas: [
    'Generate 5 MCQs on organic chemistry reactions',
    'Create a lesson plan for quadratic equations',
    'Make a question bank for NEET Biology Chapter 5',
    'Write study notes on Chemical Bonding',
  ],
  mentor: [
    'Create a 3-month JEE study plan',
    'I\'m feeling demotivated — help me get back on track',
    'Which students need attention this week?',
    'Set up daily reminders for revision',
  ],
  oracle: [
    'Show me student engagement metrics this week',
    'Which topics have the highest drop-off rate?',
    'Give me a revenue report for this month',
    'Predict next month\'s active user count',
  ],
  scout: [
    'Analyse the top 5 EdTech competitors',
    'What\'s trending in competitive exam prep?',
    'Find market opportunities in vernacular education',
    'Research UPSC coaching market size',
  ],
  herald: [
    'Write a blog post on JEE preparation strategies',
    'Create social media content for NEET launch',
    'Draft an email campaign for new student signup',
    'Generate SEO-optimised FAQ content',
  ],
  forge: [
    'Check system health and API status',
    'Deploy the latest build to production',
    'Analyse error logs from the last 24 hours',
    'Optimise database query performance',
  ],
  nexus: [
    'Show me all at-risk students for JEE Main',
    'Draft a churn rescue message for Kabir Verma',
    'Which tickets are about to breach SLA?',
    'Suggest resolution for TKT-00042',
  ],
};

// ─── Main Chat Component ──────────────────────────────────────────────────────

export function Chat() {
  const [searchParams] = useSearchParams();
  const { sessions, currentSessionId, isStreaming, createSession, setCurrentSession, deleteSession, addMessage, setStreaming, getCurrentSession } = useChatStore();
  const { addNotification, userRole } = useAppStore();

  const [selectedAgent, setSelectedAgent] = useState<AgentType>(
    (searchParams.get('agent') as AgentType) || 'sage'
  );
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  // studentContext injected into system context from URL params
  const studentContextParam = searchParams.get('studentContext');
  const studentContextMsg = studentContextParam
    ? `Context: You are helping teacher with ${studentContextParam} who is studying ${searchParams.get('exam') || 'their exam'} at ${searchParams.get('progress') || '?'}% progress. Issue: ${searchParams.get('issue') || 'general check-in'}`
    : null;
  const [showAgentPicker, setShowAgentPicker] = useState(false);
  const [expandedMessages, setExpandedMessages] = useState<Set<string>>(new Set());
  const [showModeSelector, setShowModeSelector] = useState(false);
  const [learningMode, setLearningMode] = useState<LearningMode>('deep_learning');
  const [showDrawingCanvas, setShowDrawingCanvas] = useState(false);
  const [attachments, setAttachments] = useState<MediaAttachment[]>([]);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [lastIntent, setLastIntent] = useState<IntentResult | null>(null);
  const [autoRoutedAgent, setAutoRoutedAgent] = useState<AgentType | null>(null);

  const inputRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const currentSession = getCurrentSession();

  // Auto-create session on mount; pre-fill ?q= and inject studentContext
  useEffect(() => {
    const q = searchParams.get('q');
    if (q) {
      setInput(decodeURIComponent(q));
      setTimeout(() => inputRef.current?.focus(), 100);
    }
    let sessionId = currentSessionId;
    if (!sessionId) {
      sessionId = createSession(selectedAgent, `Chat with ${agentOptions.find(a => a.id === selectedAgent)?.name}`);
    }
    // If teacher clicked a student, inject system context as first AI message
    if (studentContextMsg && sessionId) {
      addMessage(sessionId, {
        role: 'assistant',
        content: `📋 **${studentContextMsg}**\n\nHow can I help you with this student?`,
        agent: 'sage',
        outputBlocks: [],
      });
    }
  }, []);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [currentSession?.messages]);

  // ── Attachment handlers ──

  const addAttachment = useCallback((att: Omit<MediaAttachment, 'id'>) => {
    setAttachments(prev => [...prev, { ...att, id: Math.random().toString(36).slice(2) }]);
  }, []);

  const removeAttachment = useCallback((id: string) => {
    setAttachments(prev => prev.filter(a => a.id !== id));
  }, []);

  const handleImageFile = async (file: File) => {
    const url = URL.createObjectURL(file);
    addAttachment({
      type: 'image',
      name: file.name,
      url,
      mimeType: file.type,
      size: file.size,
      thumbnail: url,
    });
  };

  const handleFile = async (file: File) => {
    if (file.type.startsWith('image/')) {
      handleImageFile(file);
      return;
    }
    const url = URL.createObjectURL(file);
    addAttachment({ type: 'file', name: file.name, url, mimeType: file.type, size: file.size });
  };

  const handleDrawingSubmit = (dataUrl: string) => {
    addAttachment({
      type: 'drawing',
      name: 'Whiteboard drawing',
      url: dataUrl,
      mimeType: 'image/png',
      thumbnail: dataUrl,
    });
    setShowDrawingCanvas(false);
  };

  const handleVoiceTranscript = (transcript: string) => {
    setInput(prev => prev ? `${prev} ${transcript}` : transcript);
    inputRef.current?.focus();
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;
    for (const item of Array.from(items)) {
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) handleImageFile(file);
      }
    }
  };

  // ── Send message ──

  const handleSend = async () => {
    const userText = input.trim();
    if (!userText && attachments.length === 0) return;

    let sessionId = currentSessionId;
    if (!sessionId) {
      sessionId = createSession(selectedAgent, userText.slice(0, 40) || 'New Chat');
    }

    // Detect intent from text + attachments
    const intent = detectIntent(userText, attachments, selectedAgent);
    setLastIntent(intent);

    // Auto-route to best agent if confidence is high and different from current
    let activeAgent = selectedAgent;
    if (intent.confidence > 0.80 && intent.targetAgent !== selectedAgent) {
      setAutoRoutedAgent(intent.targetAgent);
      activeAgent = intent.targetAgent;
    } else {
      setAutoRoutedAgent(null);
    }

    // Add user message
    addMessage(sessionId, {
      role: 'user',
      content: userText,
      agent: activeAgent,
      attachments: attachments.length > 0 ? [...attachments] : undefined,
      intent,
    });

    setInput('');
    setAttachments([]);
    setIsTyping(true);
    setStreaming(true);

    const start = Date.now();

    // Build conversation history for context
    const history = currentSession?.messages.slice(-10).map(m => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    })) ?? [];

    // Try real LLM first, fall back to mock
    const tryRealLLM = async () => {
      const llmResponse = await callLLM({
        agent: activeAgent,
        message: userText,
        attachments: attachments.length > 0 ? attachments : undefined,
        intent: intent.intent as import('@/services/intentEngine').IntentCategory,
        mode: learningMode,
        conversationHistory: history,
      });
      return llmResponse;
    };

    const deliverResponse = (responseText: string, provider?: string) => {
      const outputBlocks = generateOutputBlocks(responseText, intent.intent);
      addMessage(sessionId!, {
        role: 'assistant',
        content: responseText,
        agent: activeAgent,
        outputBlocks,
        intent,
        metadata: {
          processingMs: Date.now() - start,
          confidence: intent.confidence,
          provider,
        },
      });
      setIsTyping(false);
      setStreaming(false);
    };

    if (isLLMConfigured()) {
      // Real LLM call
      tryRealLLM()
        .then(llmResponse => {
          if (llmResponse) {
            deliverResponse(llmResponse.text, llmResponse.provider);
          } else {
            // callLLM returned null (shouldn't happen when configured)
            deliverResponse(getMockResponse(intent.intent, activeAgent), 'mock');
          }
        })
        .catch(err => {
          console.error('[Chat] LLM error, falling back to mock:', err);
          addNotification({
            type: 'warning',
            title: 'AI service error',
            message: `Falling back to demo response. (${(err as Error).message})`,
          });
          deliverResponse(getMockResponse(intent.intent, activeAgent), 'mock-fallback');
        });
    } else {
      // No API key configured — use mock with realistic delay
      const responseDelay = 800 + Math.random() * 1200;
      setTimeout(() => {
        deliverResponse(getMockResponse(intent.intent, activeAgent), 'mock');
      }, responseDelay);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleNewChat = (agent?: AgentType) => {
    const a = agent || selectedAgent;
    createSession(a, `Chat with ${agentOptions.find(ag => ag.id === a)?.name}`);
    setAttachments([]);
    setLastIntent(null);
    setAutoRoutedAgent(null);
  };

  const currentAgent = agentOptions.find(a => a.id === selectedAgent);
  const suggestions = SUGGESTIONS_BY_AGENT[selectedAgent] || SUGGESTIONS_BY_AGENT.sage;

  // Frugal mode: student & teacher see a clean single-tutor UI (no agent sidebar)
  const isSimpleMode = userRole === 'student' || userRole === 'teacher';
  // For simple mode, always route to sage (tutor) — teacher gets sage too but can ask anything
  const simpleAgent = userRole === 'teacher' ? agentOptions.find(a => a.id === 'sage') : agentOptions.find(a => a.id === 'sage');
  const displayAgent = isSimpleMode ? simpleAgent : currentAgent;
  const displaySuggestions = isSimpleMode
    ? (userRole === 'teacher'
        ? ['Create a quiz on quadratic equations', 'Which students are struggling?', 'Generate a lesson plan', 'Explain photosynthesis simply']
        : SUGGESTIONS_BY_AGENT.sage)
    : suggestions;

  return (
    <div className="h-[calc(100vh-7rem)] md:h-[calc(100vh-7rem)] h-[calc(100dvh-7.5rem)] flex gap-5">
      {/* Hidden file inputs */}
      <input ref={fileInputRef} type="file" className="hidden" onChange={e => { if (e.target.files?.[0]) handleFile(e.target.files[0]); e.target.value = ''; }} />
      <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={e => { if (e.target.files?.[0]) handleImageFile(e.target.files[0]); e.target.value = ''; }} />

      {/* Drawing canvas */}
      {showDrawingCanvas && <DrawingCanvas onSubmit={handleDrawingSubmit} onClose={() => setShowDrawingCanvas(false)} />}

      {/* ── Session sidebar (CEO/Admin only) ── */}
      {!isSimpleMode && (
        <div className="w-60 flex-shrink-0 glass rounded-xl p-3 flex flex-col">
          <button onClick={() => handleNewChat()} className="w-full btn-primary flex items-center justify-center gap-2 mb-3 py-2 rounded-lg text-sm">
            <Plus className="w-4 h-4" /> New Chat
          </button>
          <div className="flex-1 overflow-y-auto space-y-1 mb-3">
            {sessions.length === 0 && (
              <p className="text-xs text-surface-600 text-center py-4">No chats yet</p>
            )}
            {sessions.map(session => {
              const agent = agentOptions.find(a => a.id === session.agent);
              return (
                <div key={session.id} onClick={() => setCurrentSession(session.id)}
                  className={clsx('p-2.5 rounded-lg cursor-pointer transition-colors group',
                    currentSessionId === session.id ? 'bg-primary-500/20 border border-primary-500/30' : 'hover:bg-surface-800'
                  )}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-base">{agent?.emoji}</span>
                      <span className="truncate text-xs font-medium text-surface-300">{session.title}</span>
                    </div>
                    <button onClick={e => { e.stopPropagation(); deleteSession(session.id); }}
                      className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-500/20 rounded transition-all flex-shrink-0">
                      <Trash2 className="w-3 h-3 text-red-400" />
                    </button>
                  </div>
                  <p className="text-xs text-surface-600 mt-0.5">{session.messages.length} messages</p>
                </div>
              );
            })}
          </div>
          <div className="border-t border-surface-700/50 pt-3">
            <p className="text-xs text-surface-600 mb-2 px-1">Switch Agent</p>
            <div className="space-y-0.5">
              {agentOptions.map(agent => (
                <button key={agent.id} onClick={() => { setSelectedAgent(agent.id); handleNewChat(agent.id); }}
                  className={clsx('w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs transition-colors',
                    selectedAgent === agent.id ? 'bg-primary-500/20 text-primary-400' : 'hover:bg-surface-800 text-surface-400')}>
                  <span>{agent.emoji}</span>
                  <span className="font-medium">{agent.name}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Main Chat ── */}
      <div className="flex-1 glass rounded-xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-4 py-3 border-b border-surface-700/50 flex items-center justify-between">
          {/* Simple mode: clean tutor header, no picker */}
          {isSimpleMode ? (
            <div className="flex items-center gap-3 flex-wrap">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-lg flex-shrink-0">
                🎓
              </div>
              <div>
                <p className="font-semibold text-sm">{userRole === 'teacher' ? 'AI Assistant' : 'Your Tutor'}</p>
                <p className="text-xs text-surface-400">{userRole === 'teacher' ? 'Ask anything about your class' : 'Ask any question, snap a photo, or draw your problem'}</p>
              </div>
              {/* New chat button for simple mode */}
              <button onClick={() => handleNewChat('sage')}
                className="ml-4 p-2 rounded-lg hover:bg-surface-800 transition-colors text-surface-400 hover:text-white"
                title="New chat">
                <Plus className="w-4 h-4" />
              </button>
              {/* ── Smart Memory Chip ── */}
              {userRole === 'student' && <SmartMemoryChip />}
            </div>
          ) : (
          <div className="relative">
            <button onClick={() => setShowAgentPicker(!showAgentPicker)}
              className="flex items-center gap-3 p-2 rounded-lg hover:bg-surface-800 transition-colors">
              <div className={clsx('w-9 h-9 rounded-xl bg-gradient-to-br flex items-center justify-center text-lg', currentAgent?.color || 'from-primary-500 to-accent-500')}>
                {currentAgent?.emoji}
              </div>
              <div className="text-left">
                <p className="font-medium text-sm">{currentAgent?.name}</p>
                <p className="text-xs text-surface-400">{currentAgent?.description}</p>
              </div>
              <ChevronDown className="w-4 h-4 text-surface-400" />
            </button>

            <AnimatePresence>
              {showAgentPicker && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowAgentPicker(false)} />
                  <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}
                    className="absolute top-full left-0 mt-1 w-72 glass rounded-xl shadow-xl z-50 p-2">
                    {agentOptions.map(agent => (
                      <button key={agent.id} onClick={() => { setSelectedAgent(agent.id); setShowAgentPicker(false); handleNewChat(agent.id); }}
                        className={clsx('w-full flex items-center gap-3 p-2.5 rounded-lg transition-colors text-left',
                          selectedAgent === agent.id ? 'bg-primary-500/20' : 'hover:bg-surface-800')}>
                        <div className={clsx('w-9 h-9 rounded-xl bg-gradient-to-br flex items-center justify-center text-lg', agent.color)}>
                          {agent.emoji}
                        </div>
                        <div>
                          <p className="font-medium text-sm">{agent.name}</p>
                          <p className="text-xs text-surface-400">{agent.description}</p>
                        </div>
                      </button>
                    ))}
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
          )}

          <div className="flex items-center gap-2">
            {/* LLM Provider indicator */}
            <div className={`flex items-center gap-1 text-xs px-2 py-1 rounded-full ${isLLMConfigured() ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-surface-700/50 text-surface-500 border border-surface-600/30'}`}>
              <div className={`w-1.5 h-1.5 rounded-full ${isLLMConfigured() ? 'bg-green-400 animate-pulse' : 'bg-surface-500'}`} />
              {isLLMConfigured() ? getActiveProvider() : 'demo'}
            </div>

            {/* Auto-routed indicator */}
            {autoRoutedAgent && autoRoutedAgent !== selectedAgent && (
              <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                className="flex items-center gap-1 text-xs px-2 py-1 bg-accent-500/10 text-accent-400 border border-accent-500/20 rounded-full">
                <Zap className="w-3 h-3" />
                Auto-routed to {agentOptions.find(a => a.id === autoRoutedAgent)?.name}
              </motion.div>
            )}

            {selectedAgent === 'sage' && (
              <div className="relative">
                <button onClick={() => setShowModeSelector(!showModeSelector)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-surface-800 hover:bg-surface-700 rounded-lg transition-colors text-xs">
                  <Settings2 className="w-3.5 h-3.5 text-surface-400" />
                  <span className="text-surface-300">Mode</span>
                </button>
                <AnimatePresence>
                  {showModeSelector && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setShowModeSelector(false)} />
                      <motion.div initial={{ opacity: 0, y: 8, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 8, scale: 0.95 }}
                        className="absolute top-full right-0 mt-1 w-80 glass rounded-xl shadow-xl z-50 p-4">
                        <LearningModeSelector currentMode={learningMode}
                          onModeChange={mode => { setLearningMode(mode); setShowModeSelector(false); }} compact={false} />
                      </motion.div>
                    </>
                  )}
                </AnimatePresence>
              </div>
            )}
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5" onPaste={handlePaste}>
          {!currentSession || currentSession.messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center px-4">
              <div className={clsx('w-20 h-20 rounded-2xl bg-gradient-to-br flex items-center justify-center text-4xl mb-4', displayAgent?.color || 'from-primary-500 to-accent-500')}>
                {displayAgent?.emoji || '🎓'}
              </div>
              {isSimpleMode ? (
                <>
                  <h2 className="text-xl font-semibold mb-1">
                    {userRole === 'teacher' ? 'Your AI Teaching Assistant' : 'What would you like to learn today?'}
                  </h2>
                  <p className="text-surface-400 text-sm max-w-md mb-6">
                    {userRole === 'teacher'
                      ? 'Ask about your students, get lesson plans, generate questions'
                      : 'Ask any question. Type it, say it, or snap a photo of your problem.'}
                  </p>
                </>
              ) : (
                <>
                  <h2 className="text-xl font-semibold mb-1">Chat with {displayAgent?.name}</h2>
                  <p className="text-surface-400 text-sm max-w-md mb-2">{displayAgent?.description}</p>
                  {/* Multimodal hints (CEO/Admin) */}
                  <div className="flex flex-wrap items-center justify-center gap-2 mb-6 text-xs text-surface-500">
                    <span className="flex items-center gap-1 px-2 py-1 bg-surface-800/50 rounded-full"><ImageIcon className="w-3 h-3" /> Images</span>
                    <span className="flex items-center gap-1 px-2 py-1 bg-surface-800/50 rounded-full"><Mic className="w-3 h-3" /> Voice</span>
                    <span className="flex items-center gap-1 px-2 py-1 bg-surface-800/50 rounded-full"><PenTool className="w-3 h-3" /> Draw</span>
                    <span className="flex items-center gap-1 px-2 py-1 bg-surface-800/50 rounded-full"><FileText className="w-3 h-3" /> Files</span>
                    <span className="flex items-center gap-1 px-2 py-1 bg-surface-800/50 rounded-full"><Zap className="w-3 h-3 text-accent-400" /> Auto-routing</span>
                  </div>
                </>
              )}

              <div className="grid grid-cols-2 gap-2 max-w-lg">
                {displaySuggestions.map((suggestion, i) => (
                  <button key={i} onClick={() => { setInput(suggestion); inputRef.current?.focus(); }}
                    className="p-3 rounded-xl bg-surface-800/50 hover:bg-surface-800 text-left text-xs transition-colors group">
                    <Sparkles className="w-3.5 h-3.5 text-accent-400 mb-1.5" />
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <>
              {currentSession.messages.map(message => (
                <MessageBubble
                  key={message.id}
                  message={message}
                  onCopy={() => addNotification({ type: 'success', title: 'Copied', message: 'Message copied to clipboard' })}
                  isExpanded={expandedMessages.has(message.id)}
                  onToggleExpand={() => setExpandedMessages(prev => {
                    const n = new Set(prev);
                    n.has(message.id) ? n.delete(message.id) : n.add(message.id);
                    return n;
                  })}
                  userRole={userRole}
                />
              ))}

              {isTyping && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-3">
                  <div className={clsx('w-8 h-8 rounded-full bg-gradient-to-br flex items-center justify-center text-lg', currentAgent?.color || 'from-primary-500 to-accent-500')}>
                    {currentAgent?.emoji}
                  </div>
                  <div className="bg-surface-800 rounded-2xl rounded-bl-md px-4 py-3">
                    <div className="flex gap-1.5 items-center">
                      {[0, 150, 300].map(delay => (
                        <span key={delay} className="w-2 h-2 bg-surface-500 rounded-full animate-bounce" style={{ animationDelay: `${delay}ms` }} />
                      ))}
                      {lastIntent && lastIntent.intent !== 'general' && (
                        <span className="ml-2 text-xs text-surface-600 flex items-center gap-1">
                          <Brain className="w-3 h-3" /> {lastIntent.intent.replace(/_/g, ' ')}...
                        </span>
                      )}
                    </div>
                  </div>
                </motion.div>
              )}
              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        {/* Attachment previews */}
        <AttachmentPreview attachments={attachments} onRemove={removeAttachment} />

        {/* Input area — extra bottom padding on mobile for thumb zone */}
        <div className="p-3 pb-3 md:pb-3 border-t border-surface-700/50">
          <div className="flex items-end gap-2">
            {/* Attach menu */}
            <div className="relative">
              <button onClick={() => setShowAttachMenu(!showAttachMenu)}
                className="p-2 hover:bg-surface-800 rounded-lg transition-colors text-surface-400 hover:text-white">
                <Paperclip className="w-5 h-5" />
              </button>
              <AnimatePresence>
                {showAttachMenu && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowAttachMenu(false)} />
                    <motion.div initial={{ opacity: 0, y: 8, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 8, scale: 0.95 }}
                      className="absolute bottom-full left-0 mb-2 w-44 glass rounded-xl shadow-xl z-50 p-2">
                      <button onClick={() => { imageInputRef.current?.click(); setShowAttachMenu(false); }}
                        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-surface-800 text-sm text-surface-300 transition-colors">
                        <ImageIcon className="w-4 h-4 text-blue-400" /> Upload Image
                      </button>
                      <button onClick={() => { setShowDrawingCanvas(true); setShowAttachMenu(false); }}
                        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-surface-800 text-sm text-surface-300 transition-colors">
                        <PenTool className="w-4 h-4 text-purple-400" /> Draw / Whiteboard
                      </button>
                      <button onClick={() => { fileInputRef.current?.click(); setShowAttachMenu(false); }}
                        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-surface-800 text-sm text-surface-300 transition-colors">
                        <FileText className="w-4 h-4 text-yellow-400" /> Upload File
                      </button>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>

            {/* Text input */}
            <div className="flex-1 relative">
              <textarea
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                onPaste={handlePaste}
                placeholder={attachments.length > 0
                  ? `Ask about your attachment... (or press Enter to send)`
                  : isSimpleMode
                    ? (userRole === 'teacher' ? 'Ask anything about your students or lessons...' : 'Ask anything — type, paste an image, or draw your problem')
                    : `Ask ${displayAgent?.name} anything... (paste images, type equations)`}
                rows={1}
                className="input resize-none pr-3 text-sm"
                style={{ minHeight: '42px', maxHeight: '120px' }}
              />
            </div>

            {/* Voice */}
            <VoiceButton onTranscript={handleVoiceTranscript} />

            {/* Send */}
            <button onClick={handleSend} disabled={(!input.trim() && attachments.length === 0) || isStreaming}
              className={clsx('p-2.5 rounded-xl transition-all',
                (input.trim() || attachments.length > 0) ? 'bg-primary-500 hover:bg-primary-400 text-white' : 'bg-surface-800 text-surface-500')}>
              <Send className="w-5 h-5" />
            </button>
          </div>

          <p className="text-xs text-surface-600 text-center mt-2">
            {isSimpleMode
              ? 'AI can make mistakes — always verify important answers with your textbook.'
              : (<>{displayAgent?.name} can make mistakes — verify important answers.
                  <span className="ml-2 text-accent-500 flex-inline items-center gap-0.5">
                    <Eye className="w-3 h-3 inline mr-0.5" />Intent detection active
                  </span></>)}
          </p>
        </div>
      </div>
    </div>
  );
}

export default Chat;
