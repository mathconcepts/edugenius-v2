/**
 * Verification Engine
 * Orchestrates content verification using multiple verifiers
 */

import type {
  Verifier,
  VerifierConfig,
  VerifierType,
  VerificationResult,
  VerificationCheck,
  VerificationStatus,
  VerificationPolicy,
  VerificationContext,
  ContentType,
  VerificationAuditEntry,
} from './types';
import { WolframVerifier } from './verifiers/wolfram';
import { LLMConsensusVerifier } from './verifiers/llm-consensus';
import { SympyVerifier } from './verifiers/sympy';
import { EventEmitter } from 'events';

// ============================================================================
// DEFAULT POLICIES
// ============================================================================

export const DEFAULT_POLICIES: VerificationPolicy[] = [
  // Math content - highest rigor
  {
    id: 'math-high-rigor',
    name: 'Math High Rigor',
    description: 'Strict verification for math content (JEE/NEET level)',
    triggers: {
      contentTypes: ['math_expression', 'math_solution', 'formula'],
      subjects: ['mathematics', 'calculus', 'algebra', 'trigonometry'],
      always: true,
    },
    verifiers: [
      { type: 'wolfram', required: true, weight: 0.5 },
      { type: 'sympy', required: false, weight: 0.3 },
      { type: 'llm_consensus', required: false, weight: 0.2 },
    ],
    thresholds: {
      minOverallConfidence: 0.8,
      requireAllRequired: true,
      allowPartial: true,
    },
    onFailure: {
      action: 'flag',
      notifyAdmin: true,
      logToAudit: true,
    },
  },
  
  // Physics content
  {
    id: 'physics-standard',
    name: 'Physics Standard',
    description: 'Standard verification for physics content',
    triggers: {
      contentTypes: ['physics', 'formula', 'scientific_fact'],
      subjects: ['physics', 'mechanics', 'thermodynamics', 'electromagnetism'],
      always: true,
    },
    verifiers: [
      { type: 'wolfram', required: true, weight: 0.5 },
      { type: 'llm_consensus', required: false, weight: 0.5 },
    ],
    thresholds: {
      minOverallConfidence: 0.75,
      requireAllRequired: true,
      allowPartial: true,
    },
    onFailure: {
      action: 'flag',
      notifyAdmin: false,
      logToAudit: true,
    },
  },
  
  // Chemistry content
  {
    id: 'chemistry-standard',
    name: 'Chemistry Standard',
    description: 'Standard verification for chemistry content',
    triggers: {
      contentTypes: ['chemistry', 'formula', 'scientific_fact'],
      subjects: ['chemistry', 'organic', 'inorganic', 'physical'],
      always: true,
    },
    verifiers: [
      { type: 'wolfram', required: false, weight: 0.4 },
      { type: 'llm_consensus', required: true, weight: 0.6 },
    ],
    thresholds: {
      minOverallConfidence: 0.7,
      requireAllRequired: true,
      allowPartial: true,
    },
    onFailure: {
      action: 'flag',
      notifyAdmin: false,
      logToAudit: true,
    },
  },
  
  // General content - lighter verification
  {
    id: 'general-light',
    name: 'General Light',
    description: 'Light verification for general content',
    triggers: {
      contentTypes: ['definition', 'general', 'biology'],
      minConfidence: 0.7,
    },
    verifiers: [
      { type: 'llm_consensus', required: true, weight: 1.0 },
    ],
    thresholds: {
      minOverallConfidence: 0.6,
      requireAllRequired: false,
      allowPartial: true,
    },
    onFailure: {
      action: 'flag',
      notifyAdmin: false,
      logToAudit: true,
    },
  },
];

// ============================================================================
// VERIFICATION ENGINE
// ============================================================================

interface EngineConfig {
  enabled: boolean;
  policies: VerificationPolicy[];
  verifierConfigs: Record<VerifierType, VerifierConfig>;
  auditRetentionDays: number;
  parallelVerification: boolean;
}

export class VerificationEngine extends EventEmitter {
  private config: EngineConfig;
  private verifiers: Map<VerifierType, Verifier> = new Map();
  private policies: Map<string, VerificationPolicy> = new Map();
  private auditLog: VerificationAuditEntry[] = [];
  private initialized = false;
  
  constructor(config: Partial<EngineConfig> = {}) {
    super();
    
    this.config = {
      enabled: config.enabled ?? true,
      policies: config.policies || DEFAULT_POLICIES,
      verifierConfigs: config.verifierConfigs || this.getDefaultVerifierConfigs(),
      auditRetentionDays: config.auditRetentionDays || 30,
      parallelVerification: config.parallelVerification ?? true,
    };
    
    // Load policies
    for (const policy of this.config.policies) {
      this.policies.set(policy.id, policy);
    }
  }
  
  /**
   * Initialize all verifiers
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;
    
    // Register built-in verifiers
    const builtinVerifiers: Verifier[] = [
      new WolframVerifier(),
      new LLMConsensusVerifier(),
      new SympyVerifier(),
    ];
    
    // Initialize each verifier
    for (const verifier of builtinVerifiers) {
      const config = this.config.verifierConfigs[verifier.id];
      if (config?.enabled) {
        try {
          await verifier.initialize(config);
          this.verifiers.set(verifier.id, verifier);
          this.emit('verifier:initialized', verifier.id);
        } catch (error) {
          this.emit('verifier:error', { id: verifier.id, error });
        }
      }
    }
    
    this.initialized = true;
    this.emit('engine:initialized');
  }
  
  /**
   * Register a custom verifier
   */
  registerVerifier(verifier: Verifier, config: VerifierConfig): void {
    this.verifiers.set(verifier.id, verifier);
    this.config.verifierConfigs[verifier.id] = config;
  }
  
  /**
   * Add or update a policy
   */
  setPolicy(policy: VerificationPolicy): void {
    this.policies.set(policy.id, policy);
  }
  
  /**
   * Remove a policy
   */
  removePolicy(policyId: string): void {
    this.policies.delete(policyId);
  }
  
  /**
   * Verify content
   */
  async verify(
    content: string,
    contentType: ContentType,
    context?: VerificationContext & { agentId?: string; userId?: string }
  ): Promise<VerificationResult> {
    const requestedAt = new Date();
    
    if (!this.config.enabled) {
      return this.buildSkippedResult(content, contentType, requestedAt, 'Verification disabled');
    }
    
    // Find applicable policy
    const policy = this.findPolicy(contentType, context);
    if (!policy) {
      return this.buildSkippedResult(content, contentType, requestedAt, 'No applicable policy');
    }
    
    // Get required verifiers
    const verifiersToRun = this.getVerifiersForPolicy(policy);
    if (verifiersToRun.length === 0) {
      return this.buildSkippedResult(content, contentType, requestedAt, 'No verifiers available');
    }
    
    // Run verification
    let checks: VerificationCheck[];
    if (this.config.parallelVerification) {
      checks = await Promise.all(
        verifiersToRun.map(v => v.verifier.verify(content, contentType, context))
      );
    } else {
      checks = [];
      for (const v of verifiersToRun) {
        const check = await v.verifier.verify(content, contentType, context);
        checks.push(check);
        
        // Early exit if required verifier fails and we can't continue
        if (v.required && check.status === 'failed' && !policy.thresholds.allowPartial) {
          break;
        }
      }
    }
    
    // Calculate overall result
    const result = this.calculateResult(content, contentType, checks, policy, requestedAt);
    
    // Get suggestions if needed
    if (result.overallStatus === 'failed' || result.overallStatus === 'partial') {
      result.suggestions = await this.getSuggestions(content, checks);
    }
    
    // Audit logging
    this.logAudit(result, policy.id, context);
    
    // Handle failure actions
    if (result.overallStatus === 'failed') {
      await this.handleFailure(result, policy, context);
    }
    
    return result;
  }
  
  /**
   * Check engine health
   */
  async checkHealth(): Promise<Record<VerifierType, boolean>> {
    const results: Record<string, boolean> = {};
    
    for (const [id, verifier] of this.verifiers) {
      try {
        results[id] = await verifier.checkHealth();
      } catch {
        results[id] = false;
      }
    }
    
    return results as Record<VerifierType, boolean>;
  }
  
  /**
   * Get audit log
   */
  getAuditLog(filters?: {
    fromDate?: Date;
    toDate?: Date;
    status?: VerificationStatus;
    contentType?: ContentType;
    limit?: number;
  }): VerificationAuditEntry[] {
    let entries = [...this.auditLog];
    
    if (filters?.fromDate) {
      entries = entries.filter(e => e.timestamp >= filters.fromDate!);
    }
    if (filters?.toDate) {
      entries = entries.filter(e => e.timestamp <= filters.toDate!);
    }
    if (filters?.status) {
      entries = entries.filter(e => e.result.overallStatus === filters.status);
    }
    if (filters?.contentType) {
      entries = entries.filter(e => e.contentType === filters.contentType);
    }
    if (filters?.limit) {
      entries = entries.slice(-filters.limit);
    }
    
    return entries;
  }
  
  /**
   * Export configuration
   */
  exportConfig(): EngineConfig {
    return { ...this.config, policies: Array.from(this.policies.values()) };
  }
  
  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================
  
  private getDefaultVerifierConfigs(): Record<VerifierType, VerifierConfig> {
    return {
      wolfram: {
        enabled: true,
        priority: 100,
        required: true,
        timeoutMs: 15000,
        retries: 2,
        fallbackOnError: true,
        config: {
          // appId will be set from environment
          appId: process.env.WOLFRAM_APP_ID || '',
        },
      },
      sympy: {
        enabled: true,
        priority: 80,
        required: false,
        timeoutMs: 10000,
        retries: 1,
        fallbackOnError: true,
        config: {
          mode: 'cloud',
          cloudEndpoint: process.env.SYMPY_ENDPOINT || '',
        },
      },
      llm_consensus: {
        enabled: true,
        priority: 60,
        required: false,
        timeoutMs: 30000,
        retries: 1,
        fallbackOnError: true,
        config: {
          minProviders: 2,
          maxProviders: 3,
          consensusThreshold: 0.7,
        },
      },
      database: {
        enabled: false,
        priority: 90,
        required: false,
        timeoutMs: 5000,
        retries: 1,
        fallbackOnError: true,
        config: {},
      },
      citation: {
        enabled: false,
        priority: 50,
        required: false,
        timeoutMs: 10000,
        retries: 1,
        fallbackOnError: true,
        config: {},
      },
      code_execution: {
        enabled: false,
        priority: 70,
        required: false,
        timeoutMs: 30000,
        retries: 1,
        fallbackOnError: false,
        config: {},
      },
      custom: {
        enabled: false,
        priority: 40,
        required: false,
        timeoutMs: 10000,
        retries: 1,
        fallbackOnError: true,
        config: {},
      },
    };
  }
  
  private findPolicy(contentType: ContentType, context?: VerificationContext): VerificationPolicy | null {
    for (const policy of this.policies.values()) {
      const triggers = policy.triggers;
      
      // Check content type
      if (!triggers.contentTypes.includes(contentType)) continue;
      
      // Check subject if specified
      if (triggers.subjects && context?.subject) {
        if (!triggers.subjects.includes(context.subject.toLowerCase())) continue;
      }
      
      // If always flag is set, use this policy
      if (triggers.always) return policy;
      
      // Otherwise this is a matching policy
      return policy;
    }
    
    return null;
  }
  
  private getVerifiersForPolicy(policy: VerificationPolicy): { verifier: Verifier; required: boolean; weight: number }[] {
    const result: { verifier: Verifier; required: boolean; weight: number }[] = [];
    
    for (const spec of policy.verifiers) {
      const verifier = this.verifiers.get(spec.type);
      if (verifier) {
        result.push({
          verifier,
          required: spec.required,
          weight: spec.weight,
        });
      }
    }
    
    return result;
  }
  
  private calculateResult(
    content: string,
    contentType: ContentType,
    checks: VerificationCheck[],
    policy: VerificationPolicy,
    requestedAt: Date
  ): VerificationResult {
    const completedAt = new Date();
    
    // Get policy weights
    const weights = new Map<VerifierType, number>();
    for (const spec of policy.verifiers) {
      weights.set(spec.type, spec.weight);
    }
    
    // Calculate weighted confidence
    let totalWeight = 0;
    let weightedConfidence = 0;
    let allRequiredPassed = true;
    let anyFailed = false;
    let anyVerified = false;
    
    for (const check of checks) {
      const weight = weights.get(check.verifier) || 1;
      totalWeight += weight;
      weightedConfidence += check.confidence * weight;
      
      if (check.status === 'failed') {
        anyFailed = true;
        const spec = policy.verifiers.find(v => v.type === check.verifier);
        if (spec?.required) {
          allRequiredPassed = false;
        }
      }
      
      if (check.status === 'verified') {
        anyVerified = true;
      }
    }
    
    const overallConfidence = totalWeight > 0 ? weightedConfidence / totalWeight : 0;
    
    // Determine overall status
    let overallStatus: VerificationStatus;
    
    if (policy.thresholds.requireAllRequired && !allRequiredPassed) {
      overallStatus = 'failed';
    } else if (anyFailed && !policy.thresholds.allowPartial) {
      overallStatus = 'failed';
    } else if (overallConfidence >= policy.thresholds.minOverallConfidence && anyVerified) {
      overallStatus = 'verified';
    } else if (overallConfidence >= policy.thresholds.minOverallConfidence * 0.7) {
      overallStatus = 'partial';
    } else if (anyFailed) {
      overallStatus = 'failed';
    } else {
      overallStatus = 'inconclusive';
    }
    
    return {
      contentId: this.generateContentId(),
      contentType,
      originalContent: content,
      overallStatus,
      overallConfidence,
      checks,
      metadata: {
        requestedAt,
        completedAt,
        totalDurationMs: completedAt.getTime() - requestedAt.getTime(),
        verifiersUsed: checks.map(c => c.verifier),
      },
    };
  }
  
  private async getSuggestions(content: string, checks: VerificationCheck[]): Promise<string[]> {
    const suggestions: string[] = [];
    
    for (const check of checks) {
      if (check.status === 'failed' || check.status === 'partial') {
        const verifier = this.verifiers.get(check.verifier);
        if (verifier?.getSuggestion) {
          const suggestion = await verifier.getSuggestion(content, check);
          if (suggestion) {
            suggestions.push(`[${verifier.name}] ${suggestion}`);
          }
        }
      }
    }
    
    return suggestions;
  }
  
  private async handleFailure(
    result: VerificationResult,
    policy: VerificationPolicy,
    context?: { agentId?: string; userId?: string }
  ): Promise<void> {
    const failure = policy.onFailure;
    
    if (failure.notifyAdmin) {
      this.emit('verification:failed:admin', {
        result,
        policy: policy.id,
        context,
      });
    }
    
    this.emit('verification:failed', {
      result,
      action: failure.action,
      policy: policy.id,
    });
  }
  
  private logAudit(
    result: VerificationResult,
    policyId: string,
    context?: { agentId?: string; userId?: string }
  ): void {
    const entry: VerificationAuditEntry = {
      id: this.generateContentId(),
      timestamp: new Date(),
      contentType: result.contentType,
      originalContent: result.originalContent,
      result,
      policy: policyId,
      agentId: context?.agentId,
      userId: context?.userId,
      actionTaken: result.overallStatus === 'verified' ? 'approved' : 'flagged',
    };
    
    this.auditLog.push(entry);
    this.emit('audit:entry', entry);
    
    // Cleanup old entries
    this.cleanupAuditLog();
  }
  
  private cleanupAuditLog(): void {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - this.config.auditRetentionDays);
    
    this.auditLog = this.auditLog.filter(e => e.timestamp >= cutoff);
  }
  
  private buildSkippedResult(
    content: string,
    contentType: ContentType,
    requestedAt: Date,
    reason: string
  ): VerificationResult {
    return {
      contentId: this.generateContentId(),
      contentType,
      originalContent: content,
      overallStatus: 'skipped',
      overallConfidence: 1,
      checks: [],
      suggestions: [reason],
      metadata: {
        requestedAt,
        completedAt: new Date(),
        totalDurationMs: 0,
        verifiersUsed: [],
      },
    };
  }
  
  private generateContentId(): string {
    return `ver_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
  }
}

// Singleton instance
export const verificationEngine = new VerificationEngine();
