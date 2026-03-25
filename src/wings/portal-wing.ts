/**
 * PortalWing — SEO page generation + static content management.
 *
 * Subscriptions:
 *   - problem.verified   → generate SEO page for the verified problem
 *
 * Emissions:
 *   - seo.page_created   → new SEO page ready
 *
 * Generates pre-rendered HTML with KaTeX for Google indexing.
 */

import type { EventBus } from '../events/event-bus.js';
import { BaseWing, type WingConfig } from './base-wing.js';

export interface PortalWingDeps {
  bus: EventBus;
  /** Generate and store an SEO page for a problem */
  generateSEOPage: (problemId: string, topic: string) => Promise<{ slug: string } | null>;
}

const PORTAL_WING_CONFIG: WingConfig = {
  id: 'portal',
  name: 'Portal Wing',
  subscriptions: [
    'problem.verified',
  ],
};

export class PortalWing extends BaseWing {
  private generateSEOPage: PortalWingDeps['generateSEOPage'];

  constructor(deps: PortalWingDeps) {
    super(deps.bus, PORTAL_WING_CONFIG);
    this.generateSEOPage = deps.generateSEOPage;
  }

  protected async onSignal(
    eventType: string,
    payload: unknown,
    _meta: unknown,
  ): Promise<void> {
    if (eventType === 'problem.verified') {
      const data = payload as { problemId: string; topic: string };

      const result = await this.generateSEOPage(data.problemId, data.topic);
      if (result) {
        this.emitSignal('seo.page_created', {
          problemId: data.problemId,
          slug: result.slug,
          topic: data.topic,
        });
      }
    }
  }
}
