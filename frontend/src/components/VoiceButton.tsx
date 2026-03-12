/**
 * VoiceButton — mic button for Chat.tsx input area
 * - Pulse animation while listening
 * - Interim transcript shows as placeholder
 * - Final transcript → auto-submit
 * - Only renders when voiceInputEnabled === true
 */
import { useState, useCallback } from 'react';
import { Mic, MicOff, Volume2 } from 'lucide-react';
import { clsx } from 'clsx';
import { useAppStore } from '@/stores/appStore';
import {
  isVoiceSupported,
  startListening,
  stopListening,
  isSpeaking,
  stopSpeaking,
} from '@/services/voiceInputService';

interface VoiceButtonProps {
  onTranscript: (text: string) => void; // called with final transcript
  onInterim?: (text: string) => void;   // called with interim transcript
  disabled?: boolean;
  className?: string;
}

export function VoiceButton({ onTranscript, onInterim, disabled, className }: VoiceButtonProps) {
  const voiceInputEnabled = useAppStore(s => s.voiceInputEnabled);
  const voiceTTSEnabled = useAppStore(s => s.voiceTTSEnabled);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const supported = isVoiceSupported();

  const handleClick = useCallback(() => {
    // If TTS is playing, stop it first
    if (voiceTTSEnabled && isSpeaking()) {
      stopSpeaking();
      return;
    }

    if (listening) {
      stopListening();
      setListening(false);
      return;
    }

    if (!supported) {
      setError('Voice not supported in this browser');
      return;
    }

    setError(null);
    setListening(true);

    startListening(
      (transcript, isFinal) => {
        if (isFinal) {
          setListening(false);
          onTranscript(transcript.trim());
        } else {
          onInterim?.(transcript);
        }
      },
      (err) => {
        setError(err);
        setListening(false);
      }
    );
  }, [listening, supported, onTranscript, onInterim, voiceTTSEnabled]);

  // Don't render if voice input is disabled
  if (!voiceInputEnabled) return null;

  const isTTSActive = voiceTTSEnabled && isSpeaking();

  return (
    <div className="relative">
      <button
        type="button"
        onClick={handleClick}
        disabled={disabled || (!supported)}
        title={
          !supported ? 'Voice not supported in this browser'
          : listening ? 'Click to stop listening'
          : isTTSActive ? 'Click to stop speaking'
          : 'Click to speak'
        }
        className={clsx(
          'relative flex items-center justify-center w-9 h-9 rounded-full transition-all',
          listening
            ? 'bg-red-500 hover:bg-red-400 text-white'
            : isTTSActive
            ? 'bg-blue-500 hover:bg-blue-400 text-white'
            : 'bg-surface-700 hover:bg-surface-600 text-surface-300 hover:text-white',
          (disabled || !supported) && 'opacity-40 cursor-not-allowed',
          className
        )}
      >
        {/* Pulse ring while listening */}
        {listening && (
          <span className="absolute inset-0 rounded-full bg-red-500 animate-ping opacity-40" />
        )}

        {isTTSActive ? (
          <Volume2 className="w-4 h-4" />
        ) : listening ? (
          <MicOff className="w-4 h-4" />
        ) : (
          <Mic className="w-4 h-4" />
        )}
      </button>

      {/* Error tooltip */}
      {error && (
        <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 w-48 bg-red-900 border border-red-700 text-red-200 text-xs rounded-lg px-3 py-2 text-center z-50">
          {error}
        </div>
      )}
    </div>
  );
}
