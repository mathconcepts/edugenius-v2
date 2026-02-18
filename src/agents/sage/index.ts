// @ts-nocheck
/**
 * Sage Agent - AI Tutor
 * Provides personalized tutoring through Socratic method
 */

import { randomUUID } from 'crypto';
import { BaseAgent, AgentConfig, AgentContext } from '../base-agent';
import { LLMClient } from '../../llm';
import {
  TutorRequestPayload,
  TutorResponsePayload,
  StudentProgressPayload,
} from '../../events/types';
import { StudentKnowledgeGraph, KnowledgeNode } from '../../data/vector-store';

// ============================================================================
// Sage Agent Configuration
// ============================================================================

const SAGE_CONFIG: AgentConfig = {
  id: 'Sage',
  name: 'Sage',
  description: 'AI tutor agent - provides personalized learning through Socratic method',
  heartbeatIntervalMs: 5 * 60 * 1000, // 5 minutes (continuous operation)
  budget: {
    dailyTokenLimit: 300000,
    warningThreshold: 0.9,
  },
  subAgents: [
    {
      id: 'Socratic',
      name: 'Socratic Guide',
      description: 'Asks guiding questions, promotes discovery learning',
      triggers: ['tutor:request'],
      handler: 'guideSocratically',
    },
    {
      id: 'Explainer',
      name: 'Concept Explainer',
      description: 'Provides clear explanations with analogies',
      triggers: ['tutor:explain'],
      handler: 'explain',
    },
    {
      id: 'ProblemSolver',
      name: 'Problem Solver',
      description: 'Guides through step-by-step solutions',
      triggers: ['tutor:solve'],
      handler: 'solveProblem',
    },
    {
      id: 'ConceptMapper',
      name: 'Concept Mapper',
      description: 'Maps knowledge connections and prerequisites',
      triggers: ['tutor:connect'],
      handler: 'mapConcepts',
    },
    {
      id: 'PracticeCoach',
      name: 'Practice Coach',
      description: 'Manages spaced repetition and practice',
      triggers: ['tutor:practice'],
      handler: 'coachPractice',
    },
    {
      id: 'EmotionReader',
      name: 'Emotion Reader',
      description: 'Detects frustration and adjusts approach',
      triggers: ['tutor:assess'],
      handler: 'assessEmotion',
    },
    {
      id: 'LanguageAdapter',
      name: 'Language Adapter',
      description: 'Adapts language, handles code-switching',
      triggers: ['tutor:adapt'],
      handler: 'adaptLanguage',
    },
  ],
};

// ============================================================================
// Sage Agent Implementation
// ============================================================================

export class SageAgent extends BaseAgent {
  private activeSessions: Map<string, TutoringSession> = new Map();
  private studentGraphs: Map<string, StudentKnowledgeGraph> = new Map();
  private sessionHistory: Map<string, SessionMessage[]> = new Map();

  constructor(config: Partial<AgentConfig> = {}) {
    super({ ...SAGE_CONFIG, ...config });
  }

  // -------------------------------------------------------------------------
  // Lifecycle
  // -------------------------------------------------------------------------

  protected async initializeLLM(): Promise<void> {
    // LLM client will be injected
    this.llm = null;
  }

  protected registerSubAgents(): void {
    this.registerSubAgent('Socratic', this.guideSocratically.bind(this));
    this.registerSubAgent('Explainer', this.explain.bind(this));
    this.registerSubAgent('ProblemSolver', this.solveProblem.bind(this));
    this.registerSubAgent('ConceptMapper', this.mapConcepts.bind(this));
    this.registerSubAgent('PracticeCoach', this.coachPractice.bind(this));
    this.registerSubAgent('EmotionReader', this.assessEmotion.bind(this));
    this.registerSubAgent('LanguageAdapter', this.adaptLanguage.bind(this));
  }

  protected async setupSubscriptions(): Promise<void> {
    // Listen for tutor requests
    this.subscribe('sage.tutor.request', async (event) => {
      await this.handleTutorRequest(event.payload);
    });

    // Listen for session start
    this.subscribe('sage.session.started', async (event) => {
      await this.initializeSession(event.payload);
    });

    // Listen for session end
    this.subscribe('sage.session.ended', async (event) => {
      await this.endSession(event.payload.sessionId);
    });
  }

  protected async onHeartbeat(): Promise<void> {
    // Check for inactive sessions
    await this.cleanupInactiveSessions();

    // Update student progress
    await this.updateProgressMetrics();
  }

  // -------------------------------------------------------------------------
  // Session Management
  // -------------------------------------------------------------------------

  private async initializeSession(sessionData: {
    sessionId: string;
    studentId: string;
    topic?: string;
    channel: string;
  }): Promise<TutoringSession> {
    const session: TutoringSession = {
      id: sessionData.sessionId,
      studentId: sessionData.studentId,
      topic: sessionData.topic,
      channel: sessionData.channel as SessionChannel,
      status: 'active',
      startedAt: Date.now(),
      context: {
        currentTopic: sessionData.topic,
        difficulty: 'medium',
        mastery: 0.5,
        emotionalState: 'neutral',
        hintsUsed: 0,
        questionsAsked: 0,
        correctAnswers: 0,
      },
      messages: [],
    };

    this.activeSessions.set(session.id, session);

    // Load or create student knowledge graph
    await this.loadStudentGraph(session.studentId);

    // Send welcome message
    await this.sendResponse(session, {
      type: 'greeting',
      content: this.generateGreeting(session),
    });

    return session;
  }

  private async endSession(sessionId: string): Promise<void> {
    const session = this.activeSessions.get(sessionId);
    if (!session) return;

    session.status = 'completed';
    session.endedAt = Date.now();

    // Calculate session metrics
    const metrics = this.calculateSessionMetrics(session);

    // Update student progress
    await this.updateStudentProgress(session, metrics);

    // Emit progress update
    this.emit('sage.progress.updated', {
      studentId: session.studentId,
      subject: session.topic?.split('/')[0] || 'general',
      topic: session.topic || 'general',
      masteryLevel: session.context.mastery,
      questionsAttempted: session.context.questionsAsked,
      questionsCorrect: session.context.correctAnswers,
      timeSpent: Math.floor((session.endedAt - session.startedAt) / 60000),
      streakDays: 1,
    });

    // Archive session history
    this.sessionHistory.set(sessionId, [...session.messages]);
    this.activeSessions.delete(sessionId);
  }

  private async cleanupInactiveSessions(): Promise<void> {
    const now = Date.now();
    const timeout = 30 * 60 * 1000; // 30 minutes

    for (const [sessionId, session] of this.activeSessions) {
      if (now - session.lastActivityAt! > timeout) {
        await this.endSession(sessionId);
      }
    }
  }

  // -------------------------------------------------------------------------
  // Request Handling
  // -------------------------------------------------------------------------

  private async handleTutorRequest(request: TutorRequestPayload): Promise<void> {
    const { sessionId, studentId, question, subject, topic } = request;

    // Get or create session
    let session = this.activeSessions.get(sessionId);
    if (!session) {
      session = await this.initializeSession({
        sessionId,
        studentId,
        topic: `${subject}/${topic}`,
        channel: 'web',
      });
    }

    // Add user message to session
    session.messages.push({
      role: 'student',
      content: question,
      timestamp: Date.now(),
    });
    session.lastActivityAt = Date.now();

    // Determine response strategy
    const strategy = await this.determineStrategy(session, question);

    // Generate response using appropriate sub-agent
    const response = await this.generateResponse(session, question, strategy);

    // Send response
    await this.sendResponse(session, response);
  }

  private async determineStrategy(
    session: TutoringSession,
    question: string
  ): Promise<ResponseStrategy> {
    // Assess emotional state
    const emotion = await this.invokeSubAgent<EmotionAssessment>(
      'EmotionReader',
      { message: question, context: session.context },
      { agentId: this.config.id, taskId: session.id }
    );

    session.context.emotionalState = emotion.state;

    // Determine strategy based on question type and emotional state
    if (emotion.state === 'frustrated') {
      return 'encourage';
    }

    if (question.toLowerCase().includes('explain') || question.includes('what is')) {
      return 'explain';
    }

    if (question.toLowerCase().includes('solve') || question.includes('how do')) {
      return 'solve';
    }

    if (question.toLowerCase().includes('practice') || question.includes('quiz')) {
      return 'practice';
    }

    // Default: Socratic method
    return 'socratic';
  }

  private async generateResponse(
    session: TutoringSession,
    question: string,
    strategy: ResponseStrategy
  ): Promise<TutorResponse> {
    const context: AgentContext = {
      agentId: this.config.id,
      taskId: session.id,
    };

    switch (strategy) {
      case 'socratic':
        return this.invokeSubAgent<TutorResponse>(
          'Socratic',
          { question, session },
          context
        );

      case 'explain':
        return this.invokeSubAgent<TutorResponse>(
          'Explainer',
          { question, session },
          context
        );

      case 'solve':
        return this.invokeSubAgent<TutorResponse>(
          'ProblemSolver',
          { question, session },
          context
        );

      case 'practice':
        return this.invokeSubAgent<TutorResponse>(
          'PracticeCoach',
          { session },
          context
        );

      case 'encourage':
        return {
          type: 'encouragement',
          content: this.generateEncouragement(session),
          followUp: ['Would you like me to explain it differently?', 'Should we try an easier example?'],
        };

      default:
        return this.invokeSubAgent<TutorResponse>(
          'Socratic',
          { question, session },
          context
        );
    }
  }

  private async sendResponse(session: TutoringSession, response: TutorResponse): Promise<void> {
    // Add to session messages
    session.messages.push({
      role: 'tutor',
      content: response.content,
      timestamp: Date.now(),
      metadata: { type: response.type },
    });

    // Emit response event
    this.emit('sage.tutor.response', {
      sessionId: session.id,
      studentId: session.studentId,
      response: response.content,
      responseType: response.type as TutorResponsePayload['responseType'],
      visualAids: response.visuals,
      followUpQuestions: response.followUp,
      masteryUpdate: response.masteryChange ? {
        topic: session.topic || 'general',
        before: session.context.mastery,
        after: session.context.mastery + response.masteryChange,
      } : undefined,
    });

    // Update mastery if changed
    if (response.masteryChange) {
      session.context.mastery = Math.max(0, Math.min(1,
        session.context.mastery + response.masteryChange
      ));
    }
  }

  // -------------------------------------------------------------------------
  // Sub-Agent: Socratic Guide
  // -------------------------------------------------------------------------

  private async guideSocratically(
    input: { question: string; session: TutoringSession },
    context: AgentContext
  ): Promise<TutorResponse> {
    const { question, session } = input;

    // Analyze what the student knows
    const understanding = await this.assessUnderstanding(session, question);

    // Generate guiding question
    const guidingQuestion = this.generateGuidingQuestion(question, understanding);

    session.context.questionsAsked++;

    return {
      type: 'question',
      content: guidingQuestion.question,
      hint: guidingQuestion.hint,
      followUp: guidingQuestion.followUp,
      masteryChange: 0.02, // Small increase for engagement
    };
  }

  private async assessUnderstanding(
    session: TutoringSession,
    question: string
  ): Promise<UnderstandingLevel> {
    // Check knowledge graph
    const graph = this.studentGraphs.get(session.studentId);
    if (!graph) return 'unknown';

    const topicMastery = session.context.mastery;

    if (topicMastery < 0.3) return 'novice';
    if (topicMastery < 0.6) return 'developing';
    if (topicMastery < 0.8) return 'proficient';
    return 'advanced';
  }

  private generateGuidingQuestion(
    originalQuestion: string,
    understanding: UnderstandingLevel
  ): { question: string; hint?: string; followUp: string[] } {
    // Generate questions based on understanding level
    const questions = {
      novice: {
        question: "Let's start with the basics. What do you already know about this topic?",
        hint: 'Think about any examples you might have seen before.',
        followUp: ['Can you think of a real-world example?', "What part seems most confusing?"],
      },
      developing: {
        question: "Good question! Before I answer, what do you think might be the approach here?",
        hint: 'Consider what concepts we discussed earlier.',
        followUp: ['What would happen if...?', 'Can you see a pattern?'],
      },
      proficient: {
        question: "Interesting! Can you identify why this might be tricky?",
        hint: 'Think about edge cases.',
        followUp: ['How would you verify your answer?', 'What assumptions are we making?'],
      },
      advanced: {
        question: "Great insight! How does this connect to the broader concept?",
        followUp: ['Could you teach this to someone else?', 'What variations can you think of?'],
      },
      unknown: {
        question: "Tell me more about what you're trying to understand.",
        followUp: ['Where did you encounter this?', 'What made you curious about this?'],
      },
    };

    return questions[understanding];
  }

  // -------------------------------------------------------------------------
  // Sub-Agent: Explainer
  // -------------------------------------------------------------------------

  private async explain(
    input: { question: string; session: TutoringSession },
    context: AgentContext
  ): Promise<TutorResponse> {
    const { question, session } = input;

    // Extract the concept to explain
    const concept = this.extractConcept(question);

    // Generate explanation with analogy
    const explanation = await this.generateExplanation(concept, session.context);

    return {
      type: 'explanation',
      content: explanation.text,
      visuals: explanation.visuals,
      followUp: [
        'Does this make sense?',
        'Would you like me to give another example?',
        'Shall we try a practice problem?',
      ],
      masteryChange: 0.05,
    };
  }

  private extractConcept(question: string): string {
    // Extract the main concept from the question
    const patterns = [
      /what is (.+?)\??$/i,
      /explain (.+?)\??$/i,
      /tell me about (.+?)\??$/i,
      /how does (.+?) work\??$/i,
    ];

    for (const pattern of patterns) {
      const match = question.match(pattern);
      if (match) return match[1].trim();
    }

    return question;
  }

  private async generateExplanation(
    concept: string,
    context: SessionContext
  ): Promise<{ text: string; visuals?: string[] }> {
    // Would use LLM in production
    const explanation = `Let me explain ${concept} in a simple way.\n\n` +
      `Think of it like this: [analogy based on concept]\n\n` +
      `The key points are:\n` +
      `1. [First key point]\n` +
      `2. [Second key point]\n` +
      `3. [Third key point]\n\n` +
      `In practice, this means...`;

    return {
      text: explanation,
      visuals: [`diagram:${concept.replace(/\s+/g, '_')}`],
    };
  }

  // -------------------------------------------------------------------------
  // Sub-Agent: Problem Solver
  // -------------------------------------------------------------------------

  private async solveProblem(
    input: { question: string; session: TutoringSession },
    context: AgentContext
  ): Promise<TutorResponse> {
    const { question, session } = input;

    // Generate step-by-step solution
    const solution = await this.generateSolution(question, session.context);

    session.context.questionsAsked++;

    return {
      type: 'solution',
      content: solution.explanation,
      steps: solution.steps,
      followUp: [
        'Do you understand each step?',
        'Would you like to try a similar problem?',
        'Which step was the trickiest?',
      ],
      masteryChange: 0.08,
    };
  }

  private async generateSolution(
    problem: string,
    context: SessionContext
  ): Promise<{ steps: string[]; explanation: string }> {
    // Would use LLM in production
    return {
      steps: [
        'Step 1: Identify what we know',
        'Step 2: Determine what we need to find',
        'Step 3: Choose the appropriate method',
        'Step 4: Apply the method',
        'Step 5: Verify the answer',
      ],
      explanation: `Here's how to approach this problem:\n\n` +
        `First, let's identify the key information...\n` +
        `Then, we'll apply [relevant concept]...\n` +
        `Finally, we verify our answer makes sense.`,
    };
  }

  // -------------------------------------------------------------------------
  // Sub-Agent: Practice Coach
  // -------------------------------------------------------------------------

  private async coachPractice(
    input: { session: TutoringSession },
    context: AgentContext
  ): Promise<TutorResponse> {
    const { session } = input;

    // Get appropriate practice problem
    const problem = await this.selectPracticeProblem(session);

    return {
      type: 'question',
      content: `Here's a practice problem for you:\n\n${problem.question}\n\n` +
        `Take your time and let me know when you have an answer.`,
      hint: problem.hint,
      followUp: ['Need a hint?', 'Ready to check your answer?'],
      metadata: { problemId: problem.id, difficulty: problem.difficulty },
    };
  }

  private async selectPracticeProblem(
    session: TutoringSession
  ): Promise<PracticeProblem> {
    // Select problem based on mastery level and spaced repetition
    const difficulty = this.selectDifficulty(session.context.mastery);

    return {
      id: `problem-${Date.now()}`,
      question: `[Practice problem about ${session.topic} at ${difficulty} difficulty]`,
      answer: 'Answer',
      hint: 'Consider the key concept...',
      difficulty,
    };
  }

  private selectDifficulty(mastery: number): 'easy' | 'medium' | 'hard' {
    // Zone of proximal development - slightly above current level
    if (mastery < 0.4) return 'easy';
    if (mastery < 0.7) return 'medium';
    return 'hard';
  }

  // -------------------------------------------------------------------------
  // Sub-Agent: Emotion Reader
  // -------------------------------------------------------------------------

  private async assessEmotion(
    input: { message: string; context: SessionContext },
    context: AgentContext
  ): Promise<EmotionAssessment> {
    const { message, context: sessionContext } = input;

    // Analyze message for emotional indicators
    const indicators = this.analyzeEmotionalIndicators(message);

    // Consider context (previous struggles, hint usage)
    const contextualAdjustment = this.getContextualEmotionAdjustment(sessionContext);

    return {
      state: indicators.primary,
      confidence: indicators.confidence,
      factors: {
        textIndicators: indicators,
        hintsUsed: sessionContext.hintsUsed,
        recentCorrect: sessionContext.correctAnswers,
      },
    };
  }

  private analyzeEmotionalIndicators(message: string): {
    primary: EmotionalState;
    confidence: number;
  } {
    const frustrationWords = ['confused', "don't understand", "can't", 'stuck', 'help', 'hard', 'difficult'];
    const confidentWords = ['got it', 'understand', 'easy', 'makes sense', 'clear'];

    const lowerMessage = message.toLowerCase();

    if (frustrationWords.some(w => lowerMessage.includes(w))) {
      return { primary: 'frustrated', confidence: 0.8 };
    }

    if (confidentWords.some(w => lowerMessage.includes(w))) {
      return { primary: 'confident', confidence: 0.8 };
    }

    if (message.includes('?')) {
      return { primary: 'confused', confidence: 0.6 };
    }

    return { primary: 'neutral', confidence: 0.5 };
  }

  private getContextualEmotionAdjustment(context: SessionContext): number {
    // Higher hint usage suggests frustration
    const hintPenalty = Math.min(context.hintsUsed * 0.1, 0.3);
    
    // Correct answers boost confidence
    const correctBoost = (context.correctAnswers / Math.max(context.questionsAsked, 1)) * 0.2;

    return correctBoost - hintPenalty;
  }

  // -------------------------------------------------------------------------
  // Sub-Agent: Concept Mapper
  // -------------------------------------------------------------------------

  private async mapConcepts(
    input: { topic: string; session: TutoringSession },
    context: AgentContext
  ): Promise<ConceptMap> {
    const { topic, session } = input;

    // Get student's knowledge graph
    const graph = this.studentGraphs.get(session.studentId);
    
    // Find prerequisites and connections
    const prerequisites = await this.findPrerequisites(topic);
    const connections = await this.findConnections(topic);

    return {
      topic,
      prerequisites,
      connections,
      suggestedPath: graph?.getRecommendedPath(topic) || [],
      masteryLevels: this.getMasteryLevels(graph, [topic, ...prerequisites]),
    };
  }

  private async findPrerequisites(topic: string): Promise<string[]> {
    // Would query knowledge base in production
    return [`${topic} basics`, `intro to ${topic}`];
  }

  private async findConnections(topic: string): Promise<string[]> {
    // Would query knowledge base in production
    return [`advanced ${topic}`, `${topic} applications`];
  }

  private getMasteryLevels(
    graph: StudentKnowledgeGraph | undefined,
    topics: string[]
  ): Record<string, number> {
    const levels: Record<string, number> = {};
    for (const topic of topics) {
      levels[topic] = graph?.getMastery(topic) || 0;
    }
    return levels;
  }

  // -------------------------------------------------------------------------
  // Sub-Agent: Language Adapter
  // -------------------------------------------------------------------------

  private async adaptLanguage(
    input: { content: string; targetLanguage: string; session: TutoringSession },
    context: AgentContext
  ): Promise<{ content: string; language: string }> {
    const { content, targetLanguage } = input;

    // Would use translation/language model in production
    return {
      content: content, // Would be translated
      language: targetLanguage,
    };
  }

  // -------------------------------------------------------------------------
  // Knowledge Graph Management
  // -------------------------------------------------------------------------

  private async loadStudentGraph(studentId: string): Promise<void> {
    if (this.studentGraphs.has(studentId)) return;

    // Would load from database in production
    const graph = new StudentKnowledgeGraph(studentId);
    this.studentGraphs.set(studentId, graph);
  }

  private async updateStudentProgress(
    session: TutoringSession,
    metrics: SessionMetrics
  ): Promise<void> {
    const graph = this.studentGraphs.get(session.studentId);
    if (!graph || !session.topic) return;

    // Update mastery for the topic
    graph.updateMastery(session.topic, session.context.mastery);
  }

  // -------------------------------------------------------------------------
  // Utilities
  // -------------------------------------------------------------------------

  private generateGreeting(session: TutoringSession): string {
    const greetings = [
      `Hi! 👋 I'm your AI tutor. ${session.topic ? `Ready to explore ${session.topic}?` : 'What would you like to learn today?'}`,
      `Hello! Let's make learning fun. ${session.topic ? `We're studying ${session.topic} today.` : 'What topic interests you?'}`,
      `Welcome! 🎓 ${session.topic ? `Let's dive into ${session.topic}.` : "I'm here to help you learn. What shall we start with?"}`,
    ];
    return greetings[Math.floor(Math.random() * greetings.length)];
  }

  private generateEncouragement(session: TutoringSession): string {
    const encouragements = [
      "It's okay to find this challenging - that means you're learning! 💪",
      "Don't worry, everyone struggles at first. Let's break it down together.",
      "You're doing great by asking questions! That's how we learn.",
      "Remember, every expert was once a beginner. Let's try a different approach.",
    ];
    return encouragements[Math.floor(Math.random() * encouragements.length)];
  }

  private calculateSessionMetrics(session: TutoringSession): SessionMetrics {
    return {
      duration: (session.endedAt || Date.now()) - session.startedAt,
      messageCount: session.messages.length,
      questionsAsked: session.context.questionsAsked,
      correctAnswers: session.context.correctAnswers,
      hintsUsed: session.context.hintsUsed,
      masteryChange: session.context.mastery - 0.5, // Change from baseline
    };
  }

  private async updateProgressMetrics(): Promise<void> {
    // Update aggregate metrics for all active students
  }

  // -------------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------------

  async startSession(studentId: string, topic?: string): Promise<string> {
    const sessionId = randomUUID();
    await this.initializeSession({
      sessionId,
      studentId,
      topic,
      channel: 'web',
    });
    return sessionId;
  }

  async ask(sessionId: string, question: string): Promise<void> {
    const session = this.activeSessions.get(sessionId);
    if (!session) throw new Error('Session not found');

    await this.handleTutorRequest({
      sessionId,
      studentId: session.studentId,
      question,
      subject: session.topic?.split('/')[0] || 'general',
      topic: session.topic || 'general',
    });
  }

  getSession(sessionId: string): TutoringSession | undefined {
    return this.activeSessions.get(sessionId);
  }

  getActiveSessions(): number {
    return this.activeSessions.size;
  }
}

// ============================================================================
// Types
// ============================================================================

type SessionChannel = 'web' | 'app' | 'whatsapp' | 'telegram';
type ResponseStrategy = 'socratic' | 'explain' | 'solve' | 'practice' | 'encourage';
type UnderstandingLevel = 'novice' | 'developing' | 'proficient' | 'advanced' | 'unknown';
type EmotionalState = 'confident' | 'neutral' | 'confused' | 'frustrated';

interface TutoringSession {
  id: string;
  studentId: string;
  topic?: string;
  channel: SessionChannel;
  status: 'active' | 'paused' | 'completed';
  startedAt: number;
  endedAt?: number;
  lastActivityAt?: number;
  context: SessionContext;
  messages: SessionMessage[];
}

interface SessionContext {
  currentTopic?: string;
  difficulty: 'easy' | 'medium' | 'hard';
  mastery: number;
  emotionalState: EmotionalState;
  hintsUsed: number;
  questionsAsked: number;
  correctAnswers: number;
}

interface SessionMessage {
  role: 'student' | 'tutor' | 'system';
  content: string;
  timestamp: number;
  metadata?: Record<string, unknown>;
}

interface TutorResponse {
  type: 'greeting' | 'question' | 'explanation' | 'solution' | 'encouragement' | 'hint';
  content: string;
  hint?: string;
  steps?: string[];
  visuals?: string[];
  followUp?: string[];
  masteryChange?: number;
  metadata?: Record<string, unknown>;
}

interface EmotionAssessment {
  state: EmotionalState;
  confidence: number;
  factors: {
    textIndicators: { primary: EmotionalState; confidence: number };
    hintsUsed: number;
    recentCorrect: number;
  };
}

interface ConceptMap {
  topic: string;
  prerequisites: string[];
  connections: string[];
  suggestedPath: string[];
  masteryLevels: Record<string, number>;
}

interface PracticeProblem {
  id: string;
  question: string;
  answer: string;
  hint: string;
  difficulty: 'easy' | 'medium' | 'hard';
}

interface SessionMetrics {
  duration: number;
  messageCount: number;
  questionsAsked: number;
  correctAnswers: number;
  hintsUsed: number;
  masteryChange: number;
}

// ============================================================================
// Export
// ============================================================================

export { SAGE_CONFIG };
