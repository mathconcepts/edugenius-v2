/**
 * Content Verification Types
 * Modular verification layer for educational content
 */

// ============================================================================
// VERIFICATION RESULT TYPES
// ============================================================================

export type VerificationStatus = 
  | 'verified'      // All checks passed
  | 'partial'       // Some checks passed, others inconclusive
  | 'failed'        // One or more checks failed
  | 'inconclusive'  // Could not verify (external service unavailable)
  | 'skipped';      // Verification not applicable

export type ContentType = 
  | 'math_expression'
  | 'math_solution'
  | 'scientific_fact'
  | 'formula'
  | 'definition'
  | 'code'
  | 'chemistry'
  | 'physics'
  | 'biology'
  | 'general';

export type VerifierType =
  | 'wolfram'          // Wolfram Alpha for math/science
  | 'sympy'            // SymPy for symbolic math
  | 'llm_consensus'    // Multiple LLMs agreeing
  | 'database'         // Known verified facts DB
  | 'citation'         // Verify against citations
  | 'code_execution'   // Run code and verify output
  | 'custom';          // Custom verification logic

export interface VerificationCheck {
  verifier: VerifierType;
  status: VerificationStatus;
  confidence: number;        // 0-1 confidence score
  details: string;
  rawResponse?: any;
  timestamp: Date;
  durationMs: number;
}

export interface VerificationResult {
  contentId: string;
  contentType: ContentType;
  originalContent: string;
  overallStatus: VerificationStatus;
  overallConfidence: number;
  checks: VerificationCheck[];
  suggestions?: string[];
  correctedContent?: string;
  metadata: {
    requestedAt: Date;
    completedAt: Date;
    totalDurationMs: number;
    verifiersUsed: VerifierType[];
  };
}

// ============================================================================
// VERIFIER INTERFACE
// ============================================================================

export interface VerifierConfig {
  enabled: boolean;
  priority: number;           // Higher = run first
  required: boolean;          // Must pass for overall success
  timeoutMs: number;
  retries: number;
  fallbackOnError: boolean;   // Continue if this verifier fails
  config: Record<string, any>;
}

export interface Verifier {
  id: VerifierType;
  name: string;
  supportedContentTypes: ContentType[];
  
  /**
   * Initialize the verifier with configuration
   */
  initialize(config: VerifierConfig): Promise<void>;
  
  /**
   * Check if verifier is healthy/available
   */
  checkHealth(): Promise<boolean>;
  
  /**
   * Verify content
   */
  verify(content: string, contentType: ContentType, context?: VerificationContext): Promise<VerificationCheck>;
  
  /**
   * Get suggested correction if verification failed
   */
  getSuggestion?(content: string, check: VerificationCheck): Promise<string | null>;
}

export interface VerificationContext {
  subject?: string;           // e.g., "calculus", "organic chemistry"
  topic?: string;             // e.g., "derivatives", "benzene"
  difficulty?: string;        // e.g., "JEE Advanced", "CBSE 10"
  expectedAnswer?: string;    // For solution verification
  sourceContent?: string;     // Original question/prompt
  previousSteps?: string[];   // For multi-step solutions
}

// ============================================================================
// VERIFICATION POLICY
// ============================================================================

export interface VerificationPolicy {
  id: string;
  name: string;
  description: string;
  
  // When to apply this policy
  triggers: {
    contentTypes: ContentType[];
    subjects?: string[];
    minConfidence?: number;   // Verify if LLM confidence below this
    always?: boolean;         // Always verify this type
  };
  
  // Which verifiers to use
  verifiers: {
    type: VerifierType;
    required: boolean;
    weight: number;           // Weight in final confidence calculation
  }[];
  
  // Thresholds
  thresholds: {
    minOverallConfidence: number;   // Minimum to pass
    requireAllRequired: boolean;    // All required verifiers must pass
    allowPartial: boolean;          // Allow partial verification
  };
  
  // Actions on failure
  onFailure: {
    action: 'reject' | 'flag' | 'correct' | 'escalate';
    notifyAdmin: boolean;
    logToAudit: boolean;
  };
}

// ============================================================================
// VERIFICATION AUDIT
// ============================================================================

export interface VerificationAuditEntry {
  id: string;
  timestamp: Date;
  contentType: ContentType;
  originalContent: string;
  result: VerificationResult;
  policy: string;
  agentId?: string;
  userId?: string;
  examType?: string;
  actionTaken: string;
  correctionApplied?: boolean;
}
