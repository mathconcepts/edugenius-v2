import { create } from 'zustand';
import type { Message, ChatSession, AgentType } from '@/types';

interface EntryMeta {
  entryPoint?: string;
  referrerUrl?: string;
  utmParams?: Record<string, string>;
}

interface ChatState {
  sessions: ChatSession[];
  currentSessionId: string | null;
  isStreaming: boolean;
  
  // Session management
  createSession: (agent: AgentType, title?: string, entryMeta?: EntryMeta) => string;
  setCurrentSession: (id: string | null) => void;
  deleteSession: (id: string) => void;
  
  // Messages
  addMessage: (sessionId: string, message: Omit<Message, 'id' | 'timestamp'>) => void;
  updateMessage: (sessionId: string, messageId: string, content: string) => void;
  
  // Streaming
  setStreaming: (streaming: boolean) => void;
  
  // Get current session
  getCurrentSession: () => ChatSession | null;
}

export const useChatStore = create<ChatState>((set, get) => ({
  sessions: [],
  currentSessionId: null,
  isStreaming: false,
  
  createSession: (agent, title, entryMeta) => {
    const id = Math.random().toString(36).slice(2);
    const session: ChatSession = {
      id,
      title: title || `Chat with ${agent}`,
      messages: [],
      agent,
      createdAt: new Date(),
      updatedAt: new Date(),
      // Traceability fields
      entryPoint: entryMeta?.entryPoint,
      referrerUrl: entryMeta?.referrerUrl,
      utmParams: entryMeta?.utmParams,
    };
    
    set((state) => ({
      sessions: [session, ...state.sessions],
      currentSessionId: id,
    }));
    
    return id;
  },
  
  setCurrentSession: (id) => set({ currentSessionId: id }),
  
  deleteSession: (id) => set((state) => ({
    sessions: state.sessions.filter((s) => s.id !== id),
    currentSessionId: state.currentSessionId === id ? null : state.currentSessionId,
  })),
  
  addMessage: (sessionId, message) => set((state) => ({
    sessions: state.sessions.map((s) =>
      s.id === sessionId
        ? {
            ...s,
            messages: [
              ...s.messages,
              {
                ...message,
                id: Math.random().toString(36).slice(2),
                timestamp: new Date(),
              },
            ],
            updatedAt: new Date(),
          }
        : s
    ),
  })),
  
  updateMessage: (sessionId, messageId, content) => set((state) => ({
    sessions: state.sessions.map((s) =>
      s.id === sessionId
        ? {
            ...s,
            messages: s.messages.map((m) =>
              m.id === messageId ? { ...m, content } : m
            ),
          }
        : s
    ),
  })),
  
  setStreaming: (streaming) => set({ isStreaming: streaming }),
  
  getCurrentSession: () => {
    const state = get();
    return state.sessions.find((s) => s.id === state.currentSessionId) || null;
  },
}));
