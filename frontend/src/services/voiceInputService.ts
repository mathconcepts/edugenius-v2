/**
 * voiceInputService.ts — Web Speech API wrappers (no API key, no rate limit)
 * Falls back gracefully if browser doesn't support it.
 */

// ─── Type declarations ────────────────────────────────────────────────────────

// Use any for cross-browser SpeechRecognition compat
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SpeechRecognitionInstance = any;

// Local type aliases to avoid conflicts with browser lib.dom.d.ts
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SpeechRecognitionEventLocal = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SpeechRecognitionErrorEventLocal = any;

// ─── Voice input ─────────────────────────────────────────────────────────────

export interface VoiceSession {
  isListening: boolean;
  transcript: string;
  confidence: number;
  error?: string;
}

let recognition: SpeechRecognitionInstance | null = null;

export function isVoiceSupported(): boolean {
  return typeof window !== 'undefined' &&
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);
}

export function startListening(
  onResult: (transcript: string, isFinal: boolean) => void,
  onError: (err: string) => void,
  language = 'en-IN'
): void {
  if (!isVoiceSupported()) {
    onError('Voice input is not supported in this browser. Try Chrome or Edge.');
    return;
  }

  // Stop any existing session first
  recognition?.stop();

  const SR = window.SpeechRecognition ?? window.webkitSpeechRecognition;
  recognition = new SR();
  recognition.continuous = false;
  recognition.interimResults = true;
  recognition.lang = language;
  recognition.maxAlternatives = 1;

  recognition.onresult = (e: SpeechRecognitionEventLocal) => {
    const result = e.results[e.results.length - 1];
    onResult(result[0].transcript, result.isFinal);
  };

  recognition.onerror = (e: SpeechRecognitionErrorEventLocal) => {
    const msg = e.error === 'not-allowed'
      ? 'Microphone access denied. Please allow microphone access in your browser.'
      : `Voice error: ${e.error}`;
    onError(msg);
  };

  recognition.onend = () => {
    recognition = null;
  };

  recognition.start();
}

export function stopListening(): void {
  recognition?.stop();
  recognition = null;
}

// ─── Text-to-Speech ──────────────────────────────────────────────────────────

export function isTTSSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

export function speak(
  text: string,
  opts?: { rate?: number; pitch?: number; lang?: string }
): void {
  if (!isTTSSupported()) return;

  window.speechSynthesis.cancel();

  // Strip markdown syntax for cleaner TTS
  const cleanText = text
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/`(.+?)`/g, '$1')
    .replace(/#{1,6}\s/g, '')
    .replace(/\[(.+?)\]\(.+?\)/g, '$1')
    .slice(0, 800); // don't read huge responses

  const utter = new SpeechSynthesisUtterance(cleanText);
  utter.rate = opts?.rate ?? 0.95;
  utter.pitch = opts?.pitch ?? 1.0;
  utter.lang = opts?.lang ?? 'en-IN';

  // Pick best available voice
  const voices = window.speechSynthesis.getVoices();
  const preferred =
    voices.find(v => v.lang.startsWith('en') && v.name.includes('Google')) ??
    voices.find(v => v.lang.startsWith('en') && v.name.includes('Microsoft')) ??
    voices.find(v => v.lang.startsWith('en')) ??
    voices[0];
  if (preferred) utter.voice = preferred;

  window.speechSynthesis.speak(utter);
}

export function stopSpeaking(): void {
  if (isTTSSupported()) window.speechSynthesis.cancel();
}

export function isSpeaking(): boolean {
  return isTTSSupported() && window.speechSynthesis.speaking;
}

// ─── Mood detection from transcript ──────────────────────────────────────────

export type StudentMood = 'frustrated' | 'confused' | 'confident' | 'neutral';

export function getMoodFromText(text: string): StudentMood {
  const lower = text.toLowerCase();
  if (/don.t understand|confused|what\?|why\?|how\?|lost|stuck|no idea/.test(lower)) return 'confused';
  if (/ugh|stupid|hate|useless|give up|can.t|impossible|frustrated|annoyed/.test(lower)) return 'frustrated';
  if (/got it|understand|makes sense|easy|clear|i see|perfect|yes!/.test(lower)) return 'confident';
  return 'neutral';
}

/** Alias for getMoodFromText — used by Chat.tsx for mood-adaptive TTS. */
export const detectMoodFromText = getMoodFromText;
