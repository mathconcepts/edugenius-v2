/**
 * EduGenius Agents - Public API
 * Re-exports all agent implementations
 */

// Base agent
export { BaseAgent, type AgentConfig, type AgentState, type AgentContext } from './base-agent';

// Scout - Market Intelligence
export { ScoutAgent, SCOUT_CONFIG } from './scout';

// Atlas - Content Engine
export { AtlasAgent, ATLAS_CONFIG } from './atlas';

// Sage - AI Tutor
export { SageAgent, SAGE_CONFIG } from './sage';

// Mentor - Engagement
export { MentorAgent, MENTOR_CONFIG } from './mentor';

// Herald - Marketing
export { HeraldAgent, HERALD_CONFIG } from './herald';

// Forge - Deployment
export { ForgeAgent, FORGE_CONFIG } from './forge';

// Oracle - Analytics
export { OracleAgent, ORACLE_CONFIG } from './oracle';

// Prism - Journey Intelligence
export { PrismAgent, PRISM_CONFIG } from './prism';

// ============================================================================
// Agent Registry
// ============================================================================

import { BaseAgent, AgentConfig } from './base-agent';
import { ScoutAgent, SCOUT_CONFIG } from './scout';
import { AtlasAgent, ATLAS_CONFIG } from './atlas';
import { SageAgent, SAGE_CONFIG } from './sage';
import { MentorAgent, MENTOR_CONFIG } from './mentor';
import { HeraldAgent, HERALD_CONFIG } from './herald';
import { ForgeAgent, FORGE_CONFIG } from './forge';
import { OracleAgent, ORACLE_CONFIG } from './oracle';
import { PrismAgent, PRISM_CONFIG } from './prism';
import { AgentId } from '../events/types';

const agents: Map<AgentId, BaseAgent> = new Map();

export function getAgent(agentId: AgentId): BaseAgent | undefined {
  return agents.get(agentId);
}

export function getAllAgents(): Map<AgentId, BaseAgent> {
  return new Map(agents);
}

export async function startAgent(agentId: AgentId, config?: Partial<AgentConfig>): Promise<BaseAgent> {
  if (agents.has(agentId)) {
    throw new Error(`Agent ${agentId} is already running`);
  }

  let agent: BaseAgent;

  switch (agentId) {
    case 'Scout':
      agent = new ScoutAgent(config);
      break;
    case 'Atlas':
      agent = new AtlasAgent(config);
      break;
    case 'Sage':
      agent = new SageAgent(config);
      break;
    case 'Mentor':
      agent = new MentorAgent(config);
      break;
    case 'Herald':
      agent = new HeraldAgent(config);
      break;
    case 'Forge':
      agent = new ForgeAgent(config);
      break;
    case 'Oracle':
      agent = new OracleAgent(config);
      break;
    case 'Prism':
      agent = new PrismAgent(config);
      break;
    default:
      throw new Error(`Unknown agent: ${agentId}`);
  }

  await agent.start();
  agents.set(agentId, agent);

  return agent;
}

export async function stopAgent(agentId: AgentId): Promise<void> {
  const agent = agents.get(agentId);
  if (!agent) {
    throw new Error(`Agent ${agentId} is not running`);
  }

  await agent.stop();
  agents.delete(agentId);
}

export async function startAllAgents(): Promise<void> {
  const agentIds: AgentId[] = ['Scout', 'Atlas', 'Sage', 'Mentor', 'Herald', 'Forge', 'Oracle', 'Prism'];
  
  for (const agentId of agentIds) {
    if (!agents.has(agentId)) {
      await startAgent(agentId);
    }
  }
}

export async function stopAllAgents(): Promise<void> {
  for (const [agentId, agent] of agents) {
    await agent.stop();
    agents.delete(agentId);
  }
}

// ============================================================================
// Agent Status
// ============================================================================

export interface AgentStatus {
  id: AgentId;
  name: string;
  status: 'active' | 'idle' | 'busy' | 'blocked' | 'offline';
  tokensUsedToday: number;
  lastHeartbeat: number;
  lastActivity: number;
  errors: number;
}

export function getAgentStatuses(): AgentStatus[] {
  const statuses: AgentStatus[] = [];

  for (const [agentId, agent] of agents) {
    const state = agent.getState();
    const config = agent.getConfig();

    statuses.push({
      id: agentId,
      name: config.name,
      status: state.status,
      tokensUsedToday: state.tokensUsedToday,
      lastHeartbeat: state.lastHeartbeat,
      lastActivity: state.lastActivity,
      errors: state.errors.length,
    });
  }

  return statuses;
}

// ============================================================================
// Configuration
// ============================================================================

export const AGENT_CONFIGS = {
  Scout: SCOUT_CONFIG,
  Atlas: ATLAS_CONFIG,
  Sage: SAGE_CONFIG,
  Mentor: MENTOR_CONFIG,
  Herald: HERALD_CONFIG,
  Forge: FORGE_CONFIG,
  Oracle: ORACLE_CONFIG,
  Prism: PRISM_CONFIG,
};
