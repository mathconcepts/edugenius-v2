// @ts-nocheck
/**
 * Wolfram Alpha Verifier
 * Verify mathematical and scientific content against Wolfram Alpha
 */

import type {
  Verifier,
  VerifierConfig,
  VerificationCheck,
  ContentType,
  VerificationContext,
  VerificationStatus,
} from '../types';

interface WolframConfig {
  appId: string;
  endpoint?: string;
  format?: 'plaintext' | 'image' | 'mathml';
  timeout?: number;
}

interface WolframPod {
  title: string;
  scanner: string;
  id: string;
  position: number;
  error: boolean;
  numsubpods: number;
  subpods: {
    title: string;
    plaintext?: string;
    img?: { src: string; alt: string };
  }[];
}

interface WolframResponse {
  queryresult: {
    success: boolean;
    error: boolean;
    numpods: number;
    datatypes: string;
    timedout: string;
    timing: number;
    pods?: WolframPod[];
    didyoumeans?: { val: string; score: string }[];
  };
}

export class WolframVerifier implements Verifier {
  id: 'wolfram' = 'wolfram';
  name = 'Wolfram Alpha';
  supportedContentTypes: ContentType[] = [
    'math_expression',
    'math_solution',
    'formula',
    'scientific_fact',
    'physics',
    'chemistry',
  ];
  
  private config: WolframConfig | null = null;
  private baseUrl = 'https://api.wolframalpha.com/v2/query';
  
  async initialize(config: VerifierConfig): Promise<void> {
    if (!config.config.appId) {
      throw new Error('Wolfram App ID is required');
    }
    this.config = {
      appId: config.config.appId,
      endpoint: config.config.endpoint || this.baseUrl,
      format: config.config.format || 'plaintext',
      timeout: config.timeoutMs,
    };
  }
  
  async checkHealth(): Promise<boolean> {
    if (!this.config?.appId) return false;
    
    try {
      // Simple query to check if API is responding
      const response = await this.query('1+1');
      return response.queryresult.success;
    } catch {
      return false;
    }
  }
  
  async verify(
    content: string,
    contentType: ContentType,
    context?: VerificationContext
  ): Promise<VerificationCheck> {
    const startTime = Date.now();
    
    if (!this.config?.appId) {
      return {
        verifier: 'wolfram',
        status: 'inconclusive',
        confidence: 0,
        details: 'Wolfram Alpha not configured',
        timestamp: new Date(),
        durationMs: Date.now() - startTime,
      };
    }
    
    try {
      // Build query based on content type
      const query = this.buildQuery(content, contentType, context);
      const response = await this.query(query);
      
      // Parse and compare response
      const result = this.analyzeResponse(content, contentType, response, context);
      
      return {
        verifier: 'wolfram',
        status: result.status,
        confidence: result.confidence,
        details: result.details,
        rawResponse: response,
        timestamp: new Date(),
        durationMs: Date.now() - startTime,
      };
    } catch (error) {
      return {
        verifier: 'wolfram',
        status: 'inconclusive',
        confidence: 0,
        details: `Wolfram Alpha error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: new Date(),
        durationMs: Date.now() - startTime,
      };
    }
  }
  
  async getSuggestion(content: string, check: VerificationCheck): Promise<string | null> {
    if (!check.rawResponse) return null;
    
    const response = check.rawResponse as WolframResponse;
    const resultPod = response.queryresult.pods?.find(p => 
      p.id === 'Result' || p.id === 'Solution' || p.id === 'DecimalApproximation'
    );
    
    if (resultPod?.subpods?.[0]?.plaintext) {
      return resultPod.subpods[0].plaintext;
    }
    
    return null;
  }
  
  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================
  
  private async query(input: string): Promise<WolframResponse> {
    const params = new URLSearchParams({
      input,
      appid: this.config!.appId,
      format: this.config!.format || 'plaintext',
      output: 'json',
    });
    
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config!.timeout || 10000);
    
    try {
      const response = await fetch(`${this.config!.endpoint}?${params}`, {
        signal: controller.signal,
      });
      
      if (!response.ok) {
        throw new Error(`Wolfram API error: ${response.status}`);
      }
      
      return await response.json();
    } finally {
      clearTimeout(timeout);
    }
  }
  
  private buildQuery(
    content: string,
    contentType: ContentType,
    context?: VerificationContext
  ): string {
    switch (contentType) {
      case 'math_expression':
        // Simplify or evaluate the expression
        return `simplify ${content}`;
        
      case 'math_solution':
        // Verify a solution by checking the equation
        if (context?.sourceContent) {
          return `solve ${context.sourceContent}`;
        }
        return `verify ${content}`;
        
      case 'formula':
        // Look up the formula
        return content;
        
      case 'physics':
        // Physics calculations or constants
        return content;
        
      case 'chemistry':
        // Chemical formulas, reactions, etc.
        return content;
        
      case 'scientific_fact':
        // General scientific queries
        return content;
        
      default:
        return content;
    }
  }
  
  private analyzeResponse(
    content: string,
    contentType: ContentType,
    response: WolframResponse,
    context?: VerificationContext
  ): { status: VerificationStatus; confidence: number; details: string } {
    if (!response.queryresult.success) {
      // Check for "did you mean" suggestions
      if (response.queryresult.didyoumeans?.length) {
        return {
          status: 'partial',
          confidence: 0.3,
          details: `Wolfram didn't understand. Did you mean: ${response.queryresult.didyoumeans[0].val}?`,
        };
      }
      return {
        status: 'inconclusive',
        confidence: 0,
        details: 'Wolfram Alpha could not interpret the query',
      };
    }
    
    const pods = response.queryresult.pods || [];
    
    // Find relevant result pods
    const resultPod = pods.find(p => p.id === 'Result' || p.id === 'Solution');
    const inputPod = pods.find(p => p.id === 'Input' || p.id === 'InputInterpretation');
    
    // For math solutions, compare with expected answer
    if (contentType === 'math_solution' && context?.expectedAnswer) {
      const wolframResult = resultPod?.subpods?.[0]?.plaintext;
      if (wolframResult) {
        const matches = this.compareAnswers(context.expectedAnswer, wolframResult);
        return {
          status: matches ? 'verified' : 'failed',
          confidence: matches ? 0.95 : 0.9,
          details: matches 
            ? `Verified: Answer matches Wolfram Alpha (${wolframResult})`
            : `Mismatch: Expected ${context.expectedAnswer}, Wolfram got ${wolframResult}`,
        };
      }
    }
    
    // For expressions, check if it simplified correctly
    if (contentType === 'math_expression') {
      const wolframResult = resultPod?.subpods?.[0]?.plaintext || 
                           pods.find(p => p.id === 'DecimalApproximation')?.subpods?.[0]?.plaintext;
      if (wolframResult) {
        // Check if our content matches or is equivalent
        const equivalent = this.compareExpressions(content, wolframResult);
        return {
          status: equivalent ? 'verified' : 'partial',
          confidence: equivalent ? 0.9 : 0.5,
          details: equivalent
            ? `Verified: Expression evaluates correctly`
            : `Partial: Wolfram result is ${wolframResult}`,
        };
      }
    }
    
    // For formulas and facts, check if Wolfram has information
    if (pods.length > 1) {
      return {
        status: 'verified',
        confidence: 0.8,
        details: `Wolfram Alpha found ${pods.length} relevant results`,
      };
    }
    
    return {
      status: 'partial',
      confidence: 0.5,
      details: 'Wolfram Alpha processed query but results need manual review',
    };
  }
  
  private compareAnswers(expected: string, actual: string): boolean {
    // Normalize both answers
    const normalizeAnswer = (s: string) => s
      .toLowerCase()
      .replace(/\s+/g, '')
      .replace(/[()]/g, '')
      .replace(/×/g, '*')
      .replace(/÷/g, '/')
      .replace(/−/g, '-');
    
    const normExpected = normalizeAnswer(expected);
    const normActual = normalizeAnswer(actual);
    
    // Direct match
    if (normExpected === normActual) return true;
    
    // Try numeric comparison
    try {
      const numExpected = parseFloat(normExpected);
      const numActual = parseFloat(normActual);
      if (!isNaN(numExpected) && !isNaN(numActual)) {
        // Allow small floating point differences
        return Math.abs(numExpected - numActual) < 0.0001;
      }
    } catch {}
    
    // Check if one contains the other (for complex answers)
    return normActual.includes(normExpected) || normExpected.includes(normActual);
  }
  
  private compareExpressions(expr1: string, expr2: string): boolean {
    // Basic expression comparison
    const normalize = (s: string) => s
      .replace(/\s+/g, '')
      .replace(/\*/g, '×')
      .replace(/\//g, '÷')
      .toLowerCase();
    
    return normalize(expr1) === normalize(expr2);
  }
}

export default WolframVerifier;
