/**
 * Chat Widget Component
 * Embeddable chat for web interface
 */

import React, { useState, useRef, useEffect } from 'react';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  type?: 'text' | 'image' | 'file';
  media?: {
    url: string;
    name?: string;
  };
}

interface QuickReply {
  id: string;
  text: string;
}

interface ChatWidgetProps {
  onSendMessage: (message: string) => Promise<void>;
  onClose?: () => void;
  title?: string;
  subtitle?: string;
  placeholder?: string;
  quickReplies?: QuickReply[];
  initialMessages?: Message[];
  isTyping?: boolean;
  isMinimized?: boolean;
}

export const ChatWidget: React.FC<ChatWidgetProps> = ({
  onSendMessage,
  onClose,
  title = 'EduGenius AI',
  subtitle = 'Ask me anything!',
  placeholder = 'Type your message...',
  quickReplies = [],
  initialMessages = [],
  isTyping = false,
  isMinimized: initialMinimized = false
}) => {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [input, setInput] = useState('');
  const [isMinimized, setIsMinimized] = useState(initialMinimized);
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const handleSend = async () => {
    if (!input.trim() || isSending) return;

    const userMessage: Message = {
      id: `msg_${Date.now()}`,
      role: 'user',
      content: input.trim(),
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsSending(true);

    try {
      await onSendMessage(input.trim());
    } finally {
      setIsSending(false);
    }
  };

  const handleQuickReply = (reply: QuickReply) => {
    setInput(reply.text);
    inputRef.current?.focus();
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Add assistant message (called externally via ref or context)
  const addAssistantMessage = (content: string) => {
    const assistantMessage: Message = {
      id: `msg_${Date.now()}`,
      role: 'assistant',
      content,
      timestamp: new Date()
    };
    setMessages(prev => [...prev, assistantMessage]);
  };

  if (isMinimized) {
    return (
      <button
        onClick={() => setIsMinimized(false)}
        className="fixed bottom-4 right-4 w-14 h-14 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-lg flex items-center justify-center transition-all z-50"
      >
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
        </svg>
      </button>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 w-96 h-[600px] max-h-[80vh] bg-white dark:bg-gray-900 rounded-xl shadow-2xl flex flex-col overflow-hidden z-50 border border-gray-200 dark:border-gray-700">
      {/* Header */}
      <div className="bg-blue-600 text-white p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
            <span className="text-xl">🎓</span>
          </div>
          <div>
            <h3 className="font-semibold">{title}</h3>
            <p className="text-sm text-blue-100">{subtitle}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setIsMinimized(true)}
            className="p-1 hover:bg-white/20 rounded"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="p-1 hover:bg-white/20 rounded"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center text-gray-500 dark:text-gray-400 py-8">
            <p className="text-4xl mb-2">👋</p>
            <p>Hi there! How can I help you today?</p>
          </div>
        )}
        
        {messages.map(message => (
          <div
            key={message.id}
            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] rounded-lg p-3 ${
                message.role === 'user'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100'
              }`}
            >
              {message.type === 'image' && message.media && (
                <img src={message.media.url} alt="" className="rounded mb-2 max-w-full" />
              )}
              <p className="whitespace-pre-wrap">{message.content}</p>
              <p className={`text-xs mt-1 ${
                message.role === 'user' ? 'text-blue-100' : 'text-gray-500'
              }`}>
                {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          </div>
        ))}

        {isTyping && (
          <div className="flex justify-start">
            <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-3">
              <div className="flex gap-1">
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Quick Replies */}
      {quickReplies.length > 0 && messages.length === 0 && (
        <div className="px-4 pb-2 flex flex-wrap gap-2">
          {quickReplies.map(reply => (
            <button
              key={reply.id}
              onClick={() => handleQuickReply(reply)}
              className="px-3 py-1.5 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-sm rounded-full hover:bg-blue-100 dark:hover:bg-blue-900/50 transition"
            >
              {reply.text}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="p-4 border-t border-gray-200 dark:border-gray-700">
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={placeholder}
            disabled={isSending}
            className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-white disabled:opacity-50"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isSending}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatWidget;
