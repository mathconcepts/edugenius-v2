// @ts-nocheck
/**
 * SymPy Verifier
 * Verify mathematical expressions using Python SymPy library
 * Runs via local Python or cloud function
 */

import type {
  Verifier,
  VerifierConfig,
  VerificationCheck,
  ContentType,
  VerificationContext,
  VerificationStatus,
} from '../types';

interface SympyConfig {
  mode: 'local' | 'cloud';
  localPythonPath?: string;
  cloudEndpoint?: string;
  cloudApiKey?: string;
  timeout: number;
}

interface SympyResult {
  success: boolean;
  simplified?: string;
  evaluated?: string;
  equivalent?: boolean;
  steps?: string[];
  error?: string;
}

export class SympyVerifier implements Verifier {
  id: 'sympy' = 'sympy';
  name = 'SymPy (Symbolic Math)';
  supportedContentTypes: ContentType[] = [
    'math_expression',
    'math_solution',
    'formula',
  ];
  
  private config: SympyConfig | null = null;
  
  async initialize(config: VerifierConfig): Promise<void> {
    this.config = {
      mode: config.config.mode || 'cloud',
      localPythonPath: config.config.localPythonPath,
      cloudEndpoint: config.config.cloudEndpoint,
      cloudApiKey: config.config.cloudApiKey,
      timeout: config.timeoutMs,
    };
  }
  
  async checkHealth(): Promise<boolean> {
    if (!this.config) return false;
    
    try {
      // Test with simple expression
      const result = await this.evaluate('1+1');
      return result.success && result.evaluated === '2';
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
    
    if (!this.config) {
      return {
        verifier: 'sympy',
        status: 'inconclusive',
        confidence: 0,
        details: 'SymPy verifier not configured',
        timestamp: new Date(),
        durationMs: Date.now() - startTime,
      };
    }
    
    try {
      let result: SympyResult;
      
      switch (contentType) {
        case 'math_expression':
          result = await this.evaluate(content);
          break;
          
        case 'math_solution':
          if (context?.sourceContent && context?.expectedAnswer) {
            result = await this.verifySolution(
              context.sourceContent,
              content,
              context.expectedAnswer
            );
          } else {
            result = await this.simplify(content);
          }
          break;
          
        case 'formula':
          result = await this.simplify(content);
          break;
          
        default:
          result = { success: false, error: 'Unsupported content type' };
      }
      
      return this.buildCheckResult(result, startTime);
    } catch (error) {
      return {
        verifier: 'sympy',
        status: 'inconclusive',
        confidence: 0,
        details: `SymPy error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: new Date(),
        durationMs: Date.now() - startTime,
      };
    }
  }
  
  async getSuggestion(content: string, check: VerificationCheck): Promise<string | null> {
    const raw = check.rawResponse as SympyResult | undefined;
    return raw?.simplified || raw?.evaluated || null;
  }
  
  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================
  
  private async evaluate(expression: string): Promise<SympyResult> {
    return this.runSympy('evaluate', { expression });
  }
  
  private async simplify(expression: string): Promise<SympyResult> {
    return this.runSympy('simplify', { expression });
  }
  
  private async verifySolution(
    equation: string,
    solution: string,
    expected: string
  ): Promise<SympyResult> {
    return this.runSympy('verify_solution', {
      equation,
      solution,
      expected,
    });
  }
  
  private async runSympy(
    operation: string,
    params: Record<string, string>
  ): Promise<SympyResult> {
    if (this.config?.mode === 'local') {
      return this.runLocalSympy(operation, params);
    } else {
      return this.runCloudSympy(operation, params);
    }
  }
  
  private async runLocalSympy(
    operation: string,
    params: Record<string, string>
  ): Promise<SympyResult> {
    // Route local SymPy calls through the manim-service FastAPI (port 7341)
    // which has SymPy installed as a dependency of manim.
    const manimServiceUrl = process.env.MANIM_SERVICE_URL ?? 'http://localhost:7341';
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config?.timeout ?? 10_000);

    try {
      const response = await fetch(`${manimServiceUrl}/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ operation, params }),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!response.ok) {
        return { success: false, error: `Manim service error: ${response.status}` };
      }

      const data: SympyResult = await response.json();
      return data;
    } catch (e: any) {
      clearTimeout(timeout);
      if (e.name === 'AbortError') {
        return { success: false, error: 'Local SymPy timed out' };
      }
      return { success: false, error: `Local SymPy unavailable: ${e.message}` };
    }
  }
  
  private async runCloudSympy(
    operation: string,
    params: Record<string, string>
  ): Promise<SympyResult> {
    if (!this.config?.cloudEndpoint) {
      return { success: false, error: 'Cloud endpoint not configured' };
    }
    
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.timeout);
    
    try {
      const response = await fetch(this.config.cloudEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.config.cloudApiKey && {
            'Authorization': `Bearer ${this.config.cloudApiKey}`,
          }),
        },
        body: JSON.stringify({ operation, ...params }),
        signal: controller.signal,
      });
      
      if (!response.ok) {
        return { success: false, error: `HTTP ${response.status}` };
      }
      
      return await response.json();
    } finally {
      clearTimeout(timeout);
    }
  }
  
  private buildPythonScript(
    operation: string,
    params: Record<string, string>
  ): string {
    const scripts: Record<string, string> = {
      evaluate: `
from sympy import *
from sympy.parsing.sympy_parser import parse_expr
import json

try:
    expr = parse_expr('''${params.expression}''')
    result = simplify(expr)
    evaluated = N(result)
    print(json.dumps({
        'success': True,
        'simplified': str(result),
        'evaluated': str(evaluated)
    }))
except Exception as e:
    print(json.dumps({'success': False, 'error': str(e)}))
`,
      simplify: `
from sympy import *
from sympy.parsing.sympy_parser import parse_expr
import json

try:
    expr = parse_expr('''${params.expression}''')
    result = simplify(expr)
    print(json.dumps({
        'success': True,
        'simplified': str(result)
    }))
except Exception as e:
    print(json.dumps({'success': False, 'error': str(e)}))
`,
      verify_solution: `
from sympy import *
from sympy.parsing.sympy_parser import parse_expr
import json

try:
    # Parse the equation and solve it
    x = Symbol('x')
    equation = parse_expr('''${params.equation}''')
    solutions = solve(equation, x)
    
    # Parse expected answer
    expected = parse_expr('''${params.expected}''')
    
    # Check if expected is in solutions
    equivalent = any(simplify(s - expected) == 0 for s in solutions)
    
    print(json.dumps({
        'success': True,
        'equivalent': equivalent,
        'evaluated': str(solutions)
    }))
except Exception as e:
    print(json.dumps({'success': False, 'error': str(e)}))
`,
    };
    
    return scripts[operation] || '';
  }
  
  private buildCheckResult(result: SympyResult, startTime: number): VerificationCheck {
    let status: VerificationStatus;
    let confidence: number;
    let details: string;
    
    if (!result.success) {
      status = 'inconclusive';
      confidence = 0;
      details = result.error || 'SymPy processing failed';
    } else if (result.equivalent === true) {
      status = 'verified';
      confidence = 0.95;
      details = `SymPy verified: Expression is mathematically correct`;
    } else if (result.equivalent === false) {
      status = 'failed';
      confidence = 0.95;
      details = `SymPy found mismatch. Computed: ${result.evaluated}`;
    } else if (result.simplified) {
      status = 'partial';
      confidence = 0.7;
      details = `SymPy simplified to: ${result.simplified}`;
    } else {
      status = 'partial';
      confidence = 0.6;
      details = `SymPy evaluated: ${result.evaluated}`;
    }
    
    return {
      verifier: 'sympy',
      status,
      confidence,
      details,
      rawResponse: result,
      timestamp: new Date(),
      durationMs: Date.now() - startTime,
    };
  }
}

export default SympyVerifier;
