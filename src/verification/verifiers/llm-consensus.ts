/**
 * LLM Consensus Verifier
 * Verify content by asking multiple LLMs and checking for agreement
 */

import type {
  Verifier,
  VerifierConfig,
  VerificationCheck,
  ContentType,
  VerificationContext,
  VerificationStatus,
} from '../types';
import { providerRegistry, type ProviderInstance } from '../../llm/providers/registry';

interface ConsensusConfig {
  minProviders: number;          // Minimum providers to query
  maxProviders: number;          // Maximum providers to query
  consensusThreshold: number;    // Percentage agreement required (0-1)
  useVerificationPrompt: boolean;
  shuffleProviders: boolean;     // Randomize provider order
  excludeOriginal: boolean;      // Exclude provider that generated content
  temperature: number;           // Use low temperature for consistency
}

interface LLMResponse {
  provider: string;
  model: string;
  answer: string;
  confidence: number;
  reasoning?: string;
}

export class LLMConsensusVerifier implements Verifier {
  id: 'llm_consensus' = 'llm_consensus';
  name = 'LLM Consensus';
  supportedContentTypes: ContentType[] = [
    'math_expression',
    'math_solution',
    'scientific_fact',
    'formula',
    'definition',
    'physics',
    'chemistry',
    'biology',
    'general',
  ];
  
  private config: ConsensusConfig | null = null;
  
  async initialize(config: VerifierConfig): Promise<void> {
    this.config = {
      minProviders: config.config.minProviders || 2,
      maxProviders: config.config.maxProviders || 4,
      consensusThreshold: config.config.consensusThreshold || 0.7,
      useVerificationPrompt: config.config.useVerificationPrompt ?? true,
      shuffleProviders: config.config.shuffleProviders ?? true,
      excludeOriginal: config.config.excludeOriginal ?? false,
      temperature: config.config.temperature || 0.1,
    };
  }
  
  async checkHealth(): Promise<boolean> {
    const providers = providerRegistry.getEnabledProviders();
    return providers.length >= (this.config?.minProviders || 2);
  }
  
  async verify(
    content: string,
    contentType: ContentType,
    context?: VerificationContext
  ): Promise<VerificationCheck> {
    const startTime = Date.now();
    
    if (!this.config) {
      return {
        verifier: 'llm_consensus',
        status: 'inconclusive',
        confidence: 0,
        details: 'LLM Consensus verifier not configured',
        timestamp: new Date(),
        durationMs: Date.now() - startTime,
      };
    }
    
    try {
      // Get available providers
      let providers = providerRegistry.getEnabledProviders();
      
      if (providers.length < this.config.minProviders) {
        return {
          verifier: 'llm_consensus',
          status: 'inconclusive',
          confidence: 0,
          details: `Need at least ${this.config.minProviders} providers, only ${providers.length} available`,
          timestamp: new Date(),
          durationMs: Date.now() - startTime,
        };
      }
      
      // Shuffle if configured
      if (this.config.shuffleProviders) {
        providers = this.shuffle([...providers]);
      }
      
      // Limit to max providers
      providers = providers.slice(0, this.config.maxProviders);
      
      // Build verification prompt
      const prompt = this.buildVerificationPrompt(content, contentType, context);
      
      // Query all providers in parallel
      const responses = await Promise.all(
        providers.map(p => this.queryProvider(p, prompt))
      );
      
      // Filter successful responses
      const validResponses = responses.filter(r => r !== null) as LLMResponse[];
      
      if (validResponses.length < this.config.minProviders) {
        return {
          verifier: 'llm_consensus',
          status: 'inconclusive',
          confidence: 0,
          details: `Only ${validResponses.length} providers responded successfully`,
          rawResponse: validResponses,
          timestamp: new Date(),
          durationMs: Date.now() - startTime,
        };
      }
      
      // Analyze consensus
      const result = this.analyzeConsensus(validResponses, content, contentType);
      
      return {
        verifier: 'llm_consensus',
        status: result.status,
        confidence: result.confidence,
        details: result.details,
        rawResponse: validResponses,
        timestamp: new Date(),
        durationMs: Date.now() - startTime,
      };
    } catch (error) {
      return {
        verifier: 'llm_consensus',
        status: 'inconclusive',
        confidence: 0,
        details: `Consensus verification error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: new Date(),
        durationMs: Date.now() - startTime,
      };
    }
  }
  
  async getSuggestion(content: string, check: VerificationCheck): Promise<string | null> {
    const responses = check.rawResponse as LLMResponse[] | undefined;
    if (!responses?.length) return null;
    
    // Return the most common answer
    const answerCounts = new Map<string, number>();
    for (const r of responses) {
      const normalized = this.normalizeAnswer(r.answer);
      answerCounts.set(normalized, (answerCounts.get(normalized) || 0) + 1);
    }
    
    let mostCommon = '';
    let maxCount = 0;
    for (const [answer, count] of answerCounts) {
      if (count > maxCount) {
        mostCommon = answer;
        maxCount = count;
      }
    }
    
    // Find original answer for this normalized form
    const original = responses.find(r => 
      this.normalizeAnswer(r.answer) === mostCommon
    );
    
    return original?.answer || null;
  }
  
  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================
  
  private buildVerificationPrompt(
    content: string,
    contentType: ContentType,
    context?: VerificationContext
  ): string {
    const contentTypeLabels: Record<ContentType, string> = {
      math_expression: 'mathematical expression',
      math_solution: 'mathematical solution',
      scientific_fact: 'scientific fact',
      formula: 'formula',
      definition: 'definition',
      code: 'code',
      chemistry: 'chemistry content',
      physics: 'physics content',
      biology: 'biology content',
      general: 'content',
    };
    
    let prompt = `You are a verification assistant. Your task is to verify the following ${contentTypeLabels[contentType]}.

CONTENT TO VERIFY:
${content}

`;

    if (context?.sourceContent) {
      prompt += `ORIGINAL QUESTION/PROMPT:
${context.sourceContent}

`;
    }

    if (context?.expectedAnswer) {
      prompt += `EXPECTED ANSWER:
${context.expectedAnswer}

`;
    }

    prompt += `INSTRUCTIONS:
1. Determine if the content is CORRECT, INCORRECT, or UNCERTAIN
2. If it's a solution, work through it step by step to verify
3. Provide your confidence level (high/medium/low)
4. If incorrect, explain what's wrong

RESPOND IN THIS EXACT FORMAT:
VERDICT: [CORRECT/INCORRECT/UNCERTAIN]
CONFIDENCE: [HIGH/MEDIUM/LOW]
CORRECT_ANSWER: [your computed answer if applicable]
REASONING: [brief explanation]`;

    return prompt;
  }
  
  private async queryProvider(
    provider: ProviderInstance,
    prompt: string
  ): Promise<LLMResponse | null> {
    try {
      const model = provider.definition.models[0]; // Use first available model
      
      const result = await provider.adapter.generate({
        prompt,
        model: model.id,
        temperature: this.config?.temperature || 0.1,
        maxTokens: 500,
      });
      
      // Parse the response
      const parsed = this.parseVerificationResponse(result.text);
      
      return {
        provider: provider.definition.id,
        model: model.id,
        answer: parsed.verdict,
        confidence: parsed.confidenceScore,
        reasoning: parsed.reasoning,
      };
    } catch (error) {
      console.warn(`Provider ${provider.definition.id} failed:`, error);
      return null;
    }
  }
  
  private parseVerificationResponse(text: string): {
    verdict: string;
    confidenceScore: number;
    correctAnswer?: string;
    reasoning?: string;
  } {
    const lines = text.split('\n');
    let verdict = 'UNCERTAIN';
    let confidence = 'LOW';
    let correctAnswer: string | undefined;
    let reasoning: string | undefined;
    
    for (const line of lines) {
      const upper = line.toUpperCase();
      if (upper.startsWith('VERDICT:')) {
        verdict = line.split(':')[1]?.trim().toUpperCase() || 'UNCERTAIN';
      } else if (upper.startsWith('CONFIDENCE:')) {
        confidence = line.split(':')[1]?.trim().toUpperCase() || 'LOW';
      } else if (upper.startsWith('CORRECT_ANSWER:')) {
        correctAnswer = line.split(':').slice(1).join(':').trim();
      } else if (upper.startsWith('REASONING:')) {
        reasoning = line.split(':').slice(1).join(':').trim();
      }
    }
    
    const confidenceMap: Record<string, number> = {
      'HIGH': 0.9,
      'MEDIUM': 0.6,
      'LOW': 0.3,
    };
    
    return {
      verdict,
      confidenceScore: confidenceMap[confidence] || 0.5,
      correctAnswer,
      reasoning,
    };
  }
  
  private analyzeConsensus(
    responses: LLMResponse[],
    content: string,
    contentType: ContentType
  ): { status: VerificationStatus; confidence: number; details: string } {
    const verdictCounts = new Map<string, number>();
    let totalConfidence = 0;
    
    for (const r of responses) {
      const normalized = this.normalizeVerdict(r.answer);
      verdictCounts.set(normalized, (verdictCounts.get(normalized) || 0) + 1);
      totalConfidence += r.confidence;
    }
    
    const avgConfidence = totalConfidence / responses.length;
    const total = responses.length;
    
    // Find dominant verdict
    let dominantVerdict = 'UNCERTAIN';
    let maxCount = 0;
    for (const [verdict, count] of verdictCounts) {
      if (count > maxCount) {
        dominantVerdict = verdict;
        maxCount = count;
      }
    }
    
    const agreement = maxCount / total;
    const meetsThreshold = agreement >= (this.config?.consensusThreshold || 0.7);
    
    // Determine status
    let status: VerificationStatus;
    let confidence: number;
    let details: string;
    
    if (meetsThreshold && dominantVerdict === 'CORRECT') {
      status = 'verified';
      confidence = avgConfidence * agreement;
      details = `${maxCount}/${total} LLMs agree content is correct (${(agreement * 100).toFixed(0)}% consensus)`;
    } else if (meetsThreshold && dominantVerdict === 'INCORRECT') {
      status = 'failed';
      confidence = avgConfidence * agreement;
      details = `${maxCount}/${total} LLMs agree content is incorrect (${(agreement * 100).toFixed(0)}% consensus)`;
    } else if (agreement >= 0.5) {
      status = 'partial';
      confidence = avgConfidence * agreement;
      details = `Partial consensus: ${maxCount}/${total} LLMs lean ${dominantVerdict.toLowerCase()}`;
    } else {
      status = 'inconclusive';
      confidence = avgConfidence * 0.5;
      details = `No consensus reached: LLMs disagree on verification`;
    }
    
    return { status, confidence, details };
  }
  
  private normalizeVerdict(verdict: string): string {
    const upper = verdict.toUpperCase().trim();
    if (upper.includes('CORRECT') && !upper.includes('INCORRECT')) return 'CORRECT';
    if (upper.includes('INCORRECT') || upper.includes('WRONG') || upper.includes('FALSE')) return 'INCORRECT';
    return 'UNCERTAIN';
  }
  
  private normalizeAnswer(answer: string): string {
    return answer.toLowerCase().replace(/\s+/g, ' ').trim();
  }
  
  private shuffle<T>(array: T[]): T[] {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }
}

export default LLMConsensusVerifier;
