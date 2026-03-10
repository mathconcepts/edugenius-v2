/**
 * voiceSkill.ts — Text-to-Speech for Sage explanations + Mentor messages
 * VoltAgent pattern: Voice output with ElevenLabs or OpenAI TTS.
 *
 * Use cases:
 *   - Sage: read out formula explanations (for students studying away from screen)
 *   - Mentor: send voice note encouragement via WhatsApp/Telegram
 *   - Atlas: pronunciation of difficult scientific terms
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export type VoiceProvider = 'elevenlabs' | 'openai_tts' | 'browser_tts';
export type VoiceStyle = 'tutor' | 'mentor' | 'narrator' | 'energetic';

export interface VoiceConfig {
  provider: VoiceProvider;
  voiceId?: string;           // ElevenLabs voice ID
  model?: string;             // OpenAI model e.g. "tts-1-hd"
  speed?: number;             // 0.5–2.0
  style?: VoiceStyle;
}

export interface VoiceResult {
  audioUrl?: string;          // blob URL or data URL (null for browser TTS)
  transcript: string;         // what was spoken (cleaned text)
  provider: VoiceProvider;
  durationEstimateSec: number; // word count / 2.5 WPM (rough estimate)
  error?: string;
}

// ─── ElevenLabs voice IDs by style ───────────────────────────────────────────

const ELEVENLABS_VOICES: Record<VoiceStyle, string> = {
  tutor:      'pNInz6obpgDQGcFmaJgB', // Adam — clear, authoritative
  mentor:     'EXAVITQu4vr4xnSDxMaL', // Bella — warm, encouraging
  narrator:   'VR6AewLTigWG4xSOukaG', // Arnold — deep, clear
  energetic:  'yoZ06aMxZJJ28mfd3POQ', // Sam — youthful, energetic
};

// ─── Text preparation ─────────────────────────────────────────────────────────

/**
 * Prepare text for speech synthesis:
 * - Strips markdown formatting
 * - Converts LaTeX/math symbols to verbal descriptions
 * - Expands common abbreviations
 */
export function prepareTextForSpeech(text: string): string {
  let result = text;

  // ── Strip markdown ────────────────────────────────────────────────────────
  result = result
    .replace(/\*\*(.+?)\*\*/g, '$1')       // **bold**
    .replace(/\*(.+?)\*/g, '$1')             // *italic*
    .replace(/_{1,2}(.+?)_{1,2}/g, '$1')    // _underline_ / __bold__
    .replace(/#{1,6}\s+/g, '')               // ### headers
    .replace(/```[\s\S]*?```/g, '')          // code blocks (skip, not speakable)
    .replace(/`(.+?)`/g, '$1')               // inline code
    .replace(/\[(.+?)\]\((.+?)\)/g, '$1')   // [link](url) → link text
    .replace(/^\s*[-*+]\s+/gm, '')           // unordered list markers
    .replace(/^\s*\d+\.\s+/gm, '')           // ordered list markers
    .replace(/\n{3,}/g, '\n\n');             // collapse multiple newlines

  // ── Math symbols → verbal descriptions ───────────────────────────────────
  const mathReplacements: [RegExp, string][] = [
    [/∫/g, 'integral of '],
    [/∂/g, 'partial derivative of '],
    [/∑/g, 'sum of '],
    [/∏/g, 'product of '],
    [/√/g, 'square root of '],
    [/∞/g, 'infinity'],
    [/≤/g, 'less than or equal to'],
    [/≥/g, 'greater than or equal to'],
    [/≠/g, 'not equal to'],
    [/≈/g, 'approximately equal to'],
    [/→/g, 'implies'],
    [/⟹/g, 'implies'],
    [/↔/g, 'if and only if'],
    [/∈/g, 'is in'],
    [/∉/g, 'is not in'],
    [/∩/g, 'intersection'],
    [/∪/g, 'union'],
    [/×/g, 'times'],
    [/÷/g, 'divided by'],
    [/±/g, 'plus or minus'],
    [/α/g, 'alpha'], [/β/g, 'beta'], [/γ/g, 'gamma'],
    [/δ/g, 'delta'], [/ε/g, 'epsilon'], [/θ/g, 'theta'],
    [/λ/g, 'lambda'], [/μ/g, 'mu'], [/π/g, 'pi'],
    [/σ/g, 'sigma'], [/τ/g, 'tau'], [/φ/g, 'phi'],
    [/ω/g, 'omega'], [/Ω/g, 'Omega'], [/Δ/g, 'Delta'],
    [/Σ/g, 'Sigma'], [/Π/g, 'Pi'], [/Λ/g, 'Lambda'],
  ];

  for (const [pattern, replacement] of mathReplacements) {
    result = result.replace(pattern, replacement);
  }

  // ── Superscript/subscript patterns ────────────────────────────────────────
  // e.g. "v²" → "v squared", "v³" → "v cubed"
  result = result
    .replace(/(\w)²/g, '$1 squared')
    .replace(/(\w)³/g, '$1 cubed')
    .replace(/(\w)\^(\d+)/g, '$1 to the power $2')
    .replace(/(\w)_(\w+)/g, '$1 sub $2');

  // ── Common equation patterns ──────────────────────────────────────────────
  // e.g. "v² = u² + 2as" → "v squared equals u squared plus 2 a s"
  result = result.replace(/([a-zA-Z0-9]+)\s*=\s*/g, '$1 equals ');

  // ── Abbreviation expansion ────────────────────────────────────────────────
  const abbreviations: Record<string, string> = {
    'MCQ':  'multiple choice question',
    'MCQs': 'multiple choice questions',
    'JEE':  'Joint Entrance Examination',
    'NEET': 'National Eligibility cum Entrance Test',
    'GATE': 'Graduate Aptitude Test in Engineering',
    'CAT':  'Common Admission Test',
    'CBSE': 'Central Board of Secondary Education',
    'UPSC': 'Union Public Service Commission',
    'IIT':  'Indian Institute of Technology',
    'NIT':  'National Institute of Technology',
    'EMF':  'electromotive force',
    'AC':   'alternating current',
    'DC':   'direct current',
    'RMS':  'root mean square',
    'LHS':  'left hand side',
    'RHS':  'right hand side',
    'SHM':  'simple harmonic motion',
    'KE':   'kinetic energy',
    'PE':   'potential energy',
    'RK':   'Runge Kutta',
  };

  for (const [abbr, expansion] of Object.entries(abbreviations)) {
    result = result.replace(new RegExp(`\\b${abbr}\\b`, 'g'), expansion);
  }

  // ── Emoji removal (not speakable) ─────────────────────────────────────────
  result = result.replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '');

  // ── Clean up whitespace ───────────────────────────────────────────────────
  result = result.replace(/\s{2,}/g, ' ').trim();

  return result;
}

// ─── Configuration ────────────────────────────────────────────────────────────

/**
 * Returns the best available voice config based on configured API keys.
 * Falls back gracefully: ElevenLabs → OpenAI TTS → Browser TTS.
 */
export function getDefaultVoiceConfig(): VoiceConfig {
  try {
    const { getKey } = require('../connectionBridge');

    // Check ElevenLabs
    const elevenLabsKey = getKey('elevenlabs');
    if (elevenLabsKey) {
      return {
        provider: 'elevenlabs',
        voiceId: ELEVENLABS_VOICES.tutor,
        speed: 1.0,
        style: 'tutor',
      };
    }

    // Check OpenAI
    const openAiKey = getKey('openai');
    if (openAiKey) {
      return {
        provider: 'openai_tts',
        model: 'tts-1-hd',
        speed: 1.0,
        style: 'tutor',
      };
    }
  } catch { /* connectionBridge not available */ }

  // Default: browser TTS
  return { provider: 'browser_tts', speed: 1.0, style: 'tutor' };
}

export function isSpeechAvailable(): boolean {
  if (typeof window === 'undefined') return false;
  if ('speechSynthesis' in window) return true;
  const config = getDefaultVoiceConfig();
  return config.provider !== 'browser_tts';
}

export function canUsePremiumVoice(): boolean {
  const config = getDefaultVoiceConfig();
  return config.provider === 'elevenlabs' || config.provider === 'openai_tts';
}

// ─── Browser TTS ──────────────────────────────────────────────────────────────

/**
 * Speak using the Web Speech API — always available, no API key needed.
 */
export function speakWithBrowser(text: string, rate = 1.0): void {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    console.warn('[voiceSkill] speechSynthesis not available');
    return;
  }

  // Cancel any ongoing speech
  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = Math.max(0.5, Math.min(2.0, rate));
  utterance.pitch = 1.0;
  utterance.volume = 1.0;

  // Prefer a clear English voice
  const voices = window.speechSynthesis.getVoices();
  const preferred = voices.find(v =>
    v.name.includes('Google UK English Female') ||
    v.name.includes('Google UK English Male') ||
    v.name.includes('Karen') ||
    v.name.includes('Daniel') ||
    (v.lang.startsWith('en') && v.localService)
  );
  if (preferred) utterance.voice = preferred;

  window.speechSynthesis.speak(utterance);
}

// ─── Core speak function ──────────────────────────────────────────────────────

/**
 * Main entry point for voice output.
 * Priority: ElevenLabs → OpenAI TTS → Browser TTS
 */
export async function speak(text: string, config?: Partial<VoiceConfig>): Promise<VoiceResult> {
  const cleanText = prepareTextForSpeech(text);
  const wordCount = cleanText.split(/\s+/).length;
  const durationEstimateSec = Math.round(wordCount / 2.5);

  const resolvedConfig: VoiceConfig = { ...getDefaultVoiceConfig(), ...config };

  // ── Browser TTS (fallback/default) ────────────────────────────────────────
  if (resolvedConfig.provider === 'browser_tts') {
    speakWithBrowser(cleanText, resolvedConfig.speed);
    return {
      audioUrl: undefined, // browser TTS has no blob URL
      transcript: cleanText,
      provider: 'browser_tts',
      durationEstimateSec,
    };
  }

  // ── ElevenLabs ────────────────────────────────────────────────────────────
  if (resolvedConfig.provider === 'elevenlabs') {
    try {
      const { getKey } = await import('../connectionBridge');
      const apiKey = getKey('elevenlabs');
      if (!apiKey) throw new Error('ElevenLabs API key not configured');

      const voiceId = resolvedConfig.voiceId ??
        ELEVENLABS_VOICES[resolvedConfig.style ?? 'tutor'];

      const response = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
        {
          method: 'POST',
          headers: {
            'xi-api-key': apiKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            text: cleanText,
            model_id: 'eleven_multilingual_v2',
            voice_settings: {
              stability: 0.5,
              similarity_boost: 0.8,
              speed: resolvedConfig.speed ?? 1.0,
            },
          }),
        }
      );

      if (!response.ok) throw new Error(`ElevenLabs error: ${response.statusText}`);

      const audioBuffer = await response.arrayBuffer();
      const blob = new Blob([audioBuffer], { type: 'audio/mpeg' });
      const audioUrl = URL.createObjectURL(blob);

      return { audioUrl, transcript: cleanText, provider: 'elevenlabs', durationEstimateSec };
    } catch (err) {
      // Fall back to browser TTS
      speakWithBrowser(cleanText, resolvedConfig.speed);
      return {
        audioUrl: undefined,
        transcript: cleanText,
        provider: 'browser_tts',
        durationEstimateSec,
        error: err instanceof Error ? err.message : 'ElevenLabs failed',
      };
    }
  }

  // ── OpenAI TTS ────────────────────────────────────────────────────────────
  if (resolvedConfig.provider === 'openai_tts') {
    try {
      const { getKey } = await import('../connectionBridge');
      const apiKey = getKey('openai');
      if (!apiKey) throw new Error('OpenAI API key not configured');

      const voiceMap: Record<VoiceStyle, string> = {
        tutor:     'echo',
        mentor:    'nova',
        narrator:  'onyx',
        energetic: 'shimmer',
      };
      const voice = voiceMap[resolvedConfig.style ?? 'tutor'];

      const response = await fetch('https://api.openai.com/v1/audio/speech', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: resolvedConfig.model ?? 'tts-1-hd',
          input: cleanText.slice(0, 4096), // OpenAI limit
          voice,
          speed: resolvedConfig.speed ?? 1.0,
        }),
      });

      if (!response.ok) throw new Error(`OpenAI TTS error: ${response.statusText}`);

      const audioBuffer = await response.arrayBuffer();
      const blob = new Blob([audioBuffer], { type: 'audio/mpeg' });
      const audioUrl = URL.createObjectURL(blob);

      return { audioUrl, transcript: cleanText, provider: 'openai_tts', durationEstimateSec };
    } catch (err) {
      // Fall back to browser TTS
      speakWithBrowser(cleanText, resolvedConfig.speed);
      return {
        audioUrl: undefined,
        transcript: cleanText,
        provider: 'browser_tts',
        durationEstimateSec,
        error: err instanceof Error ? err.message : 'OpenAI TTS failed',
      };
    }
  }

  // Final fallback
  speakWithBrowser(cleanText);
  return { audioUrl: undefined, transcript: cleanText, provider: 'browser_tts', durationEstimateSec };
}
