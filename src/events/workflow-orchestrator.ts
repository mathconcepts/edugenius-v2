// @ts-nocheck
/**
 * EduGenius Workflow Orchestrator
 * Coordinates multi-agent workflows with state management
 */

import { randomUUID } from 'crypto';
import { EventBus, getEventBus } from './event-bus';
import { AgentChannel, getAgentChannel } from './agent-channel';
import {
  AgentId,
  EventType,
  EventTypeMap,
  TypedEvent,
} from './types';

// ============================================================================
// Workflow Types
// ============================================================================

export interface WorkflowDefinition {
  id: string;
  name: string;
  description?: string;
  version: string;
  steps: WorkflowStep[];
  errorHandling?: ErrorHandlingConfig;
  timeout?: number;
}

export interface WorkflowStep {
  id: string;
  name: string;
  agent: AgentId;
  action: string;
  input?: Record<string, unknown> | InputMapping;
  dependencies?: string[];  // Step IDs that must complete first
  condition?: StepCondition;
  timeout?: number;
  retries?: number;
  onError?: 'fail' | 'skip' | 'continue';
}

export interface InputMapping {
  $type: 'mapping';
  source: 'workflow' | 'step';
  path: string;  // JSONPath-like: "input.examId" or "steps.step1.output.contentId"
}

export interface StepCondition {
  $type: 'condition';
  field: string;
  operator: 'eq' | 'ne' | 'gt' | 'lt' | 'in' | 'exists';
  value: unknown;
}

export interface ErrorHandlingConfig {
  defaultBehavior: 'fail' | 'continue' | 'rollback';
  maxRetries: number;
  retryDelayMs: number;
  compensationSteps?: Record<string, string>;  // stepId -> compensation action
}

export interface WorkflowInstance {
  id: string;
  definitionId: string;
  status: WorkflowStatus;
  input: Record<string, unknown>;
  output?: Record<string, unknown>;
  stepStates: Map<string, StepState>;
  startedAt: number;
  completedAt?: number;
  error?: string;
  initiator: AgentId;
}

export type WorkflowStatus = 
  | 'pending' 
  | 'running' 
  | 'paused' 
  | 'completed' 
  | 'failed' 
  | 'cancelled'
  | 'rolling_back';

export interface StepState {
  id: string;
  status: StepStatus;
  input?: Record<string, unknown>;
  output?: Record<string, unknown>;
  startedAt?: number;
  completedAt?: number;
  retryCount: number;
  error?: string;
}

export type StepStatus = 
  | 'pending' 
  | 'waiting' 
  | 'running' 
  | 'completed' 
  | 'failed' 
  | 'skipped';

// ============================================================================
// Workflow Orchestrator
// ============================================================================

export class WorkflowOrchestrator {
  private bus: EventBus;
  private definitions: Map<string, WorkflowDefinition> = new Map();
  private instances: Map<string, WorkflowInstance> = new Map();
  private stepHandlers: Map<string, StepHandler> = new Map();

  constructor(bus?: EventBus) {
    this.bus = bus || getEventBus();
    this.setupEventListeners();
  }

  // -------------------------------------------------------------------------
  // Workflow Definition
  // -------------------------------------------------------------------------

  /**
   * Register a workflow definition
   */
  registerWorkflow(definition: WorkflowDefinition): void {
    this.validateDefinition(definition);
    this.definitions.set(definition.id, definition);
  }

  /**
   * Register a step handler
   */
  registerStepHandler(
    agent: AgentId,
    action: string,
    handler: StepHandler
  ): void {
    const key = `${agent}:${action}`;
    this.stepHandlers.set(key, handler);
  }

  // -------------------------------------------------------------------------
  // Workflow Execution
  // -------------------------------------------------------------------------

  /**
   * Start a new workflow instance
   */
  async start(
    definitionId: string,
    input: Record<string, unknown>,
    initiator: AgentId
  ): Promise<string> {
    const definition = this.definitions.get(definitionId);
    if (!definition) {
      throw new Error(`Workflow definition not found: ${definitionId}`);
    }

    const instanceId = randomUUID();
    const stepStates = new Map<string, StepState>();

    // Initialize step states
    for (const step of definition.steps) {
      stepStates.set(step.id, {
        id: step.id,
        status: 'pending',
        retryCount: 0,
      });
    }

    const instance: WorkflowInstance = {
      id: instanceId,
      definitionId,
      status: 'running',
      input,
      stepStates,
      startedAt: Date.now(),
      initiator,
    };

    this.instances.set(instanceId, instance);

    // Emit workflow started event
    this.bus.publish('system.workflow.started', {
      workflowId: instanceId,
      workflowType: definition.name,
      initiator,
      participants: [...new Set(definition.steps.map((s) => s.agent))],
      input,
      startedAt: instance.startedAt,
    }, { source: initiator });

    // Start execution
    this.executeWorkflow(instance, definition);

    return instanceId;
  }

  /**
   * Pause a running workflow
   */
  pause(instanceId: string): boolean {
    const instance = this.instances.get(instanceId);
    if (!instance || instance.status !== 'running') return false;
    instance.status = 'paused';
    return true;
  }

  /**
   * Resume a paused workflow
   */
  resume(instanceId: string): boolean {
    const instance = this.instances.get(instanceId);
    if (!instance || instance.status !== 'paused') return false;
    
    const definition = this.definitions.get(instance.definitionId);
    if (!definition) return false;

    instance.status = 'running';
    this.executeWorkflow(instance, definition);
    return true;
  }

  /**
   * Cancel a workflow
   */
  cancel(instanceId: string): boolean {
    const instance = this.instances.get(instanceId);
    if (!instance) return false;
    if (instance.status === 'completed' || instance.status === 'failed') return false;

    instance.status = 'cancelled';
    instance.completedAt = Date.now();

    this.bus.publish('system.workflow.completed', {
      workflowId: instanceId,
      workflowType: this.definitions.get(instance.definitionId)?.name || '',
      status: 'cancelled',
      duration: instance.completedAt - instance.startedAt,
      stepsCompleted: this.countSteps(instance, 'completed'),
      stepsFailed: this.countSteps(instance, 'failed'),
    }, { source: instance.initiator });

    return true;
  }

  // -------------------------------------------------------------------------
  // Execution Engine
  // -------------------------------------------------------------------------

  private async executeWorkflow(
    instance: WorkflowInstance,
    definition: WorkflowDefinition
  ): Promise<void> {
    while (instance.status === 'running') {
      const readySteps = this.getReadySteps(instance, definition);
      
      if (readySteps.length === 0) {
        // Check if workflow is complete
        if (this.isWorkflowComplete(instance, definition)) {
          await this.completeWorkflow(instance, definition, 'completed');
        } else if (this.hasFailedSteps(instance)) {
          const behavior = definition.errorHandling?.defaultBehavior || 'fail';
          if (behavior === 'fail') {
            await this.completeWorkflow(instance, definition, 'failed');
          } else if (behavior === 'rollback') {
            await this.rollbackWorkflow(instance, definition);
          }
        }
        break;
      }

      // Execute ready steps in parallel
      await Promise.all(
        readySteps.map((step) => this.executeStep(instance, definition, step))
      );
    }
  }

  private async executeStep(
    instance: WorkflowInstance,
    definition: WorkflowDefinition,
    step: WorkflowStep
  ): Promise<void> {
    const stepState = instance.stepStates.get(step.id)!;

    // Check condition
    if (step.condition && !this.evaluateCondition(step.condition, instance)) {
      stepState.status = 'skipped';
      stepState.completedAt = Date.now();
      this.emitStepEvent(instance, step, 'skipped');
      return;
    }

    stepState.status = 'running';
    stepState.startedAt = Date.now();
    stepState.input = this.resolveInput(step.input, instance);

    this.emitStepEvent(instance, step, 'running');

    try {
      const handler = this.stepHandlers.get(`${step.agent}:${step.action}`);
      
      if (!handler) {
        throw new Error(`No handler for ${step.agent}:${step.action}`);
      }

      const timeout = step.timeout || definition.timeout || 300000;
      const output = await Promise.race([
        handler(stepState.input!, instance, step),
        this.createTimeout(timeout),
      ]);

      stepState.status = 'completed';
      stepState.output = output as Record<string, unknown>;
      stepState.completedAt = Date.now();

      this.emitStepEvent(instance, step, 'completed', stepState.output);

    } catch (error) {
      const maxRetries = step.retries ?? definition.errorHandling?.maxRetries ?? 3;

      if (stepState.retryCount < maxRetries) {
        stepState.retryCount++;
        stepState.status = 'pending';
        
        const delay = definition.errorHandling?.retryDelayMs || 5000;
        await new Promise((resolve) => setTimeout(resolve, delay * stepState.retryCount));
        
        return this.executeStep(instance, definition, step);
      }

      stepState.status = 'failed';
      stepState.error = (error as Error).message;
      stepState.completedAt = Date.now();

      this.emitStepEvent(instance, step, 'failed', undefined, stepState.error);

      if (step.onError === 'skip') {
        // Continue workflow
      } else if (step.onError === 'continue') {
        // Mark as completed despite error
        stepState.status = 'completed';
      }
      // Default 'fail' will be handled by workflow executor
    }
  }

  private getReadySteps(
    instance: WorkflowInstance,
    definition: WorkflowDefinition
  ): WorkflowStep[] {
    return definition.steps.filter((step) => {
      const state = instance.stepStates.get(step.id)!;
      
      if (state.status !== 'pending') return false;
      
      // Check dependencies
      if (step.dependencies) {
        for (const depId of step.dependencies) {
          const depState = instance.stepStates.get(depId);
          if (!depState || depState.status !== 'completed') {
            return false;
          }
        }
      }
      
      return true;
    });
  }

  private isWorkflowComplete(
    instance: WorkflowInstance,
    definition: WorkflowDefinition
  ): boolean {
    return definition.steps.every((step) => {
      const state = instance.stepStates.get(step.id)!;
      return state.status === 'completed' || state.status === 'skipped';
    });
  }

  private hasFailedSteps(instance: WorkflowInstance): boolean {
    for (const state of instance.stepStates.values()) {
      if (state.status === 'failed') return true;
    }
    return false;
  }

  private countSteps(instance: WorkflowInstance, status: StepStatus): number {
    let count = 0;
    for (const state of instance.stepStates.values()) {
      if (state.status === status) count++;
    }
    return count;
  }

  private async completeWorkflow(
    instance: WorkflowInstance,
    definition: WorkflowDefinition,
    status: 'completed' | 'failed'
  ): Promise<void> {
    instance.status = status;
    instance.completedAt = Date.now();

    // Collect output from final steps
    if (status === 'completed') {
      instance.output = this.collectWorkflowOutput(instance, definition);
    }

    this.bus.publish('system.workflow.completed', {
      workflowId: instance.id,
      workflowType: definition.name,
      status,
      result: instance.output,
      duration: instance.completedAt - instance.startedAt,
      stepsCompleted: this.countSteps(instance, 'completed'),
      stepsFailed: this.countSteps(instance, 'failed'),
    }, { source: instance.initiator });
  }

  private async rollbackWorkflow(
    instance: WorkflowInstance,
    definition: WorkflowDefinition
  ): Promise<void> {
    instance.status = 'rolling_back';

    const compensations = definition.errorHandling?.compensationSteps || {};
    const completedSteps = [...instance.stepStates.entries()]
      .filter(([_, state]) => state.status === 'completed')
      .map(([id, _]) => id)
      .reverse();

    for (const stepId of completedSteps) {
      const compensationAction = compensations[stepId];
      if (compensationAction) {
        const step = definition.steps.find((s) => s.id === stepId)!;
        const handler = this.stepHandlers.get(`${step.agent}:${compensationAction}`);
        
        if (handler) {
          try {
            const stepState = instance.stepStates.get(stepId)!;
            await handler(stepState.output || {}, instance, step);
          } catch (error) {
            console.error(`Compensation failed for ${stepId}:`, error);
          }
        }
      }
    }

    await this.completeWorkflow(instance, definition, 'failed');
  }

  private collectWorkflowOutput(
    instance: WorkflowInstance,
    definition: WorkflowDefinition
  ): Record<string, unknown> {
    const output: Record<string, unknown> = {};
    
    // Get output from steps that have no dependents (final steps)
    const dependedOn = new Set<string>();
    for (const step of definition.steps) {
      if (step.dependencies) {
        for (const dep of step.dependencies) {
          dependedOn.add(dep);
        }
      }
    }

    for (const step of definition.steps) {
      if (!dependedOn.has(step.id)) {
        const state = instance.stepStates.get(step.id);
        if (state?.output) {
          output[step.id] = state.output;
        }
      }
    }

    return output;
  }

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  private resolveInput(
    input: Record<string, unknown> | InputMapping | undefined,
    instance: WorkflowInstance
  ): Record<string, unknown> {
    if (!input) return {};
    
    if (this.isInputMapping(input)) {
      return this.resolveMapping(input, instance);
    }

    // Resolve any nested mappings
    const resolved: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(input)) {
      if (this.isInputMapping(value as InputMapping)) {
        resolved[key] = this.resolveMapping(value as InputMapping, instance);
      } else {
        resolved[key] = value;
      }
    }
    return resolved;
  }

  private isInputMapping(value: unknown): value is InputMapping {
    return typeof value === 'object' && value !== null && (value as InputMapping).$type === 'mapping';
  }

  private resolveMapping(mapping: InputMapping, instance: WorkflowInstance): unknown {
    const path = mapping.path.split('.');
    
    if (mapping.source === 'workflow') {
      return this.getNestedValue(instance.input, path);
    } else if (mapping.source === 'step') {
      const stepId = path[0];
      const state = instance.stepStates.get(stepId);
      if (!state?.output) return undefined;
      return this.getNestedValue(state.output, path.slice(1));
    }
    return undefined;
  }

  private getNestedValue(obj: Record<string, unknown>, path: string[]): unknown {
    let current: unknown = obj;
    for (const key of path) {
      if (current === null || current === undefined) return undefined;
      current = (current as Record<string, unknown>)[key];
    }
    return current;
  }

  private evaluateCondition(condition: StepCondition, instance: WorkflowInstance): boolean {
    const value = this.resolveMapping(
      { $type: 'mapping', source: 'workflow', path: condition.field },
      instance
    );

    switch (condition.operator) {
      case 'eq': return value === condition.value;
      case 'ne': return value !== condition.value;
      case 'gt': return (value as number) > (condition.value as number);
      case 'lt': return (value as number) < (condition.value as number);
      case 'in': return (condition.value as unknown[]).includes(value);
      case 'exists': return value !== undefined && value !== null;
      default: return false;
    }
  }

  private createTimeout(ms: number): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Step timeout')), ms);
    });
  }

  private validateDefinition(definition: WorkflowDefinition): void {
    const stepIds = new Set(definition.steps.map((s) => s.id));
    
    for (const step of definition.steps) {
      if (step.dependencies) {
        for (const dep of step.dependencies) {
          if (!stepIds.has(dep)) {
            throw new Error(`Invalid dependency: ${dep} in step ${step.id}`);
          }
        }
      }
    }

    // Check for circular dependencies
    this.detectCycles(definition);
  }

  private detectCycles(definition: WorkflowDefinition): void {
    const visited = new Set<string>();
    const stack = new Set<string>();

    const visit = (stepId: string): void => {
      if (stack.has(stepId)) {
        throw new Error(`Circular dependency detected: ${stepId}`);
      }
      if (visited.has(stepId)) return;

      visited.add(stepId);
      stack.add(stepId);

      const step = definition.steps.find((s) => s.id === stepId)!;
      if (step.dependencies) {
        for (const dep of step.dependencies) {
          visit(dep);
        }
      }

      stack.delete(stepId);
    };

    for (const step of definition.steps) {
      visit(step.id);
    }
  }

  private emitStepEvent(
    instance: WorkflowInstance,
    step: WorkflowStep,
    status: StepStatus,
    output?: Record<string, unknown>,
    error?: string
  ): void {
    this.bus.publish('system.workflow.step', {
      workflowId: instance.id,
      stepId: step.id,
      stepName: step.name,
      status: status as 'pending' | 'running' | 'completed' | 'failed' | 'skipped',
      agent: step.agent,
      output,
      error,
    }, { source: instance.initiator });
  }

  private setupEventListeners(): void {
    // Could listen for external events to trigger workflows
  }

  // -------------------------------------------------------------------------
  // Query Methods
  // -------------------------------------------------------------------------

  getDefinition(id: string): WorkflowDefinition | undefined {
    return this.definitions.get(id);
  }

  getInstance(id: string): WorkflowInstance | undefined {
    return this.instances.get(id);
  }

  getActiveInstances(): WorkflowInstance[] {
    return [...this.instances.values()].filter(
      (i) => i.status === 'running' || i.status === 'paused'
    );
  }
}

// ============================================================================
// Types
// ============================================================================

type StepHandler = (
  input: Record<string, unknown>,
  instance: WorkflowInstance,
  step: WorkflowStep
) => Promise<Record<string, unknown>>;

// ============================================================================
// Singleton
// ============================================================================

let orchestratorInstance: WorkflowOrchestrator | null = null;

export function getOrchestrator(bus?: EventBus): WorkflowOrchestrator {
  if (!orchestratorInstance) {
    orchestratorInstance = new WorkflowOrchestrator(bus);
  }
  return orchestratorInstance;
}

export function resetOrchestrator(): void {
  orchestratorInstance = null;
}
