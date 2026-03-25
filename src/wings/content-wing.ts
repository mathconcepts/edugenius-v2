/**
 * ContentWing — Generates and serves verified GATE math problems.
 *
 * Subscriptions:
 *   - student.weak_topic → generate targeted problem for weak area
 *   - problem.requested  → serve a problem for a given topic
 *
 * Emissions:
 *   - problem.verified   → a new problem has been verified and is ready
 *   - problem.served     → a problem was served to a student
 */

import type { EventBus } from '../events/event-bus.js';
import type { TieredVerificationOrchestrator } from '../verification/tiered-orchestrator.js';
import { BaseWing, type WingConfig } from './base-wing.js';

export interface GATEProblem {
  id: string;
  topic: string;
  statement: string;
  answer: string;
  solution: string;
  difficulty: 'easy' | 'medium' | 'hard';
  year?: number;
  verified: boolean;
  verificationTraceId?: string;
}

export interface ContentWingDeps {
  bus: EventBus;
  orchestrator: TieredVerificationOrchestrator;
  /** Fetch problems from DB/seed data by topic */
  getProblemsByTopic: (topic: string, limit?: number) => Promise<GATEProblem[]>;
  /** Store a verified problem */
  storeProblem: (problem: GATEProblem) => Promise<void>;
}

const CONTENT_WING_CONFIG: WingConfig = {
  id: 'content',
  name: 'Content Wing',
  subscriptions: [
    'student.weak_topic',
    'problem.requested',
  ],
};

export class ContentWing extends BaseWing {
  private orchestrator: TieredVerificationOrchestrator;
  private getProblemsByTopic: ContentWingDeps['getProblemsByTopic'];
  private storeProblem: ContentWingDeps['storeProblem'];

  constructor(deps: ContentWingDeps) {
    super(deps.bus, CONTENT_WING_CONFIG);
    this.orchestrator = deps.orchestrator;
    this.getProblemsByTopic = deps.getProblemsByTopic;
    this.storeProblem = deps.storeProblem;
  }

  protected async onSignal(
    eventType: string,
    payload: unknown,
    _meta: unknown,
  ): Promise<void> {
    switch (eventType) {
      case 'student.weak_topic':
        await this.handleWeakTopic(payload as { studentId: string; topic: string });
        break;
      case 'problem.requested':
        await this.handleProblemRequest(payload as { topic: string; sessionId: string });
        break;
    }
  }

  /**
   * When a student has a weak topic, find/generate a targeted problem.
   */
  private async handleWeakTopic(payload: { studentId: string; topic: string }): Promise<void> {
    const problems = await this.getProblemsByTopic(payload.topic, 1);
    if (problems.length === 0) return;

    const problem = problems[0];

    // Verify if not already verified
    if (!problem.verified) {
      const result = await this.orchestrator.verify(
        problem.statement,
        problem.answer,
        { subject: 'mathematics', topic: payload.topic },
      );

      problem.verified = result.overallStatus === 'verified';
      problem.verificationTraceId = result.traceId;

      if (problem.verified) {
        await this.storeProblem(problem);
      }
    }

    if (problem.verified) {
      this.emitSignal('problem.verified', {
        problemId: problem.id,
        topic: problem.topic,
        studentId: payload.studentId,
        traceId: problem.verificationTraceId,
      });
    }
  }

  /**
   * Serve a problem for a requested topic.
   */
  private async handleProblemRequest(payload: { topic: string; sessionId: string }): Promise<void> {
    const problems = await this.getProblemsByTopic(payload.topic, 5);

    // Prefer already-verified problems
    const verified = problems.filter(p => p.verified);
    const problem = verified.length > 0 ? verified[0] : problems[0];

    if (!problem) return;

    this.emitSignal('problem.served', {
      problemId: problem.id,
      topic: problem.topic,
      sessionId: payload.sessionId,
      verified: problem.verified,
    });
  }
}
