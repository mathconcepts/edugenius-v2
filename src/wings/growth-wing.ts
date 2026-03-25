/**
 * GrowthWing — Telegram bot coordination + distribution.
 *
 * Subscriptions:
 *   - problem.verified   → queue for Telegram posting
 *
 * Emissions:
 *   - problem.posted     → problem was posted to Telegram groups
 *
 * Does NOT replace the daily-problem cron job — that runs independently.
 * This wing handles reactive posting (e.g., when a new problem is verified
 * and should be queued for the next daily post).
 */

import type { EventBus } from '../events/event-bus.js';
import { BaseWing, type WingConfig } from './base-wing.js';

export interface GrowthWingDeps {
  bus: EventBus;
  /** Queue a problem for the next Telegram post */
  queueForTelegram: (problemId: string, topic: string) => Promise<void>;
}

const GROWTH_WING_CONFIG: WingConfig = {
  id: 'growth',
  name: 'Growth Wing',
  subscriptions: [
    'problem.verified',
  ],
};

export class GrowthWing extends BaseWing {
  private queueForTelegram: GrowthWingDeps['queueForTelegram'];

  constructor(deps: GrowthWingDeps) {
    super(deps.bus, GROWTH_WING_CONFIG);
    this.queueForTelegram = deps.queueForTelegram;
  }

  protected async onSignal(
    eventType: string,
    payload: unknown,
    _meta: unknown,
  ): Promise<void> {
    if (eventType === 'problem.verified') {
      const data = payload as { problemId: string; topic: string; traceId?: string };
      await this.queueForTelegram(data.problemId, data.topic);
      this.emitSignal('problem.posted', {
        problemId: data.problemId,
        topic: data.topic,
        channel: 'telegram_queue',
      });
    }
  }
}
