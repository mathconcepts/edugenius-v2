import { useState, useRef, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Send,
  Paperclip,
  Mic,
  MoreVertical,
  Plus,
  Trash2,
  User,
  Sparkles,
  Copy,
  Check,
  RefreshCw,
  ChevronDown,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { useChatStore } from '@/stores/chatStore';
import { useAppStore } from '@/stores/appStore';
import type { AgentType, Message } from '@/types';
import { clsx } from 'clsx';

const agentOptions: { id: AgentType; name: string; emoji: string; description: string }[] = [
  { id: 'sage', name: 'Sage', emoji: '🎓', description: 'Socratic tutor for learning' },
  { id: 'atlas', name: 'Atlas', emoji: '📚', description: 'Content creation & questions' },
  { id: 'scout', name: 'Scout', emoji: '🔍', description: 'Market research & analysis' },
  { id: 'herald', name: 'Herald', emoji: '📢', description: 'Marketing & content' },
  { id: 'oracle', name: 'Oracle', emoji: '📊', description: 'Analytics & insights' },
  { id: 'forge', name: 'Forge', emoji: '⚙️', description: 'Technical operations' },
  { id: 'mentor', name: 'Mentor', emoji: '👨‍🏫', description: 'Student engagement' },
];

// Mock response function
const getMockResponse = (agent: AgentType, _userMessage: string): string => {
  const responses: Record<AgentType, string[]> = {
    sage: [
      "That's a great question! Let me guide you through this step by step.\n\nFirst, let's understand the core concept. What do you already know about this topic?",
      "Interesting approach! But have you considered looking at it from this angle?\n\n**Key Insight:** When we break down the problem, we can see that...\n\nWhat do you think would happen if we changed this variable?",
      "Let me help you understand this better. Here's a visualization:\n\n```\nStep 1: Identify the pattern\nStep 2: Apply the formula\nStep 3: Verify your answer\n```\n\nNow, try applying this to your problem!",
    ],
    atlas: [
      "I've analyzed your request and generated the following content:\n\n## Question Bank\n\n1. **Easy:** Basic conceptual question\n2. **Medium:** Application-based problem\n3. **Hard:** Multi-step reasoning\n\nWould you like me to generate more questions or create explanations?",
      "Here's a structured lesson plan for that topic:\n\n### Learning Objectives\n- Understand core concepts\n- Apply formulas correctly\n- Solve real-world problems\n\n### Content Sections\n1. Introduction (5 min)\n2. Theory (15 min)\n3. Examples (10 min)\n4. Practice (20 min)",
    ],
    scout: [
      "Based on my market analysis, here are the key insights:\n\n📊 **Market Trends:**\n- EdTech growth: 15% YoY\n- Mobile learning: +23% adoption\n- AI tutoring: Emerging segment\n\n🎯 **Opportunities:**\n- Vernacular content gap\n- Competitive exam prep\n\nWould you like detailed competitor analysis?",
    ],
    herald: [
      "I've drafted some marketing content for you:\n\n**Blog Post Title:** \"5 Proven Strategies to Ace Your JEE Exam\"\n\n**Hook:** Did you know 90% of toppers follow these exact strategies?\n\n**SEO Keywords:** JEE preparation, study tips, exam strategy\n\nShall I write the full post or create social media snippets?",
    ],
    oracle: [
      "Here's your analytics summary:\n\n📈 **Key Metrics (Last 7 Days)**\n- Active Users: 2,847 (+12%)\n- Avg. Session: 23 min (+5%)\n- Questions Asked: 14,523\n- Completion Rate: 78%\n\n🔍 **Insights:**\n- Peak activity: 7-9 PM\n- Most engaged topic: Calculus\n\nWant me to generate a detailed report?",
    ],
    forge: [
      "System status check complete:\n\n✅ API Health: All endpoints responding\n✅ Database: 45ms latency (optimal)\n✅ CDN: 99.9% cache hit rate\n✅ LLM Services: All providers active\n\n⚠️ **Alert:** Storage at 72% - consider cleanup\n\nWould you like to run maintenance tasks?",
    ],
    mentor: [
      "Student engagement analysis:\n\n🌟 **High Performers (Top 10%)**\n- 15 students on 7+ day streaks\n- Avg completion: 92%\n\n⚠️ **At Risk (Need Attention)**\n- 8 students inactive >3 days\n- 5 students below 50% progress\n\nI can send personalized nudges to at-risk students. Shall I proceed?",
    ],
  };

  const agentResponses = responses[agent] || responses.sage;
  return agentResponses[Math.floor(Math.random() * agentResponses.length)];
};

function MessageBubble({ message, onCopy }: { message: Message; onCopy: () => void }) {
  const [copied, setCopied] = useState(false);
  const isUser = message.role === 'user';

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
      <div
        className={clsx(
          'w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0',
          isUser
            ? 'bg-gradient-to-br from-primary-400 to-accent-400'
            : 'bg-surface-800'
        )}
      >
        {isUser ? (
          <User className="w-4 h-4 text-white" />
        ) : (
          <span className="text-lg">
            {agentOptions.find(a => a.id === message.agent)?.emoji || '🤖'}
          </span>
        )}
      </div>
      <div className={clsx('flex-1 max-w-[80%]', isUser && 'flex flex-col items-end')}>
        <div
          className={clsx(
            'rounded-2xl px-4 py-3',
            isUser
              ? 'bg-primary-600 text-white rounded-br-md'
              : 'bg-surface-800 text-white rounded-bl-md'
          )}
        >
          {isUser ? (
            <p className="whitespace-pre-wrap">{message.content}</p>
          ) : (
            <div className="prose prose-invert prose-sm max-w-none">
              <ReactMarkdown>{message.content}</ReactMarkdown>
            </div>
          )}
        </div>
        {!isUser && (
          <div className="flex items-center gap-2 mt-2">
            <button
              onClick={handleCopy}
              className="p-1.5 rounded hover:bg-surface-800 transition-colors"
            >
              {copied ? (
                <Check className="w-4 h-4 text-green-400" />
              ) : (
                <Copy className="w-4 h-4 text-surface-500" />
              )}
            </button>
            <button className="p-1.5 rounded hover:bg-surface-800 transition-colors">
              <RefreshCw className="w-4 h-4 text-surface-500" />
            </button>
          </div>
        )}
        <p className="text-xs text-surface-500 mt-1">
          {new Date(message.timestamp).toLocaleTimeString()}
        </p>
      </div>
    </motion.div>
  );
}

export function Chat() {
  const [searchParams] = useSearchParams();
  const defaultAgent = (searchParams.get('agent') as AgentType) || 'sage';
  
  const [input, setInput] = useState('');
  const [selectedAgent, setSelectedAgent] = useState<AgentType>(defaultAgent);
  const [showAgentPicker, setShowAgentPicker] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  
  const {
    sessions,
    currentSessionId,
    createSession,
    setCurrentSession,
    deleteSession,
    addMessage,
    isStreaming,
  } = useChatStore();
  
  const { addNotification } = useAppStore();

  const currentSession = sessions.find(s => s.id === currentSessionId);
  const currentAgent = agentOptions.find(a => a.id === selectedAgent);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [currentSession?.messages]);

  useEffect(() => {
    // Create a session if none exists
    if (sessions.length === 0) {
      createSession(selectedAgent, `Chat with ${currentAgent?.name}`);
    }
  }, []);

  const handleSend = async () => {
    if (!input.trim()) return;

    let sessionId = currentSessionId;
    if (!sessionId) {
      sessionId = createSession(selectedAgent, `Chat with ${currentAgent?.name}`);
    }

    // Add user message
    addMessage(sessionId, {
      role: 'user',
      content: input.trim(),
    });

    const userInput = input.trim();
    setInput('');
    setIsTyping(true);

    // Simulate AI response
    setTimeout(() => {
      const response = getMockResponse(selectedAgent, userInput);
      addMessage(sessionId!, {
        role: 'assistant',
        content: response,
        agent: selectedAgent,
      });
      setIsTyping(false);
    }, 1000 + Math.random() * 1000);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleNewChat = () => {
    createSession(selectedAgent, `Chat with ${currentAgent?.name}`);
  };

  return (
    <div className="h-[calc(100vh-7rem)] flex gap-6">
      {/* Sidebar - Chat History */}
      <div className="w-72 flex-shrink-0 glass rounded-xl p-4 flex flex-col">
        <button
          onClick={handleNewChat}
          className="w-full btn-primary flex items-center justify-center gap-2 mb-4"
        >
          <Plus className="w-4 h-4" />
          New Chat
        </button>

        <div className="flex-1 overflow-y-auto space-y-2">
          {sessions.map((session) => (
            <div
              key={session.id}
              onClick={() => setCurrentSession(session.id)}
              className={clsx(
                'p-3 rounded-lg cursor-pointer transition-colors group',
                currentSessionId === session.id
                  ? 'bg-primary-500/20 border border-primary-500/30'
                  : 'hover:bg-surface-800'
              )}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <span>{agentOptions.find(a => a.id === session.agent)?.emoji}</span>
                  <span className="truncate text-sm font-medium">{session.title}</span>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteSession(session.id);
                  }}
                  className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-500/20 rounded transition-all"
                >
                  <Trash2 className="w-3 h-3 text-red-400" />
                </button>
              </div>
              <p className="text-xs text-surface-500 mt-1">
                {session.messages.length} messages
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 glass rounded-xl flex flex-col overflow-hidden">
        {/* Chat Header */}
        <div className="p-4 border-b border-surface-700/50 flex items-center justify-between">
          <div className="relative">
            <button
              onClick={() => setShowAgentPicker(!showAgentPicker)}
              className="flex items-center gap-3 p-2 rounded-lg hover:bg-surface-800 transition-colors"
            >
              <span className="text-2xl">{currentAgent?.emoji}</span>
              <div className="text-left">
                <p className="font-medium">{currentAgent?.name}</p>
                <p className="text-xs text-surface-400">{currentAgent?.description}</p>
              </div>
              <ChevronDown className="w-4 h-4 text-surface-400" />
            </button>

            <AnimatePresence>
              {showAgentPicker && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setShowAgentPicker(false)}
                  />
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    className="absolute top-full left-0 mt-2 w-72 glass rounded-xl shadow-xl z-50 p-2"
                  >
                    {agentOptions.map((agent) => (
                      <button
                        key={agent.id}
                        onClick={() => {
                          setSelectedAgent(agent.id);
                          setShowAgentPicker(false);
                          handleNewChat();
                        }}
                        className={clsx(
                          'w-full flex items-center gap-3 p-3 rounded-lg transition-colors text-left',
                          selectedAgent === agent.id
                            ? 'bg-primary-500/20'
                            : 'hover:bg-surface-800'
                        )}
                      >
                        <span className="text-2xl">{agent.emoji}</span>
                        <div>
                          <p className="font-medium">{agent.name}</p>
                          <p className="text-xs text-surface-400">{agent.description}</p>
                        </div>
                      </button>
                    ))}
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>

          <button className="p-2 hover:bg-surface-800 rounded-lg transition-colors">
            <MoreVertical className="w-5 h-5 text-surface-400" />
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {!currentSession || currentSession.messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center">
              <div className="text-6xl mb-4">{currentAgent?.emoji}</div>
              <h2 className="text-xl font-semibold mb-2">Chat with {currentAgent?.name}</h2>
              <p className="text-surface-400 max-w-md mb-8">{currentAgent?.description}</p>
              
              <div className="grid grid-cols-2 gap-3 max-w-lg">
                {[
                  'Help me understand quadratic equations',
                  'Generate practice questions for Class 10',
                  'What are the key concepts in Newton\'s Laws?',
                  'Create a study plan for JEE Math',
                ].map((suggestion, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      setInput(suggestion);
                      inputRef.current?.focus();
                    }}
                    className="p-3 rounded-xl bg-surface-800/50 hover:bg-surface-800 text-left text-sm transition-colors"
                  >
                    <Sparkles className="w-4 h-4 text-accent-400 mb-2" />
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <>
              {currentSession.messages.map((message) => (
                <MessageBubble
                  key={message.id}
                  message={message}
                  onCopy={() => addNotification({ type: 'success', title: 'Copied', message: 'Message copied to clipboard' })}
                />
              ))}
              {isTyping && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex gap-3"
                >
                  <div className="w-8 h-8 rounded-full bg-surface-800 flex items-center justify-center">
                    <span className="text-lg">{currentAgent?.emoji}</span>
                  </div>
                  <div className="bg-surface-800 rounded-2xl rounded-bl-md px-4 py-3">
                    <div className="flex gap-1">
                      <span className="w-2 h-2 bg-surface-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-2 h-2 bg-surface-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-2 h-2 bg-surface-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                </motion.div>
              )}
              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        {/* Input Area */}
        <div className="p-4 border-t border-surface-700/50">
          <div className="flex items-end gap-3">
            <button className="p-2 hover:bg-surface-800 rounded-lg transition-colors">
              <Paperclip className="w-5 h-5 text-surface-400" />
            </button>
            <div className="flex-1 relative">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={`Ask ${currentAgent?.name} anything...`}
                rows={1}
                className="input resize-none pr-12"
                style={{ minHeight: '44px', maxHeight: '120px' }}
              />
            </div>
            <button className="p-2 hover:bg-surface-800 rounded-lg transition-colors">
              <Mic className="w-5 h-5 text-surface-400" />
            </button>
            <button
              onClick={handleSend}
              disabled={!input.trim() || isStreaming}
              className={clsx(
                'p-3 rounded-xl transition-all',
                input.trim()
                  ? 'bg-primary-500 hover:bg-primary-400 text-white'
                  : 'bg-surface-800 text-surface-500'
              )}
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
          <p className="text-xs text-surface-500 text-center mt-3">
            {currentAgent?.name} can make mistakes. Verify important information.
          </p>
        </div>
      </div>
    </div>
  );
}
