/**
 * Chat — Multimodal AI Interface
 * Supports: text, image upload, voice input, file upload, drawing/whiteboard
 * Intent detection auto-routes to the best agent
 * Output: rich markdown, equations, step-by-step cards, tables, image analysis
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
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
import { ManimViz } from '@/components/chat/ManimViz';
import { ManimToggle } from '@/components/chat/ManimToggle';
import { NextConceptCard } from '@/components/chat/NextConceptCard';
import { MasteryBadge } from '@/components/chat/MasteryBadge';
import { MobileChatUI, useIsMobile } from '@/components/chat/MobileChatUI';
import { TopperTipChip } from '@/components/chat/TopperInsightCard';
import { shouldRenderWithManim, extractPrimaryLatex } from '@/services/manimService';
import { buildLensContext, type LensContext } from '@/services/lensEngine';
import { recordSageInteraction } from '@/services/signalBus';
import { saveStudentProfile } from '@/services/persistenceDB';
import { createBehavioralTracker, type BehavioralTracker } from '@/services/behavioralSignals';
import { getDueTopics } from '@/services/spacedRepetition';
import { LearningModeSelector } from '@/components/tutor/LearningModeSelector';
import { SmartMemoryChip } from '@/components/ux/UXEnhancements';
import { detectIntent, generateOutputBlocks } from '@/services/intentEngine';
import { callLLM, isLLMConfigured, getActiveProvider } from '@/services/llmService';
import { loadPersona, updatePersonaAfterMessage } from '@/services/studentPersonaEngine';
import { buildSageSystemPrompt, getSageOpener, buildGateRagPrompt, shouldUseRag, buildCatRagPrompt, shouldUseCatRag } from '@/services/sagePersonaPrompts';
import { getCohortSignals } from '@/services/networkEffectsEngine';
import {
  createRootTrace,
  addNode,
  storeTrace,
  loadTrace,
} from '@/services/traceabilityEngine';
import type { TraceTree } from '@/services/traceabilityEngine';
import type { StudentPersona } from '@/services/studentPersonaEngine';
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
  dismissedCards,
  onDismissCard,
  newlyMastered,
  onDismissMastery,
  isLastMessage,
}: {
  message: Message;
  onCopy: () => void;
  isExpanded: boolean;
  onToggleExpand: () => void;
  userRole: string;
  dismissedCards?: Set<string>;
  onDismissCard?: (id: string) => void;
  newlyMastered?: { topicId: string; score: number } | null;
  onDismissMastery?: () => void;
  isLastMessage?: boolean;
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
      className={clsx('flex gap-3', isUser ? 'flex-row-reverse' : 'flex-row')}
    >
      {/* ── USER bubble: gradient pill, no avatar ── */}
      {isUser ? (
        <div className="max-w-[75%] flex flex-col items-end group">
          {/* User attachments */}
          {message.attachments && message.attachments.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-2 justify-end">
              {message.attachments.map(att => (
                <div key={att.id} className="max-w-xs">
                  {att.type === 'image' || att.type === 'drawing' ? (
                    <img src={att.url} alt={att.name} className="rounded-xl max-h-48 object-contain border border-surface-700" />
                  ) : att.type === 'audio' ? (
                    <div className="px-3 py-2 bg-green-500/10 border border-green-500/20 rounded-xl text-xs text-green-400 flex items-center gap-2">
                      <Mic className="w-3 h-3" />{att.transcript || att.name}
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
          {message.content && (
            <div className="bg-gradient-to-r from-primary-600 to-primary-500 text-white rounded-2xl rounded-br-sm px-4 py-3 shadow-md shadow-primary-900/20">
              <p className="text-sm md:text-[15px] leading-relaxed md:leading-[1.75]">{message.content}</p>
            </div>
          )}
          <p className="text-[11px] md:text-[10px] text-surface-600 mt-1 mr-1">
            {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>
      ) : (
        /* ── ASSISTANT bubble: book-page style, no bg, agent avatar ── */
        <>
          {/* Agent avatar */}
          <div className="flex-shrink-0 mt-1">
            <div className={clsx(
              'w-9 h-9 rounded-full flex items-center justify-center text-lg shadow-md',
              agent?.id === 'sage'   ? 'bg-gradient-to-br from-amber-500 to-yellow-400' :
              agent?.id === 'scout'  ? 'bg-gradient-to-br from-blue-500 to-cyan-400' :
              agent?.id === 'atlas'  ? 'bg-gradient-to-br from-green-500 to-emerald-400' :
              agent?.id === 'mentor' ? 'bg-gradient-to-br from-purple-500 to-violet-400' :
              agent?.id === 'oracle' ? 'bg-gradient-to-br from-orange-500 to-amber-400' :
              agent?.id === 'herald' ? 'bg-gradient-to-br from-indigo-500 to-purple-400' :
                                       'bg-gradient-to-br from-surface-600 to-surface-500'
            )}>
              <span>{agent?.emoji || '🤖'}</span>
            </div>
          </div>

          {/* Content area — no bubble background */}
          <div className="flex-1 max-w-[80%] group">
            {/* Agent name badge */}
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-xs font-semibold text-surface-300">{agent?.name || 'AI'}</span>
              <span className="text-[10px] text-surface-600">·</span>
              <span className="text-[10px] text-surface-600">
                {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>

            {/* Intent badge */}
            {message.intent && message.intent.intent !== 'general' && (
              <div className="mb-2">
                <IntentBadge {...message.intent} />
              </div>
            )}

            {/* Message text — directly on page (book-page feel) */}
            {message.content && (
              <div className="text-[15px] leading-[1.75] text-white/90 prose-mobile">
                {shouldCollapse && !isExpanded ? (
                  <>
                    <p>{message.content.slice(0, PREVIEW_LENGTH)}...</p>
                    <button onClick={onToggleExpand} className="mt-2 text-xs font-semibold text-primary-400 hover:text-primary-300 transition-colors">
                      Show full answer ↓
                    </button>
                  </>
                ) : (
                  <>
                    <OutputBlockRenderer blocks={message.outputBlocks || []} fallback={message.content} />
                    {shouldCollapse && isExpanded && (
                      <button onClick={onToggleExpand} className="mt-2 text-xs font-semibold text-primary-400 hover:text-primary-300 transition-colors">
                        Show less ↑
                      </button>
                    )}
                  </>
                )}
              </div>
            )}

            {/* Manim Visualisation */}
            {message.metadata?.manimTopic && (
              <ManimViz
                topic={message.metadata.manimTopic as string}
                latex={message.metadata.manimLatex as string | undefined}
                title={message.metadata.manimTitle as string | undefined}
                sessionId={message.id}
              />
            )}

            {/* Next Concept Card — shows weak-topic suggestion below last assistant message */}
            {message.metadata?.lensNextTopic && message.metadata?.lensExamRoute &&
             !dismissedCards?.has(message.id) && (
              <NextConceptCard
                suggestion={message.metadata.lensNextTopic}
                examRoute={message.metadata.lensExamRoute}
                onDismiss={() => onDismissCard?.(message.id)}
              />
            )}

            {/* Topper Insight Chips — strategy + trap for the detected topic */}
            {!isUser && message.metadata?.topperTopicId && message.metadata?.topperExamId && (
              <div className="mt-2 space-y-1.5">
                <TopperTipChip
                  examId={message.metadata.topperExamId}
                  topicId={message.metadata.topperTopicId}
                  variant="strategy"
                />
                <TopperTipChip
                  examId={message.metadata.topperExamId}
                  topicId={message.metadata.topperTopicId}
                  variant="trap"
                />
              </div>
            )}

            {/* Mastery celebration — fires once when concept is mastered */}
            {newlyMastered && isLastMessage && (
              <MasteryBadge
                topicName={newlyMastered.topicId.replace(/-/g, ' ')}
                masteryScore={newlyMastered.score}
                onDismiss={onDismissMastery}
              />
            )}

            {/* Action row — hover only */}
            <div className="flex items-center gap-3 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <button onClick={handleCopy} className="flex items-center gap-1 text-xs text-surface-500 hover:text-white transition-colors px-2 py-1 rounded-md hover:bg-surface-800/60">
                {copied ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
                {copied ? 'Copied' : 'Copy'}
              </button>
              <button className="flex items-center gap-1 text-xs text-surface-500 hover:text-green-400 transition-colors px-2 py-1 rounded-md hover:bg-surface-800/60">
                <Sparkles className="w-3 h-3" /> Good
              </button>
              <button className="flex items-center gap-1 text-xs text-surface-500 hover:text-red-400 transition-colors px-2 py-1 rounded-md hover:bg-surface-800/60">
                <RefreshCw className="w-3 h-3" /> Retry
              </button>
              {message.metadata?.processingMs && (
                <span className="text-[10px] text-surface-700 ml-auto">{message.metadata.processingMs}ms</span>
              )}
              {/* Trace badge — visible to CEO/admin */}
              {message.traceId && userRole !== 'student' && userRole !== 'teacher' && (
                <Link
                  to={`/trace/${message.traceId}`}
                  className="flex items-center gap-1 text-xs text-surface-600 hover:text-primary-400 transition-colors font-mono ml-auto"
                  title="View full trace"
                >
                  🔗 {message.traceId.slice(0, 8)}
                </Link>
              )}
              {/* Peer solidarity badge */}
              {message.role === 'assistant' && userRole === 'student' && message.metadata?.cohortPeers && (
                <span className="text-xs text-blue-400 bg-blue-900/20 border border-blue-500/20 px-2 py-0.5 rounded-full">
                  👥 {message.metadata.cohortPeers} peers studying this
                </span>
              )}
            </div>
          </div>
        </>
      )}
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
  prism: [
    'Show me the latest journey intelligence report',
    'Which user paths have the highest conversion?',
    'What content gaps need attention right now?',
    'Summarise intelligence packets for all agents',
  ],
};

// ── Contextual suggestions based on persona ───────────────────────────────────

function getContextualSuggestions(persona: StudentPersona): string[] {
  const base: string[] = [];

  if (persona.emotionalState === 'frustrated') {
    base.push(`I'm stuck and frustrated — can we start from scratch?`);
    base.push(`Explain this like I'm completely new to it`);
  } else if (persona.emotionalState === 'anxious') {
    base.push(`What should I focus on in the next ${persona.daysToExam} days?`);
    base.push(`Am I on track for my target?`);
  } else {
    if (persona.weakSubjects.length > 0) {
      base.push(`Help me with ${persona.weakSubjects[0]}`);
      if (persona.weakSubjects.length > 1) base.push(`Quick revision: ${persona.weakSubjects[1]}`);
    }
    if (persona.exam === 'JEE_MAIN' || persona.exam === 'JEE_ADVANCED') {
      base.push('Give me a tricky Physics MCQ to solve');
      base.push('Explain the most common Integration trick in JEE');
    } else if (persona.exam === 'NEET') {
      base.push('What are the highest-weightage Biology chapters?');
      base.push('Quick revision: Cell Division');
    } else if (persona.exam === 'CAT') {
      base.push('Give me a Data Interpretation set to solve');
      base.push('Shortcuts for Percentage problems');
    }
  }

  return base.slice(0, 4);
}

// ─── Main Chat Component ──────────────────────────────────────────────────────

export function Chat() {
  const [searchParams] = useSearchParams();
  const { sessions, currentSessionId, isStreaming, createSession, setCurrentSession, deleteSession, addMessage, setStreaming, getCurrentSession } = useChatStore();
  const { addNotification, userRole, manimEnabled, manimServiceUrl } = useAppStore();

  const [selectedAgent, setSelectedAgent] = useState<AgentType>(
    (searchParams.get('agent') as AgentType) || 'sage'
  );
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  // Student persona — loaded from localStorage, updated live during session
  const [persona, setPersona] = useState<StudentPersona>(() => loadPersona());
  // Lens context — personalization brain output for last response
  const [lensContext, setLensContext] = useState<LensContext | null>(null);
  // Dismissed next-concept cards (by message id)
  const [dismissedCards, setDismissedCards] = useState<Set<string>>(new Set());
  // Mastered topics to celebrate
  const [newlyMastered, setNewlyMastered] = useState<{topicId: string; score: number} | null>(null);
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

  // ── Traceability — session-level trace tree ──
  const [sessionTrace, setSessionTrace] = useState<TraceTree | null>(null);

  // ── UTM / entry params from URL ──
  const urlSource = searchParams.get('source');     // 'blog', 'blog_internal', 'practice'
  const urlSlug   = searchParams.get('slug');       // blog slug
  const urlTopic  = searchParams.get('topic');      // pre-filled topic
  const urlExam   = searchParams.get('exam');       // exam tag
  const utmSource   = searchParams.get('utm_source');
  const utmMedium   = searchParams.get('utm_medium');
  const utmCampaign = searchParams.get('utm_campaign');

  const inputRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  // ── Behavioral tracker — one instance per session ──
  const behavioralTrackerRef = useRef<BehavioralTracker>(createBehavioralTracker());

  // ── Spaced repetition: due topic count for indicator ──
  const [srDueCount, setSrDueCount] = useState(0);

  const currentSession = getCurrentSession();

  // Auto-create session on mount; pre-fill ?q= / ?topic= and inject studentContext
  useEffect(() => {
    const q = searchParams.get('q');
    if (q) {
      setInput(decodeURIComponent(q));
      setTimeout(() => inputRef.current?.focus(), 100);
    }
    // Pre-fill from blog topic param
    if (urlTopic && !q) {
      setInput(decodeURIComponent(urlTopic));
      setTimeout(() => inputRef.current?.focus(), 100);
    }

    // Derive entryPoint from source param
    const resolvedEntry = urlSource === 'blog'
      ? 'blog_cta'
      : urlSource === 'blog_internal'
        ? 'blog_internal'
        : urlSource === 'practice'
          ? 'practice'
          : 'chat_direct';

    // Collect UTM params
    const utmParams: Record<string, string> = {};
    if (utmSource) utmParams.utm_source = utmSource;
    if (utmMedium) utmParams.utm_medium = utmMedium;
    if (utmCampaign) utmParams.utm_campaign = utmCampaign;

    let sessionId = currentSessionId;
    if (!sessionId) {
      sessionId = createSession(
        selectedAgent,
        `Chat with ${agentOptions.find(a => a.id === selectedAgent)?.name}`,
        {
          entryPoint: resolvedEntry,
          referrerUrl: urlSlug ? `/website/blog/${urlSlug}` : document.referrer || undefined,
          utmParams: Object.keys(utmParams).length ? utmParams : undefined,
        },
      );
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

  // Load SR due count once on mount for the indicator
  useEffect(() => {
    const loadSRDue = async () => {
      try {
        const currentPersona = loadPersona();
        const isGate = currentPersona.exam?.toUpperCase().includes('GATE');
        const isCat = currentPersona.exam?.toUpperCase().includes('CAT') ||
          currentPersona.exam?.toUpperCase().includes('MBA');
        const examId = isGate ? 'gate-engineering-maths' : isCat ? 'cat' : 'jee-main';
        const due = await getDueTopics(currentPersona.studentId, examId, 20);
        setSrDueCount(due.length);
      } catch {
        // SR not available — graceful fallback, no indicator shown
      }
    };
    loadSRDue();
  }, []);

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

    // Record message send for behavioral tracking
    if (userText) {
      behavioralTrackerRef.current.recordMessageSent(userText);
      behavioralTrackerRef.current.recordStudentReply();
    }

    let sessionId = currentSessionId;
    if (!sessionId) {
      sessionId = createSession(selectedAgent, userText.slice(0, 40) || 'New Chat');
    }

    // Detect intent from text + attachments
    const intentStart = Date.now();
    const intent = detectIntent(userText, attachments, selectedAgent);
    const intentLatency = Date.now() - intentStart;
    setLastIntent(intent);

    // Auto-route to best agent if confidence is high and different from current
    let activeAgent = selectedAgent;
    if (intent.confidence > 0.80 && intent.targetAgent !== selectedAgent) {
      setAutoRoutedAgent(intent.targetAgent);
      activeAgent = intent.targetAgent;
    } else {
      setAutoRoutedAgent(null);
    }

    // ── Traceability: create or retrieve session trace tree ──
    const resolvedEntry = urlSource === 'blog'
      ? 'blog_cta'
      : urlSource === 'blog_internal'
        ? 'blog_internal'
        : urlSource === 'practice'
          ? 'practice'
          : 'chat_direct';

    let activeTrace = sessionTrace;
    if (!activeTrace) {
      const utmParams: Record<string, string> = {};
      if (utmSource) utmParams.utm_source = utmSource;
      if (utmMedium) utmParams.utm_medium = utmMedium;
      if (utmCampaign) utmParams.utm_campaign = utmCampaign;

      activeTrace = createRootTrace({
        sessionId: sessionId!,
        entryPoint: resolvedEntry as TraceTree['context']['entryPoint'],
        referrerUrl: urlSlug ? `/website/blog/${urlSlug}` : document.referrer || undefined,
        utmSource: utmSource ?? undefined,
        utmMedium: utmMedium ?? undefined,
        utmCampaign: utmCampaign ?? undefined,
        blogSlug: urlSlug ?? undefined,
        blogTopic: urlTopic ? decodeURIComponent(urlTopic) : undefined,
        examType: urlExam ?? undefined,
      });
      setSessionTrace(activeTrace);
    }

    // Add intent node
    const entryNode = activeTrace.nodes[0];
    addNode(activeTrace, {
      traceId: `${sessionId}-intent-${Date.now()}`,
      parentTraceId: entryNode?.traceId,
      nodeType: 'intent',
      action: intent.intent,
      inputSummary: userText.slice(0, 100),
      outputSummary: `→ ${intent.targetAgent} (confidence ${intent.confidence.toFixed(2)})`,
      latencyMs: intentLatency,
      timestamp: new Date().toISOString(),
    });

    const promptId = 'sage-adaptive-v1';
    const promptVersion = '1.0.0';

    // Add agent call node
    const agentNodeId = `${sessionId}-agent-${Date.now()}`;
    addNode(activeTrace, {
      traceId: agentNodeId,
      parentTraceId: entryNode?.traceId,
      nodeType: 'agent_call',
      agentId: activeAgent,
      promptId,
      promptVersion,
      action: `route:${activeAgent}`,
      inputSummary: userText.slice(0, 100),
      outputSummary: `agent selected; prompt=${promptId}@${promptVersion}`,
      timestamp: new Date().toISOString(),
    });

    // Add user message (with traceId)
    addMessage(sessionId, {
      role: 'user',
      content: userText,
      agent: activeAgent,
      attachments: attachments.length > 0 ? [...attachments] : undefined,
      intent,
      traceId: activeTrace.rootTraceId,
      entryPoint: resolvedEntry,
      sourceUrl: urlSlug ? `/website/blog/${urlSlug}` : undefined,
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

    // ── Student Persona: update emotion + build adaptive system prompt ──
    let sageSystemPrompt: string | undefined;
    // Hoist matchedSignal + detectedTopicId so deliverResponse can access them
    let matchedSignal: import('@/services/networkEffectsEngine').CohortSignal | undefined;
    let detectedTopicId: string | undefined;
    if (isStudent) {
      const updatedPersona = updatePersonaAfterMessage(persona, userText, 'neutral');
      setPersona(updatedPersona);

      // ── Persist persona to IndexedDB (cross-session memory) ──────────────
      saveStudentProfile(updatedPersona).catch(() => {}); // non-blocking

      // Wire 8 — Cohort aggregation: refresh cohort insights after every message
      try {
        const { aggregatePersonasToCohort, pushCohortInsights } = await import('@/services/personaContentBridge');
        const freshCohort = aggregatePersonasToCohort([updatedPersona]);
        pushCohortInsights(freshCohort);
      } catch { /* non-blocking */ }

      // Detect topic from message for network context injection
      const cohortSignals = getCohortSignals(updatedPersona.exam ?? 'JEE Main');
      matchedSignal = cohortSignals.find(s =>
        userText.toLowerCase().includes(s.topicName.toLowerCase().split(' ')[0])
      );
      detectedTopicId = matchedSignal?.topicId;

      // ── Build Lens Context (personalization brain) ────────────────────────
      const isGateExam = updatedPersona.exam?.toUpperCase().includes('GATE');
      const isCatExam = updatedPersona.exam?.toUpperCase().includes('CAT') ||
        updatedPersona.exam?.toUpperCase().includes('MBA');
      const examId = isGateExam ? 'gate-engineering-maths' : isCatExam ? 'cat' : 'jee-main';
      const hasPYQContext = (isGateExam && shouldUseRag(userText)) ||
        (isCatExam && shouldUseCatRag(userText));

      let activeLensCtx: LensContext | null = null;
      try {
        activeLensCtx = await buildLensContext({
          studentId: updatedPersona.studentId,
          topicId: detectedTopicId ?? 'general',
          examId,
          sessionId: sessionId ?? 'session-0',
          sessionMessageCount: history.length,
          hasPYQContext,
          behavioralSignals: behavioralTrackerRef.current.getSignals(),
        });
        setLensContext(activeLensCtx);
      } catch { /* non-blocking — fall back to legacy prompt */ }

      // ── Build system prompt (Lens-first, legacy fallback) ─────────────────
      if (activeLensCtx) {
        const { buildLensPrompt } = await import('@/services/sagePersonaPrompts');
        const baseConfig = (await import('@/services/sagePersonaPrompts')).buildSagePersonaConfig(
          updatedPersona,
          detectedTopicId
        );
        sageSystemPrompt = buildLensPrompt(activeLensCtx, baseConfig);
      } else {
        // Legacy path (no IndexedDB or first load)
        sageSystemPrompt = buildSageSystemPrompt(updatedPersona, detectedTopicId);
        if (isGateExam && shouldUseRag(userText)) {
          sageSystemPrompt = buildGateRagPrompt(userText, detectedTopicId, sageSystemPrompt);
        }
        if (isCatExam && shouldUseCatRag(userText)) {
          sageSystemPrompt = buildCatRagPrompt(userText, detectedTopicId, sageSystemPrompt);
        }
      }

      // Prepend opener to the message context for first turn
      const opener = getSageOpener(updatedPersona, history.length === 0);
      if (opener) {
        sageSystemPrompt = `${sageSystemPrompt}\n\nOPENER (use this as your first sentence): "${opener}"`;
      }
    }

    // Try real LLM first, fall back to mock
    const tryRealLLM = async () => {
      const llmResponse = await callLLM({
        agent: activeAgent,
        message: userText,
        attachments: attachments.length > 0 ? attachments : undefined,
        intent: intent.intent as import('@/services/intentEngine').IntentCategory,
        mode: learningMode,
        conversationHistory: history,
        customSystemPrompt: sageSystemPrompt,
      });
      return llmResponse;
    };

    const deliverResponse = (responseText: string, provider?: string) => {
      const latency = Date.now() - start;

      // Add LLM call node to trace
      const llmNodeId = `${sessionId}-llm-${Date.now()}`;
      addNode(activeTrace!, {
        traceId: llmNodeId,
        parentTraceId: agentNodeId,
        nodeType: 'llm_call',
        agentId: activeAgent,
        promptId,
        promptVersion,
        action: `llm:${provider ?? 'unknown'}`,
        inputSummary: userText.slice(0, 100),
        outputSummary: responseText.slice(0, 100),
        latencyMs: latency,
        timestamp: new Date().toISOString(),
        metadata: { provider },
      });

      // Add output node
      addNode(activeTrace!, {
        traceId: `${sessionId}-out-${Date.now()}`,
        parentTraceId: llmNodeId,
        nodeType: 'output',
        agentId: activeAgent,
        action: 'output:delivered',
        inputSummary: `LLM response (${responseText.length} chars)`,
        outputSummary: responseText.slice(0, 100),
        latencyMs: 5,
        timestamp: new Date().toISOString(),
      });

      // Persist trace
      storeTrace(activeTrace!);
      setSessionTrace({ ...activeTrace! });

      const outputBlocks = generateOutputBlocks(responseText, intent.intent);

      // Manim arbitration: decide if this response warrants a visualisation
      const manimTopic = manimEnabled
        ? shouldRenderWithManim(userText, responseText, detectedTopicId)
        : null;
      const manimLatex = manimTopic ? extractPrimaryLatex(responseText) : undefined;

      addMessage(sessionId!, {
        role: 'assistant',
        content: responseText,
        agent: activeAgent,
        outputBlocks,
        intent,
        traceId: activeTrace!.rootTraceId,
        promptId,
        promptVersion,
        metadata: {
          processingMs: latency,
          confidence: intent.confidence,
          provider,
          cohortPeers: matchedSignal?.studentsStruggling,
          // Manim render hint — picked up by the message renderer
          manimTopic: manimTopic ?? undefined,
          manimLatex,
          manimTitle: manimTopic
            ? `${manimTopic.charAt(0).toUpperCase() + manimTopic.slice(1)} — ${detectedTopicId ?? ''}`
            : undefined,
          // Lens context hint — for NextConceptCard rendering
          lensNextTopic: lensContext?.suggestedNextContent ?? undefined,
          lensExamRoute: lensContext?.examId === 'gate-engineering-maths' ? 'gate-em'
            : lensContext?.examId === 'cat' ? 'cat' : undefined,
          // Topper intelligence — render insight chips below this response
          topperTopicId: lensContext?.topicId !== 'general' ? lensContext?.topicId : detectedTopicId,
          topperExamId: lensContext?.examId,
        },
      });

      // ── Record interaction in IndexedDB (fires signals, updates BKT) ──────
      if (isStudent && lensContext) {
        recordSageInteraction({
          studentId: lensContext.studentId,
          examId: lensContext.examId,
          topicId: lensContext.topicId,
          sessionId: sessionId!,
          messageCount: history.length + 1,
          timeSpentMs: latency,
        }).then(async () => {
          // Check if newly mastered after recording
          const { getTopicMastery } = await import('@/services/persistenceDB');
          const mastery = await getTopicMastery(
            lensContext.studentId, lensContext.examId, lensContext.topicId
          );
          if (mastery?.isMastered && mastery.consecutiveCorrect === 3) {
            setNewlyMastered({ topicId: lensContext.topicId, score: mastery.masteryScore });
          }
        }).catch(() => {}); // non-blocking
      }

      setIsTyping(false);
      setStreaming(false);
      // Record Sage response received for latency tracking
      behavioralTrackerRef.current.recordSageResponseReceived();
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
    // Record keystroke for behavioral tracking
    behavioralTrackerRef.current.recordKeystroke(e.key, e.key === 'Backspace');

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

  const handleSendSuggestion = (q: string) => {
    setInput(q);
    // Auto-send after state update
    setTimeout(() => {
      inputRef.current?.focus();
      handleSendWithText(q);
    }, 50);
  };

  const handleSendWithText = async (text: string) => {
    const userText = text.trim();
    if (!userText) return;
    let sessionId = currentSessionId;
    if (!sessionId) {
      sessionId = createSession(selectedAgent, userText.slice(0, 40));
    }
    const intent = detectIntent(userText, [], selectedAgent);
    setLastIntent(intent);
    let activeAgent = selectedAgent;
    if (intent.confidence > 0.80 && intent.targetAgent !== selectedAgent) {
      setAutoRoutedAgent(intent.targetAgent);
      activeAgent = intent.targetAgent;
    } else {
      setAutoRoutedAgent(null);
    }
    addMessage(sessionId, { role: 'user', content: userText, agent: activeAgent, intent });
    setInput('');
    setIsTyping(true);
    setTimeout(() => {
      const response = getMockResponse(intent.intent, activeAgent);
      const blocks = generateOutputBlocks(response, intent.intent);
      addMessage(sessionId!, { role: 'assistant', content: response, agent: activeAgent, outputBlocks: blocks, metadata: { provider: 'mock' } });
      setIsTyping(false);
    }, 1000 + Math.random() * 800);
  };

  const currentAgent = agentOptions.find(a => a.id === selectedAgent);
  const suggestions = SUGGESTIONS_BY_AGENT[selectedAgent] || SUGGESTIONS_BY_AGENT.sage;

  // Frugal mode: student & teacher see a clean single-tutor UI (no agent sidebar)
  const isSimpleMode = userRole === 'student' || userRole === 'teacher';
  const isStudent = userRole === 'student';
  // For simple mode, always route to sage (tutor) — teacher gets sage too but can ask anything
  const simpleAgent = userRole === 'teacher' ? agentOptions.find(a => a.id === 'sage') : agentOptions.find(a => a.id === 'sage');
  const displayAgent = isSimpleMode ? simpleAgent : currentAgent;
  const displaySuggestions = isSimpleMode
    ? (userRole === 'teacher'
        ? ['Create a quiz on quadratic equations', 'Which students are struggling?', 'Generate a lesson plan', 'Explain photosynthesis simply']
        : SUGGESTIONS_BY_AGENT.sage)
    : suggestions;

  // ── Mobile shortcut — render simplified mobile UI ────────────────────────
  const isMobile = useIsMobile();
  const currentSessionMessages = currentSession?.messages ?? [];
  if (isMobile && isStudent) {
    return (
      <MobileChatUI
        messages={currentSessionMessages}
        isTyping={isTyping}
        onSend={(text) => {
          // Wire into the same handleSend flow by setting input and triggering
          // We use a ref trick to avoid duplicating the full send logic
          void (async () => {
            // Directly invoke handleSend with the text pre-set
            const fakeEvent = { target: { value: text } } as React.ChangeEvent<HTMLInputElement>;
            setInput(text);
            // Small delay to let state settle, then send
            await new Promise(r => setTimeout(r, 0));
            handleSend();
          })();
        }}
        examName={persona.exam ?? 'Exam'}
        quickReplies={[
          { id: 'qr1', text: '📝 Practice MCQ', icon: '📝' },
          { id: 'qr2', text: '🔢 Formula sheet', icon: '🔢' },
          { id: 'qr3', text: '📋 PYQ', icon: '📋' },
          { id: 'qr4', text: "🤔 Explain again", icon: '🤔' },
        ]}
      />
    );
  }

  return (
    <div className="h-[calc(100dvh-7rem)] md:h-[calc(100dvh-7rem)] flex gap-5">
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
              {/* Student: live persona indicator instead of static header */}
              {isStudent ? (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-surface-800 rounded-xl border border-surface-700">
                  <span className="text-lg">
                    {persona.emotionalState === 'frustrated' ? '🤝' :
                     persona.emotionalState === 'anxious' ? '🫂' :
                     persona.emotionalState === 'motivated' ? '🔥' :
                     persona.emotionalState === 'exhausted' ? '😴' :
                     persona.emotionalState === 'confident' ? '⚡' : '🎓'}
                  </span>
                  <div>
                    <p className="text-xs font-medium text-white">Sage</p>
                    <p className="text-xs text-surface-400">
                      {persona.daysToExam}d to exam · {persona.syllabusCompletion}% done
                    </p>
                  </div>
                </div>
              ) : (
                <>
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-lg flex-shrink-0">
                    🎓
                  </div>
                  <div>
                    <p className="font-semibold text-sm">AI Assistant</p>
                    <p className="text-xs text-surface-400">Ask anything about your class</p>
                  </div>
                </>
              )}
              {/* New chat button for simple mode */}
              <button onClick={() => handleNewChat('sage')}
                className="ml-2 p-2 rounded-lg hover:bg-surface-800 transition-colors text-surface-400 hover:text-white"
                title="New chat">
                <Plus className="w-4 h-4" />
              </button>
              {/* ── Smart Memory Chip ── */}
              {isStudent && <SmartMemoryChip />}
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
                        className="absolute top-full right-0 mt-1 w-80 glass rounded-xl shadow-xl z-50 p-4 space-y-4">
                        <LearningModeSelector currentMode={learningMode}
                          onModeChange={mode => { setLearningMode(mode); setShowModeSelector(false); }} compact={false} />
                        <ManimToggle />
                      </motion.div>
                    </>
                  )}
                </AnimatePresence>
              </div>
            )}
          </div>
        </div>

        {/* Messages */}
        <div
          className="flex-1 overflow-y-auto p-5 space-y-8"
          onPaste={handlePaste}
          onScroll={(e) => {
            const el = e.currentTarget;
            behavioralTrackerRef.current.recordScroll(el.scrollTop, el.scrollHeight, el.clientHeight);
          }}
        >
          {!currentSession || currentSession.messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center px-4">
              <div className={clsx('w-20 h-20 rounded-2xl bg-gradient-to-br flex items-center justify-center text-4xl mb-4', displayAgent?.color || 'from-primary-500 to-accent-500')}>
                {displayAgent?.emoji || '🎓'}
              </div>
              {isStudent ? (
                /* ── Persona-aware student welcome ── */
                <div className="flex flex-col items-center gap-6 w-full max-w-lg">
                  <div className="text-center">
                    <div className="text-6xl mb-4">
                      {persona.emotionalState === 'frustrated' ? '🤝' :
                       persona.emotionalState === 'anxious' ? '🫂' :
                       persona.tier === 'advanced' ? '⚡' : '🎓'}
                    </div>
                    <h2 className="text-2xl font-bold text-white mb-1">
                      {persona.emotionalState === 'frustrated'
                        ? `Hey ${persona.name}, let's figure this out together`
                        : persona.emotionalState === 'anxious'
                        ? `Take a breath, ${persona.name}. I've got you.`
                        : persona.emotionalState === 'motivated'
                        ? `Let's go, ${persona.name} 🔥`
                        : `What's on your mind, ${persona.name}?`}
                    </h2>
                    <p className="text-surface-400 text-sm">
                      {persona.daysToExam} days to {persona.exam.replace(/_/g, ' ')} ·{' '}
                      {persona.streakDays > 0 ? `${persona.streakDays} day streak 🔥` : 'Start your streak today'}
                    </p>
                  </div>
                  {/* Persona indicator chip */}
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-surface-800 rounded-xl border border-surface-700">
                    <span className="text-lg">
                      {persona.emotionalState === 'frustrated' ? '🤝' :
                       persona.emotionalState === 'anxious' ? '🫂' :
                       persona.emotionalState === 'motivated' ? '🔥' :
                       persona.emotionalState === 'exhausted' ? '😴' :
                       persona.emotionalState === 'confident' ? '⚡' : '🎓'}
                    </span>
                    <div>
                      <p className="text-xs font-medium text-white">Sage — your adaptive mentor</p>
                      <p className="text-xs text-surface-400">
                        {persona.syllabusCompletion}% syllabus done · {persona.tier} tier
                      </p>
                    </div>
                  </div>
                  {/* Contextual quick questions */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full">
                    {getContextualSuggestions(persona).map(q => (
                      <button
                        key={q}
                        onClick={() => handleSendSuggestion(q)}
                        className="text-left p-3 rounded-xl bg-surface-800 border border-surface-700 text-sm text-surface-300 hover:border-primary-500 hover:text-white transition-all"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              ) : isSimpleMode ? (
                <>
                  <h2 className="text-xl font-semibold mb-1">Your AI Teaching Assistant</h2>
                  <p className="text-surface-400 text-sm max-w-md mb-6">Ask about your students, get lesson plans, generate questions</p>
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
              {currentSession.messages.map((message, idx) => (
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
                  dismissedCards={dismissedCards}
                  onDismissCard={(id) => setDismissedCards(prev => new Set([...prev, id]))}
                  newlyMastered={newlyMastered}
                  onDismissMastery={() => setNewlyMastered(null)}
                  isLastMessage={idx === currentSession.messages.length - 1}
                />
              ))}

              {isTyping && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-3 items-center">
                  {/* Agent avatar */}
                  <div className={clsx(
                    'w-9 h-9 rounded-full flex items-center justify-center text-lg shadow-md flex-shrink-0',
                    currentAgent?.id === 'sage'   ? 'bg-gradient-to-br from-amber-500 to-yellow-400' :
                    currentAgent?.id === 'scout'  ? 'bg-gradient-to-br from-blue-500 to-cyan-400' :
                    currentAgent?.id === 'atlas'  ? 'bg-gradient-to-br from-green-500 to-emerald-400' :
                    'bg-gradient-to-br from-surface-600 to-surface-500'
                  )}>
                    {currentAgent?.emoji}
                  </div>
                  {/* Typing dots — minimal, no heavy bubble bg */}
                  <div className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-surface-800/60 border border-surface-700/40">
                    <span className="typing-dot w-2 h-2 bg-surface-400 rounded-full" />
                    <span className="typing-dot w-2 h-2 bg-surface-400 rounded-full" />
                    <span className="typing-dot w-2 h-2 bg-surface-400 rounded-full" />
                    {lastIntent && lastIntent.intent !== 'general' && (
                      <span className="ml-2 text-xs text-surface-600 flex items-center gap-1">
                        <Brain className="w-3 h-3" /> {lastIntent.intent.replace(/_/g, ' ')}...
                      </span>
                    )}
                  </div>
                </motion.div>
              )}
              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        {/* Attachment previews */}
        <AttachmentPreview attachments={attachments} onRemove={removeAttachment} />

        {/* Blog source badge — shown when chat was opened from a blog post */}
        {urlSlug && (
          <div className="px-3 pt-2 flex items-center gap-2">
            <span className="text-xs text-accent-400 bg-accent-500/10 border border-accent-500/20 px-2 py-0.5 rounded-full flex items-center gap-1">
              📖 From blog: <span className="font-medium truncate max-w-[200px]">{urlSlug}</span>
            </span>
          </div>
        )}

        {/* Input area — thumb-zone friendly, safe area bottom padding */}
        <div
          className="p-3 border-t border-surface-700/50"
          style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}
        >
          <div className="flex items-end gap-2">
            {/* Attach menu */}
            <div className="relative">
              <button onClick={() => setShowAttachMenu(!showAttachMenu)}
                className="p-3 hover:bg-surface-800 rounded-xl transition-colors text-surface-400 hover:text-white touch-manipulation min-w-[46px] min-h-[46px] flex items-center justify-center">
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
                onFocus={() => behavioralTrackerRef.current.recordStudentReply()}
                onPaste={handlePaste}
                placeholder={attachments.length > 0
                  ? `Ask about your attachment... (or press Enter to send)`
                  : isSimpleMode
                    ? (userRole === 'teacher' ? 'Ask anything about your students or lessons...' : 'Ask anything — type, paste an image, or draw your problem')
                    : `Ask ${displayAgent?.name} anything... (paste images, type equations)`}
                rows={1}
                className="input resize-none pr-3 text-[16px] md:text-sm"
                style={{ minHeight: '46px', maxHeight: '120px' }}
              />
            </div>

            {/* Voice */}
            <VoiceButton onTranscript={handleVoiceTranscript} />

            {/* Send */}
            <button onClick={handleSend} disabled={(!input.trim() && attachments.length === 0) || isStreaming}
              className={clsx(
                'p-3 rounded-xl transition-all touch-manipulation',
                'min-w-[46px] min-h-[46px] flex items-center justify-center',
                (input.trim() || attachments.length > 0)
                  ? 'bg-primary-500 hover:bg-primary-400 active:bg-primary-600 text-white shadow-lg shadow-primary-500/25'
                  : 'bg-surface-800 text-surface-500'
              )}>
              <Send className="w-5 h-5" />
            </button>
          </div>

          {/* SR due indicator */}
          {srDueCount > 0 && (
            <div className="text-xs text-center mt-1 text-amber-400/80">
              📚 {srDueCount} topic{srDueCount !== 1 ? 's' : ''} due for review — ask Sage to quiz you!
            </div>
          )}
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
