/**
 * multilingualService.ts — Language configuration for Sage
 * CEO/Admin: appStore.multilingualEnabled + sageLanguage
 * No API calls — provides prompt instructions and UI labels only.
 */

export interface Language {
  code: string;     // BCP-47
  name: string;     // English name
  nativeName: string;
  flag: string;
  examRelevance: string[];
}

export const SUPPORTED_LANGUAGES: Language[] = [
  { code: 'en-IN', name: 'English (India)', nativeName: 'English', flag: '🇮🇳', examRelevance: ['GATE', 'CAT', 'JEE', 'NEET'] },
  { code: 'hi-IN', name: 'Hindi', nativeName: 'हिन्दी', flag: '🇮🇳', examRelevance: ['GATE', 'JEE', 'NEET'] },
  { code: 'te-IN', name: 'Telugu', nativeName: 'తెలుగు', flag: '🇮🇳', examRelevance: ['GATE', 'JEE'] },
  { code: 'ta-IN', name: 'Tamil', nativeName: 'தமிழ்', flag: '🇮🇳', examRelevance: ['GATE', 'JEE'] },
  { code: 'kn-IN', name: 'Kannada', nativeName: 'ಕನ್ನಡ', flag: '🇮🇳', examRelevance: ['GATE', 'JEE'] },
  { code: 'mr-IN', name: 'Marathi', nativeName: 'मराठी', flag: '🇮🇳', examRelevance: ['GATE', 'JEE'] },
  { code: 'bn-IN', name: 'Bengali', nativeName: 'বাংলা', flag: '🇮🇳', examRelevance: ['GATE', 'JEE'] },
  { code: 'gu-IN', name: 'Gujarati', nativeName: 'ગુજરાતી', flag: '🇮🇳', examRelevance: ['CAT', 'JEE'] },
];

export function getLanguageByCode(code: string): Language {
  return SUPPORTED_LANGUAGES.find(l => l.code === code) ?? SUPPORTED_LANGUAGES[0];
}

/**
 * Returns a Sage prompt injection for the selected language.
 * English technical terms are always used, but explanations are in the target language.
 */
export function getLanguageInstruction(langCode: string): string {
  if (langCode === 'en-IN' || langCode === 'en') return '';

  const lang = getLanguageByCode(langCode);
  return `LANGUAGE INSTRUCTION: The student prefers explanations in ${lang.name} (${lang.nativeName}). 
Respond in ${lang.nativeName} for all explanations, analogies, and examples. 
However, keep all mathematical formulas, technical terms, and notation in English (e.g., "EMF = -dΦ/dt", "O(n log n)", "P(A|B)").
Use natural code-switching: introduce technical terms in English but explain their meaning in ${lang.nativeName}.
Make analogies culturally relevant to India.`;
}

/**
 * Returns culturally adapted analogy suggestions for a given language
 */
export function getCulturalContext(langCode: string): string {
  const contexts: Record<string, string> = {
    'hi-IN': 'Use Hindi cultural references: cricket, monsoon, train journeys, chai, farming when making analogies.',
    'te-IN': 'Use Telugu cultural references: rice farming in delta regions, Godavari river, local festivals.',
    'ta-IN': 'Use Tamil cultural references: temple architecture, classical music (Carnatic), fishing communities.',
    'kn-IN': 'Use Kannada cultural references: Kaveri river, silk farming, IT parks in Bangalore.',
  };
  return contexts[langCode] ?? '';
}

export function getSageLanguagePrompt(langCode: string): string {
  const instruction = getLanguageInstruction(langCode);
  const cultural = getCulturalContext(langCode);
  return [instruction, cultural].filter(Boolean).join('\n');
}
