/**
 * EduGenius - Main Entry Point
 * 
 * An autonomous AI agent platform for educational technology
 * 
 * @module edugenius
 */

// Core Infrastructure
export * from './llm';
export * from './events';
export * from './data';

// Agents
export * from './agents';

// Orchestrator
export * from './orchestrator';

// API
export * from './api';

// ============================================================================
// Quick Start
// ============================================================================

import { getOrchestrator, EduGeniusOrchestrator } from './orchestrator';
import { createAPIServer, APIServer } from './api';

export interface StartOptions {
  api?: boolean;
  apiPort?: number;
  enabledAgents?: Array<'Scout' | 'Atlas' | 'Sage' | 'Mentor' | 'Herald' | 'Forge' | 'Oracle'>;
}

/**
 * Start the EduGenius system
 * 
 * @example
 * ```typescript
 * import { start } from 'edugenius';
 * 
 * const { orchestrator, api } = await start({
 *   api: true,
 *   apiPort: 3000,
 * });
 * 
 * // Start a tutoring session
 * const sessionId = await orchestrator.startTutoringSession('student-123', 'algebra');
 * 
 * // Check analytics
 * const report = await orchestrator.getReport('daily');
 * ```
 */
export async function start(options: StartOptions = {}): Promise<{
  orchestrator: EduGeniusOrchestrator;
  api?: APIServer;
}> {
  const orchestrator = getOrchestrator({
    enabledAgents: options.enabledAgents,
  });

  await orchestrator.start();

  let api: APIServer | undefined;

  if (options.api !== false) {
    api = createAPIServer({
      port: options.apiPort || 3000,
    });
    await api.start();
  }

  // Graceful shutdown
  const shutdown = async () => {
    console.log('\n[EduGenius] Shutting down...');
    if (api) await api.stop();
    await orchestrator.stop();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  return { orchestrator, api };
}

// ============================================================================
// CLI Entry Point
// ============================================================================

if (require.main === module) {
  const port = parseInt(process.env.PORT || '3000', 10);

  start({
    api: true,
    apiPort: port,
  }).then(({ orchestrator }) => {
    console.log(`
╔════════════════════════════════════════════════════════════╗
║                                                            ║
║   ███████╗██████╗ ██╗   ██╗ ██████╗ ███████╗███╗   ██╗    ║
║   ██╔════╝██╔══██╗██║   ██║██╔════╝ ██╔════╝████╗  ██║    ║
║   █████╗  ██║  ██║██║   ██║██║  ███╗█████╗  ██╔██╗ ██║    ║
║   ██╔══╝  ██║  ██║██║   ██║██║   ██║██╔══╝  ██║╚██╗██║    ║
║   ███████╗██████╔╝╚██████╔╝╚██████╔╝███████╗██║ ╚████║    ║
║   ╚══════╝╚═════╝  ╚═════╝  ╚═════╝ ╚══════╝╚═╝  ╚═══╝    ║
║                                                            ║
║   🎓 Autonomous AI Education Platform                      ║
║                                                            ║
╠════════════════════════════════════════════════════════════╣
║                                                            ║
║   API Server:  http://localhost:${port.toString().padEnd(24)}║
║   Status:      ${orchestrator.getStatus().status.padEnd(33)}║
║   Agents:      ${orchestrator.getStatus().agents.length.toString().padEnd(33)}║
║                                                            ║
║   Endpoints:                                               ║
║     GET  /status              System status                ║
║     GET  /agents              List all agents              ║
║     POST /tutoring/sessions   Start tutoring               ║
║     POST /content             Create content               ║
║     GET  /analytics/report    Get analytics                ║
║                                                            ║
╚════════════════════════════════════════════════════════════╝
`);
  }).catch(console.error);
}
