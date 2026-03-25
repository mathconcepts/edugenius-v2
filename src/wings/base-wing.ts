/**
 * BaseWing — Thin EventBus wrapper for all wings.
 *
 * Wings are lightweight services that subscribe to domain signals and
 * emit results. No heartbeat, no sub-agents, no autonomy loop.
 *
 *   Wing = EventBus subscriptions + domain logic + signal emissions
 */

import type { EventBus } from '../events/event-bus.js';

export type WingId = 'content' | 'growth' | 'portal';

export interface WingConfig {
  id: WingId;
  name: string;
  /** Event types this wing subscribes to */
  subscriptions: string[];
}

export abstract class BaseWing {
  protected readonly id: WingId;
  protected readonly name: string;
  protected started = false;

  constructor(
    protected readonly bus: EventBus,
    protected readonly config: WingConfig,
  ) {
    this.id = config.id;
    this.name = config.name;
  }

  /** Start the wing — subscribe to signals */
  async start(): Promise<void> {
    if (this.started) return;

    for (const eventType of this.config.subscriptions) {
      // Subscribe with a generic handler that routes to onSignal
      this.bus.subscribe(eventType as any, async (event: any) => {
        try {
          await this.onSignal(eventType, event.payload, event.meta);
        } catch (error) {
          this.emitSignal('wing.error', {
            wingId: this.id,
            eventType,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      });
    }

    this.started = true;
    this.emitSignal('wing.started', { wingId: this.id, name: this.name });
  }

  /** Stop the wing — cleanup */
  async stop(): Promise<void> {
    this.started = false;
    this.emitSignal('wing.stopped', { wingId: this.id });
  }

  /** Override in subclass — handle an incoming signal */
  protected abstract onSignal(
    eventType: string,
    payload: unknown,
    meta: unknown,
  ): Promise<void>;

  /** Emit a signal on the bus */
  protected emitSignal(type: string, payload: Record<string, unknown>): void {
    this.bus.publish(type as any, payload as any, {
      source: this.id as any,
      priority: 'normal',
    });
  }
}
