/**
 * EduGenius Event Bus - Public API
 * Re-exports all event system components
 */

// Core types
export * from './types';

// Event bus
export { EventBus, getEventBus, resetEventBus } from './event-bus';

// Agent communication
export { AgentChannel, getAgentChannel, resetAgentChannels } from './agent-channel';

// Workflow orchestration
export {
  WorkflowOrchestrator,
  getOrchestrator,
  resetOrchestrator,
  type WorkflowDefinition,
  type WorkflowStep,
  type WorkflowInstance,
  type WorkflowStatus,
  type StepState,
  type StepStatus,
} from './workflow-orchestrator';

// ============================================================================
// Convenience Functions
// ============================================================================

import { getEventBus } from './event-bus';
import { getAgentChannel } from './agent-channel';
import { getOrchestrator } from './workflow-orchestrator';
import type { AgentId, EventType, EventTypeMap, EventBusConfig } from './types';

/**
 * Initialize the event system with configuration
 */
export function initEventSystem(config?: Partial<EventBusConfig>): void {
  getEventBus(config);
}

/**
 * Quick publish helper
 */
export function emit<T extends EventType>(
  type: T,
  payload: EventTypeMap[T],
  source?: AgentId
): string {
  return getEventBus().publish(type, payload, { source });
}

/**
 * Quick subscribe helper
 */
export function on<T extends EventType>(
  type: T,
  handler: (event: { type: T; payload: EventTypeMap[T]; meta: unknown }) => void
): () => void {
  return getEventBus().subscribe(type, handler);
}

/**
 * Create a channel for an agent
 */
export function createChannel(agentId: AgentId) {
  return getAgentChannel(agentId);
}

/**
 * Get the workflow orchestrator
 */
export function workflows() {
  return getOrchestrator();
}
