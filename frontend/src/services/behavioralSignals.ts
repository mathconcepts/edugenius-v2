/**
 * behavioralSignals.ts — Micro-behavioral signal capture
 *
 * Captures in-session behavioral signals that reveal cognitive state:
 *   - Typing velocity (fast = confident, very slow or very fast = anxiety)
 *   - Hesitation bursts (multiple backspaces = uncertainty)
 *   - Message length trends (getting shorter = fatigue/frustration)
 *   - Time-of-day (morning = fresh, late night = desperate)
 *   - Entry point (direct URL, practice miss, blog click-through)
 *   - Re-read rate (how many times student scrolls back to Sage's answer)
 *   - Response-to-reply latency (how fast they engage after Sage replies)
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface BehavioralSignals {
  // Typing behavior
  avgTypingSpeedWpm: number;         // words per minute this session
  hesitationBursts: number;          // count of pause-then-backspace events
  avgMessageLengthChars: number;     // trending down = fatigue
  messageLengthTrend: 'increasing' | 'stable' | 'decreasing';

  // Time signals
  hourOfDay: number;                 // 0–23 local
  dayOfWeek: number;                 // 0=Sun, 6=Sat
  studyTimePattern: 'morning_bird' | 'afternoon' | 'night_owl' | 'late_night_crisis';
  sessionStartedAt: Date;

  // Engagement signals
  avgResponseLatencyMs: number;      // how fast student replies after Sage responds
  rereadCount: number;               // proxy for confusion (scrolled back to Sage msg)
  sessionScrollDepth: number;        // 0–1 (how much of conversation reviewed)

  // Entry context
  entryPoint: 'direct' | 'practice_miss' | 'blog' | 'exam_page' | 'notification' | 'unknown';

  // Derived cognitive state
  cognitiveLoad: 'low' | 'medium' | 'high' | 'overloaded';
  confidenceSignal: 'high' | 'medium' | 'low' | 'unknown';
}

// ─── Internal tracker state ───────────────────────────────────────────────────

interface TrackerState {
  // Keystroke tracking
  keyTimestamps: number[];           // timestamps of all keystrokes
  backspaceAfterPause: number;       // hesitation burst count
  lastKeystrokeAt: number;
  lastKeystrokeWasChar: boolean;     // did previous keystroke add a char?
  pauseThreshold: number;            // ms gap that counts as "pause"

  // Message tracking
  messageLengths: number[];          // chars per sent message
  messageCount: number;

  // Latency tracking
  sageResponseReceivedAt: number;    // when Sage last finished responding
  replyLatencies: number[];          // ms from Sage-done to student-starts-typing

  // Scroll tracking
  rereadCount: number;
  maxScrollDepth: number;            // highest scrollback position seen (0–1)

  // Session
  sessionStartedAt: Date;
  entryPoint: BehavioralSignals['entryPoint'];
}

// ─── Helper: study time pattern ───────────────────────────────────────────────

/**
 * Maps hour-of-day to a study time archetype.
 * morning_bird: 5–10
 * afternoon: 10–17
 * night_owl: 17–23
 * late_night_crisis: 23–5
 */
export function getStudyTimePattern(hour: number): BehavioralSignals['studyTimePattern'] {
  if (hour >= 5 && hour < 10) return 'morning_bird';
  if (hour >= 10 && hour < 17) return 'afternoon';
  if (hour >= 17 && hour < 23) return 'night_owl';
  return 'late_night_crisis'; // 23–4:59
}

// ─── Cognitive load derivation ────────────────────────────────────────────────

/**
 * Derives cognitive load from behavioral signals.
 * High hesitation + slow replies + decreasing messages → overloaded.
 */
export function deriveCognitiveLoad(
  signals: Omit<BehavioralSignals, 'cognitiveLoad' | 'confidenceSignal'>
): BehavioralSignals['cognitiveLoad'] {
  let score = 0;

  // Hesitation bursts (each burst +1 point)
  if (signals.hesitationBursts >= 5) score += 2;
  else if (signals.hesitationBursts >= 2) score += 1;

  // Response latency — taking too long to reply signals confusion
  const latency = signals.avgResponseLatencyMs;
  if (latency > 60_000) score += 2;        // > 1 min: highly confused
  else if (latency > 30_000) score += 1;   // > 30s: struggling

  // Message length trend — getting shorter = fatigue
  if (signals.messageLengthTrend === 'decreasing') score += 1;

  // Late night or very short messages
  if (signals.studyTimePattern === 'late_night_crisis') score += 1;
  if (signals.avgMessageLengthChars < 15 && signals.avgTypingSpeedWpm < 20) score += 1;

  // Re-read count — scrolling back repeatedly = confused
  if (signals.rereadCount >= 3) score += 1;

  if (score >= 5) return 'overloaded';
  if (score >= 3) return 'high';
  if (score >= 1) return 'medium';
  return 'low';
}

// ─── Confidence signal derivation ────────────────────────────────────────────

/**
 * Derives confidence from typing speed, message length, and hesitation.
 * Fast typing + long messages + few hesitations → high confidence.
 */
export function deriveConfidenceSignal(
  signals: Omit<BehavioralSignals, 'cognitiveLoad' | 'confidenceSignal'>
): BehavioralSignals['confidenceSignal'] {
  // Not enough data
  if (signals.avgTypingSpeedWpm === 0 && signals.avgMessageLengthChars === 0) {
    return 'unknown';
  }

  let score = 0;

  // Typing speed heuristic
  // Very slow (<15 wpm) OR very fast (>80 wpm) can indicate anxiety
  // Sweet spot 30–65 wpm = confident
  const wpm = signals.avgTypingSpeedWpm;
  if (wpm >= 30 && wpm <= 65) score += 2;
  else if (wpm >= 15 && wpm < 30) score += 1;
  else if (wpm > 65) score += 1;  // fast but could be anxious/rushing

  // Message length — short messages with no context = less confident
  if (signals.avgMessageLengthChars >= 80) score += 2;
  else if (signals.avgMessageLengthChars >= 40) score += 1;

  // Low hesitation = confident
  if (signals.hesitationBursts === 0) score += 2;
  else if (signals.hesitationBursts <= 1) score += 1;

  if (score >= 5) return 'high';
  if (score >= 3) return 'medium';
  return 'low';
}

// ─── Entry point detection ────────────────────────────────────────────────────

function detectEntryPoint(): BehavioralSignals['entryPoint'] {
  if (typeof window === 'undefined') return 'unknown';

  const params = new URLSearchParams(window.location.search);
  const source = params.get('source') ?? params.get('utm_source') ?? '';
  const ref = document.referrer;

  if (source === 'practice' || params.get('from') === 'practice') return 'practice_miss';
  if (source === 'blog' || ref.includes('/blog')) return 'blog';
  if (source === 'exam' || params.get('from') === 'exam') return 'exam_page';
  if (source === 'notification' || source === 'push') return 'notification';
  if (ref === '' || ref === window.location.origin) return 'direct';

  return 'unknown';
}

// ─── Behavioral Tracker factory ───────────────────────────────────────────────

export interface BehavioralTracker {
  /** Called on every keydown in the input textarea */
  recordKeystroke(key: string, isBackspace: boolean): void;
  /** Called when student submits a message */
  recordMessageSent(text: string): void;
  /** Called when Sage finishes streaming its response */
  recordSageResponseReceived(): void;
  /** Called when student focuses the textarea after Sage responds */
  recordStudentReply(): void;
  /** Called on scroll events in the conversation container */
  recordScroll(scrollTop: number, scrollHeight: number, clientHeight: number): void;
  /** Returns current snapshot of behavioral signals */
  getSignals(): BehavioralSignals;
}

/**
 * Creates a stateful behavioral tracker for a single chat session.
 * Initialize once on session start (e.g., in a useRef).
 */
export function createBehavioralTracker(): BehavioralTracker {
  const state: TrackerState = {
    keyTimestamps: [],
    backspaceAfterPause: 0,
    lastKeystrokeAt: 0,
    lastKeystrokeWasChar: false,
    pauseThreshold: 1500,  // 1.5s gap = hesitation

    messageLengths: [],
    messageCount: 0,

    sageResponseReceivedAt: 0,
    replyLatencies: [],

    rereadCount: 0,
    maxScrollDepth: 0,

    sessionStartedAt: new Date(),
    entryPoint: detectEntryPoint(),
  };

  // Rolling window of keystroke timestamps for WPM calculation (last 60s)
  const WPM_WINDOW_MS = 60_000;
  const AVG_WORD_CHARS = 5; // average word length in chars

  function computeAvgTypingSpeedWpm(): number {
    const now = Date.now();
    const windowStart = now - WPM_WINDOW_MS;
    const recentKeys = state.keyTimestamps.filter((t) => t >= windowStart);
    if (recentKeys.length < 5) return 0; // not enough data

    // Chars / 5 = words; convert to per-minute rate
    const elapsedSeconds = (now - recentKeys[0]) / 1000;
    if (elapsedSeconds < 1) return 0;

    const charCount = recentKeys.length;
    const wordCount = charCount / AVG_WORD_CHARS;
    return Math.round((wordCount / elapsedSeconds) * 60);
  }

  function computeMessageLengthTrend(): BehavioralSignals['messageLengthTrend'] {
    if (state.messageLengths.length < 3) return 'stable';

    const recent = state.messageLengths.slice(-5); // last 5 messages
    const first = recent.slice(0, Math.ceil(recent.length / 2));
    const last = recent.slice(Math.floor(recent.length / 2));

    const firstAvg = first.reduce((s, n) => s + n, 0) / first.length;
    const lastAvg = last.reduce((s, n) => s + n, 0) / last.length;

    const ratio = lastAvg / Math.max(firstAvg, 1);
    if (ratio > 1.2) return 'increasing';
    if (ratio < 0.8) return 'decreasing';
    return 'stable';
  }

  function computeAvgResponseLatency(): number {
    if (state.replyLatencies.length === 0) return 0;
    return Math.round(
      state.replyLatencies.reduce((s, n) => s + n, 0) / state.replyLatencies.length
    );
  }

  return {
    recordKeystroke(key: string, isBackspace: boolean): void {
      const now = Date.now();
      const gap = now - state.lastKeystrokeAt;

      // Detect hesitation burst: pause > threshold followed by backspace
      if (isBackspace && gap > state.pauseThreshold && state.lastKeystrokeWasChar) {
        state.backspaceAfterPause++;
      }

      if (!isBackspace) {
        state.keyTimestamps.push(now);
        // Prune timestamps older than 2 minutes to keep memory low
        if (state.keyTimestamps.length > 500) {
          const cutoff = now - 120_000;
          state.keyTimestamps = state.keyTimestamps.filter((t) => t >= cutoff);
        }
      }

      state.lastKeystrokeAt = now;
      state.lastKeystrokeWasChar = !isBackspace;
    },

    recordMessageSent(text: string): void {
      state.messageLengths.push(text.length);
      state.messageCount++;
    },

    recordSageResponseReceived(): void {
      state.sageResponseReceivedAt = Date.now();
    },

    recordStudentReply(): void {
      if (state.sageResponseReceivedAt > 0) {
        const latency = Date.now() - state.sageResponseReceivedAt;
        if (latency > 0 && latency < 600_000) { // cap at 10 min to avoid stale data
          state.replyLatencies.push(latency);
          // Keep rolling window of last 20
          if (state.replyLatencies.length > 20) {
            state.replyLatencies.shift();
          }
        }
        state.sageResponseReceivedAt = 0; // reset until next Sage response
      }
    },

    recordScroll(scrollTop: number, scrollHeight: number, clientHeight: number): void {
      const maxScroll = scrollHeight - clientHeight;
      if (maxScroll <= 0) return;

      const currentDepth = 1 - scrollTop / maxScroll; // 1 = top (old msgs), 0 = bottom (new)

      // Track re-reads: student scrolled significantly upward
      if (currentDepth > 0.3 && state.maxScrollDepth < 0.3) {
        // Transitioned from near-bottom to upper portion = re-reading
        state.rereadCount++;
      }

      state.maxScrollDepth = Math.max(state.maxScrollDepth, currentDepth);
    },

    getSignals(): BehavioralSignals {
      const now = new Date();
      const hourOfDay = now.getHours();
      const dayOfWeek = now.getDay();

      const avgTypingSpeedWpm = computeAvgTypingSpeedWpm();
      const hesitationBursts = state.backspaceAfterPause;
      const avgMessageLengthChars = state.messageLengths.length > 0
        ? Math.round(state.messageLengths.reduce((s, n) => s + n, 0) / state.messageLengths.length)
        : 0;
      const messageLengthTrend = computeMessageLengthTrend();
      const studyTimePattern = getStudyTimePattern(hourOfDay);
      const avgResponseLatencyMs = computeAvgResponseLatency();
      const rereadCount = state.rereadCount;
      const sessionScrollDepth = state.maxScrollDepth;

      const partial: Omit<BehavioralSignals, 'cognitiveLoad' | 'confidenceSignal'> = {
        avgTypingSpeedWpm,
        hesitationBursts,
        avgMessageLengthChars,
        messageLengthTrend,
        hourOfDay,
        dayOfWeek,
        studyTimePattern,
        sessionStartedAt: state.sessionStartedAt,
        avgResponseLatencyMs,
        rereadCount,
        sessionScrollDepth,
        entryPoint: state.entryPoint,
      };

      return {
        ...partial,
        cognitiveLoad: deriveCognitiveLoad(partial),
        confidenceSignal: deriveConfidenceSignal(partial),
      };
    },
  };
}

// ─── Emotional State Inference ────────────────────────────────────────────────

export type EmotionalState = 'confident' | 'anxious' | 'frustrated' | 'motivated' | 'exhausted' | 'neutral';

/**
 * inferEmotionalStateFromSignals()
 *
 * Derives the student's emotional state from real-time behavioral signals.
 * Used by Chat.tsx to feed CustomerProfile.emotionalState, which then
 * drives Sage's tone and content presentation via contentFramework.
 *
 * Priority: behavioral signal > persona stored state
 */
export function inferEmotionalStateFromSignals(tracker: BehavioralTracker): EmotionalState {
  const signals = tracker.getSignals();

  const hesitations = signals.hesitationBursts ?? 0;
  const cogLoad = signals.cognitiveLoad ?? 'low';        // 'low'|'medium'|'high'|'overloaded'
  const confidence = signals.confidenceSignal ?? 'unknown'; // 'high'|'medium'|'low'|'unknown'
  const msgLenTrend = signals.messageLengthTrend ?? 'stable';
  const latencyMs = signals.avgResponseLatencyMs ?? 0;
  const isHighCog = cogLoad === 'high' || cogLoad === 'overloaded';
  const isMedCog  = cogLoad === 'medium' || isHighCog;

  // Exhausted: cognitive load maxed + very slow responses + short messages
  if (cogLoad === 'overloaded' && latencyMs > 15000 && msgLenTrend === 'decreasing') return 'exhausted';

  // Frustrated: high hesitation + high backspace + declining message length
  if (hesitations >= 5 && msgLenTrend === 'decreasing') return 'frustrated';
  if (hesitations >= 3 && isHighCog) return 'frustrated';

  // Anxious: moderate hesitation + high cognitive load + fast responses (panic)
  if (hesitations >= 3 && latencyMs < 3000 && isMedCog) return 'anxious';

  // Confident: low hesitation + high confidence signal
  if (hesitations === 0 && confidence === 'high') return 'confident';
  if (hesitations <= 1 && (confidence === 'high' || confidence === 'medium') && msgLenTrend === 'stable') return 'motivated';

  return 'neutral';
}
