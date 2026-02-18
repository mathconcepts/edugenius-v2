/**
 * useVoiceInput — Browser Web Speech API hook
 * Falls back gracefully when not supported
 */
import { useState, useRef, useCallback } from 'react';

export type VoiceState = 'idle' | 'listening' | 'processing' | 'error';

// Browser Speech API type declarations
declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognition;
    webkitSpeechRecognition: new () => SpeechRecognition;
  }
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  onstart: (() => void) | null;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
}

interface SpeechRecognitionEvent extends Event {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionResultList {
  length: number;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  isFinal: boolean;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
}

interface UseVoiceInputResult {
  state: VoiceState;
  transcript: string;
  isSupported: boolean;
  startListening: () => void;
  stopListening: () => void;
  reset: () => void;
  error: string | null;
}

export function useVoiceInput(onResult?: (transcript: string) => void): UseVoiceInputResult {
  const [state, setState] = useState<VoiceState>('idle');
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  const isSupported = typeof window !== 'undefined' &&
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);

  const startListening = useCallback(() => {
    if (!isSupported) {
      setError('Speech recognition not supported in this browser');
      setState('error');
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = 'en-IN'; // India English

    recognition.onstart = () => {
      setState('listening');
      setError(null);
      setTranscript('');
    };

    recognition.onresult = (event) => {
      let interim = '';
      let final = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          final += event.results[i][0].transcript;
        } else {
          interim += event.results[i][0].transcript;
        }
      }
      setTranscript(final || interim);
      if (final) {
        setState('processing');
        onResult?.(final.trim());
      }
    };

    recognition.onerror = (event) => {
      setError(event.error === 'not-allowed'
        ? 'Microphone access denied. Please allow microphone access.'
        : `Voice error: ${event.error}`);
      setState('error');
    };

    recognition.onend = () => {
      if (state !== 'error') setState('idle');
    };

    recognitionRef.current = recognition;
    recognition.start();
  }, [isSupported, onResult, state]);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    setState('idle');
  }, []);

  const reset = useCallback(() => {
    recognitionRef.current?.stop();
    setState('idle');
    setTranscript('');
    setError(null);
  }, []);

  return { state, transcript, isSupported, startListening, stopListening, reset, error };
}
