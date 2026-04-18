// User roles
export type UserRole = 'ceo' | 'admin' | 'manager' | 'teacher' | 'student';

// Agent types
export type AgentType = 'scout' | 'atlas' | 'sage' | 'mentor' | 'herald' | 'forge' | 'oracle' | 'nexus' | 'prism';

export interface Agent {
  id: AgentType;
  name: string;
  emoji: string;
  status: 'active' | 'idle' | 'busy' | 'offline';
  description: string;
  subAgents: SubAgent[];
  metrics: AgentMetrics;
}

export interface SubAgent {
  id: string;
  name: string;
  description: string;
  status: 'active' | 'idle' | 'busy';
}

export interface AgentMetrics {
  tasksCompleted: number;
  tokensUsed: number;
  avgResponseTime: number;
  successRate: number;
}

// Student data
export interface Student {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  grade: string;
  subjects: string[];
  progress: StudentProgress;
  streak: number;
  badges: Badge[];
  createdAt: Date;
}

export interface StudentProgress {
  overallScore: number;
  topicsCompleted: number;
  totalTopics: number;
  hoursLearned: number;
  questionsAnswered: number;
  accuracy: number;
}

export interface Badge {
  id: string;
  name: string;
  icon: string;
  description: string;
  earnedAt: Date;
}

// Learning content
export interface Topic {
  id: string;
  title: string;
  subject: string;
  description: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  duration: number; // minutes
  lessons: Lesson[];
  prerequisites: string[];
}

export interface Lesson {
  id: string;
  title: string;
  type: 'video' | 'reading' | 'interactive' | 'quiz';
  content: string;
  duration: number;
  completed?: boolean;
}

// Chat/Tutor
// ─── Multimodal Types ──────────────────────────────────────────────────────────

export type InputModality = 'text' | 'image' | 'audio' | 'file' | 'drawing';
export type OutputModality = 'text' | 'image_description' | 'equation' | 'diagram' | 'card' | 'audio_url' | 'table' | 'steps';

export interface MediaAttachment {
  id: string;
  type: InputModality;
  name: string;
  url: string;          // object URL or base64 data URL
  mimeType: string;
  size?: number;
  transcript?: string;  // for audio: STT result
  analysis?: string;    // for images: AI description
  thumbnail?: string;   // for images: preview
}

export interface OutputBlock {
  type: OutputModality;
  content: string;
  label?: string;
  items?: string[];     // for steps/lists
  rows?: string[][];    // for tables
  headers?: string[];   // for tables
}

export interface IntentResult {
  intent: string;        // e.g. 'solve_math', 'explain_concept', 'generate_content', 'analyze_image'
  confidence: number;    // 0–1
  targetAgent: AgentType;
  suggestedMode?: string; // learning mode suggestion
  reasoning?: string;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  agent?: AgentType;

  // Multimodal
  attachments?: MediaAttachment[];
  outputBlocks?: OutputBlock[];
  intent?: IntentResult;

  metadata?: {
    thinking?: string;
    sources?: string[];
    confidence?: number;
    processingMs?: number;
    provider?: string;       // e.g. 'gemini', 'anthropic', 'mock'
    cohortPeers?: number;    // number of peers struggling with same topic (network effect)
    networkLoopId?: string;  // which network loop triggered this context
    // Manim visualisation hints (set by arbitration layer)
    manimTopic?: string;     // e.g. 'eigenvalue', 'integration' — triggers ManimViz render
    manimLatex?: string;     // primary LaTeX expression extracted from response
    manimTitle?: string;     // human-readable label for the visualisation
    // Topper intelligence hints
    topperTopicId?: string;  // e.g. 'linear-algebra' — for TopperInsightCard
    topperExamId?: string;   // e.g. 'gate-engineering-maths'
  };

  // Traceability
  traceId?: string;        // rootTraceId of the TraceTree for this message
  promptId?: string;       // which prompt template was used
  promptVersion?: string;  // version string e.g. '2.1.0'
  subAgentId?: string;     // e.g. 'Socratic', 'EmotionReader'
  entryPoint?: string;     // how user got to chat
  sourceUrl?: string;      // URL they came from (blog slug etc)
}

export interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  agent: AgentType;
  createdAt: Date;
  updatedAt: Date;

  // Entry traceability
  entryPoint?: string;
  referrerUrl?: string;
  utmParams?: Record<string, string>;
}

// Analytics
export interface AnalyticsData {
  period: 'day' | 'week' | 'month' | 'year';
  students: {
    total: number;
    active: number;
    new: number;
  };
  engagement: {
    sessions: number;
    avgDuration: number;
    questionsAsked: number;
  };
  performance: {
    avgScore: number;
    completionRate: number;
    improvement: number;
  };
  agents: {
    tasksCompleted: number;
    tokensUsed: number;
    costSavings: number;
  };
}

export interface ChartDataPoint {
  date: string;
  value: number;
  label?: string;
}

// Content creation
export interface ContentItem {
  id: string;
  type: 'question' | 'explanation' | 'quiz' | 'worksheet' | 'video-script';
  title: string;
  content: string;
  subject: string;
  topic: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  status: 'draft' | 'review' | 'published';
  createdBy: AgentType | 'human';
  createdAt: Date;
  updatedAt: Date;
}

// Notifications
export interface Notification {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message: string;
  read: boolean;
  timestamp: Date;
  action?: {
    label: string;
    href: string;
  };
}

// Events
export interface SystemEvent {
  id: string;
  type: string;
  agent: AgentType;
  payload: Record<string, unknown>;
  timestamp: Date;
}

// Playground
export interface PlaygroundConfig {
  role: UserRole;
  agent?: AgentType;
  mockData: boolean;
  showDebug: boolean;
}

// Re-export notebook and teaching types
export * from './notebook';
export * from './teaching';
