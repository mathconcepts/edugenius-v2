// @ts-nocheck
/**
 * EduGenius SLA Monitor
 * Background monitoring of ticket SLA deadlines — runs every 5 minutes.
 * Warns at 80% of SLA time, auto-escalates at breach.
 */

import type { FeedbackTicket, TicketPriority, SLAHealthReport } from './types';
import { feedbackService, SLA_CONFIG } from './service';

// ============================================================================
// Types
// ============================================================================

export interface SLAWarning {
  ticketId: string;
  priority: TicketPriority;
  stage: 'l1' | 'l2';
  minutesRemaining: number;
  percentRemaining: number;
}

export interface SLABreachReport {
  ticketId: string;
  priority: TicketPriority;
  stage: 'l1' | 'l2';
  minutesOverdue: number;
}

// ============================================================================
// SLAMonitor Class
// ============================================================================

export class SLAMonitor {
  private intervalHandle: ReturnType<typeof setInterval> | null = null;
  private readonly intervalMs: number;
  private warningHandlers: Array<(warnings: SLAWarning[]) => void | Promise<void>> = [];
  private breachHandlers: Array<(breaches: SLABreachReport[]) => void | Promise<void>> = [];

  constructor(intervalMs = 5 * 60 * 1000) {
    this.intervalMs = intervalMs;
  }

  // --------------------------------------------------------------------------
  // Lifecycle
  // --------------------------------------------------------------------------

  start(): void {
    if (this.intervalHandle) {
      console.warn('[SLAMonitor] Already running.');
      return;
    }
    console.log(`[SLAMonitor] Starting — checking every ${this.intervalMs / 1000}s`);
    this.intervalHandle = setInterval(() => {
      this.run().catch((err) => console.error('[SLAMonitor] Run error:', err));
    }, this.intervalMs);

    // Run immediately on start
    this.run().catch(console.error);
  }

  stop(): void {
    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = null;
      console.log('[SLAMonitor] Stopped.');
    }
  }

  // --------------------------------------------------------------------------
  // Event Hooks
  // --------------------------------------------------------------------------

  onWarning(handler: (warnings: SLAWarning[]) => void | Promise<void>): void {
    this.warningHandlers.push(handler);
  }

  onBreach(handler: (breaches: SLABreachReport[]) => void | Promise<void>): void {
    this.breachHandlers.push(handler);
  }

  // --------------------------------------------------------------------------
  // Main Run
  // --------------------------------------------------------------------------

  async run(): Promise<{ warnings: SLAWarning[]; breaches: SLABreachReport[] }> {
    const warnings = await this.sendSLAWarnings();
    const breachedTickets = await feedbackService.checkSLABreaches();

    const breaches: SLABreachReport[] = breachedTickets.map((ticket) => {
      const now = new Date();
      const dueAt = ticket.sla.l2DueAt ?? ticket.sla.l1DueAt;
      const minutesOverdue = Math.round((now.getTime() - dueAt.getTime()) / 60_000);
      return {
        ticketId: ticket.id,
        priority: ticket.priority,
        stage: ticket.sla.l2DueAt ? 'l2' : 'l1',
        minutesOverdue: Math.max(0, minutesOverdue),
      };
    });

    // Notify breach handlers
    if (breaches.length > 0) {
      for (const handler of this.breachHandlers) {
        try {
          await handler(breaches);
        } catch (err) {
          console.error('[SLAMonitor] Breach handler error:', err);
        }
      }
    }

    return { warnings, breaches };
  }

  // --------------------------------------------------------------------------
  // Warning Notifications (at 80% SLA time)
  // --------------------------------------------------------------------------

  async sendSLAWarnings(): Promise<SLAWarning[]> {
    const now = new Date();
    const warnings: SLAWarning[] = [];
    const activeTickets = feedbackService.getAllActiveTickets();

    for (const ticket of activeTickets) {
      if (ticket.sla.breached) continue;

      const config = SLA_CONFIG[ticket.priority];

      // L1 warning check
      if (ticket.status === 'open' || ticket.status === 'l1_processing') {
        const l1TotalMs = config.l1MaxMinutes * 60_000;
        const l1ElapsedMs = now.getTime() - ticket.createdAt.getTime();
        const l1RemainingMs = ticket.sla.l1DueAt.getTime() - now.getTime();
        const l1PercentElapsed = l1ElapsedMs / l1TotalMs;

        if (l1PercentElapsed >= 0.8 && l1RemainingMs > 0) {
          warnings.push({
            ticketId: ticket.id,
            priority: ticket.priority,
            stage: 'l1',
            minutesRemaining: Math.round(l1RemainingMs / 60_000),
            percentRemaining: Math.round((1 - l1PercentElapsed) * 100),
          });
        }
      }

      // L2 warning check
      if (
        (ticket.status === 'l2_escalated' || ticket.status === 'l2_processing') &&
        ticket.sla.l2DueAt
      ) {
        const l2TotalMs = config.l2MaxMinutes * 60_000;
        const l2EscalatedAt = ticket.auditTrail
          .slice()
          .reverse()
          .find((e) => e.action === 'escalated_to_l2')?.timestamp;
        const l2StartMs = l2EscalatedAt
          ? new Date(l2EscalatedAt).getTime()
          : ticket.createdAt.getTime();
        const l2ElapsedMs = now.getTime() - l2StartMs;
        const l2RemainingMs = ticket.sla.l2DueAt.getTime() - now.getTime();
        const l2PercentElapsed = l2ElapsedMs / l2TotalMs;

        if (l2PercentElapsed >= 0.8 && l2RemainingMs > 0) {
          warnings.push({
            ticketId: ticket.id,
            priority: ticket.priority,
            stage: 'l2',
            minutesRemaining: Math.round(l2RemainingMs / 60_000),
            percentRemaining: Math.round((1 - l2PercentElapsed) * 100),
          });
        }
      }
    }

    // Notify warning handlers
    if (warnings.length > 0) {
      console.log(`[SLAMonitor] ${warnings.length} SLA warning(s) triggered.`);
      for (const handler of this.warningHandlers) {
        try {
          await handler(warnings);
        } catch (err) {
          console.error('[SLAMonitor] Warning handler error:', err);
        }
      }
    }

    return warnings;
  }

  // --------------------------------------------------------------------------
  // SLA Health Report
  // --------------------------------------------------------------------------

  async getSLAHealth(): Promise<SLAHealthReport> {
    const now = new Date();
    const activeTickets = feedbackService.getAllActiveTickets();

    let healthy = 0;
    let warning = 0;
    let breached = 0;

    const ticketsAtRisk: SLAHealthReport['ticketsAtRisk'] = [];

    for (const ticket of activeTickets) {
      const config = SLA_CONFIG[ticket.priority];

      if (ticket.sla.breached) {
        breached++;
        continue;
      }

      const isL2 = ticket.sla.l2DueAt && (ticket.status === 'l2_escalated' || ticket.status === 'l2_processing');
      const dueAt = isL2 ? ticket.sla.l2DueAt! : ticket.sla.l1DueAt;
      const totalMinutes = isL2 ? config.l2MaxMinutes : config.l1MaxMinutes;
      const remainingMs = dueAt.getTime() - now.getTime();
      const remainingMinutes = remainingMs / 60_000;
      const percentRemaining = remainingMinutes / totalMinutes;

      if (percentRemaining < 0.2) {
        // Within 20% of deadline = warning zone
        warning++;
        ticketsAtRisk.push({
          ticketId: ticket.id,
          priority: ticket.priority,
          minutesRemaining: Math.max(0, Math.round(remainingMinutes)),
          stage: isL2 ? 'l2' : 'l1',
        });
      } else {
        healthy++;
      }
    }

    // Compute averages from all resolved tickets
    const stats = await feedbackService.getTicketStats();

    return {
      healthy,
      warning,
      breached,
      breachRate: activeTickets.length
        ? (breached / activeTickets.length) * 100
        : 0,
      avgTimeToL1ResolutionMinutes: stats.avgResolutionMinutes.l1,
      avgTimeToL2ResolutionMinutes: stats.avgResolutionMinutes.l2,
      ticketsAtRisk: ticketsAtRisk.sort((a, b) => a.minutesRemaining - b.minutesRemaining),
    };
  }
}

// ============================================================================
// Singleton
// ============================================================================

export const slaMonitor = new SLAMonitor();
