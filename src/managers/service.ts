/**
 * Manager Service
 * Handles manager CRUD, exam scope assignment, ticket routing,
 * outreach dispatch, and update trigger lifecycle.
 */

import { EventEmitter } from 'events';
import type {
  Manager, ManagerExamScope, ManagerOutreach, ManagerUpdateTrigger,
  ManagerTicketAssignment, ManagerStudentView,
  CreateManagerRequest, UpdateManagerScopeRequest,
  SendOutreachRequest, TriggerUpdateRequest,
  ManagerSearchFilters, OutreachChannel, ManagerOutreachSettings,
} from './types';
import type { ExamType } from '../users/types';

export class ManagerService extends EventEmitter {
  private managers   = new Map<string, Manager>();
  private assignments = new Map<string, ManagerTicketAssignment>();
  private outreaches  = new Map<string, ManagerOutreach>();
  private triggers    = new Map<string, ManagerUpdateTrigger>();

  private idSeq = { manager: 0, outreach: 0, trigger: 0, assign: 0 };
  private nextId(type: keyof typeof this.idSeq) {
    return `${type.toUpperCase()}-${String(++this.idSeq[type]).padStart(6, '0')}`;
  }

  // ── Default outreach settings ────────────────────────────────────────────
  private defaultOutreachSettings(): ManagerOutreachSettings {
    return {
      preferredChannels: ['email', 'whatsapp'],
      dailyOutreachLimit: 50,
      quietHoursStart: '22:00',
      quietHoursEnd: '07:00',
      autoFollowUpDays: 3,
      proactiveCheckinEnabled: true,
      checkinFrequencyDays: 7,
      atRiskThresholdDays: 5,
      lowScoreThreshold: 40,
      // Lifecycle-aware defaults
      lifecycleRulesEnabled: true,
      customRules: [],
      acquisitionEnabled: true,
      onboardingEnabled: true,
      deliveryNudgesEnabled: true,
    };
  }

  // ── CREATE ────────────────────────────────────────────────────────────────

  async createManager(req: CreateManagerRequest, createdBy: string): Promise<Manager> {
    const id = this.nextId('manager');
    const now = new Date();

    const scopes: ManagerExamScope[] = req.examScopes.map(s => ({
      ...s,
      assignedAt: now,
      assignedBy: createdBy,
    }));

    const manager: Manager = {
      id,
      userId: req.userId,
      firstName: '',
      lastName: '',
      email: '',
      status: 'active',
      examScopes: scopes,
      outreachSettings: { ...this.defaultOutreachSettings(), ...req.outreachSettings },
      metrics: {
        ticketsAssigned: 0, ticketsResolved: 0,
        avgResolutionMinutes: 0, slaBreaches: 0, csat: 0,
        proactiveOutreachSent: 0, atRiskStudentsIntervened: 0,
        contentUpdatesTriggered: 0, escalationRate: 0, reopenRate: 0,
      },
      createdAt: now, updatedAt: now, createdBy,
    };

    this.managers.set(id, manager);
    this.emit('manager:created', manager);
    return manager;
  }

  // ── READ ──────────────────────────────────────────────────────────────────

  async getManager(id: string): Promise<Manager | null> {
    return this.managers.get(id) ?? null;
  }

  async getManagerByUserId(userId: string): Promise<Manager | null> {
    for (const m of this.managers.values()) {
      if (m.userId === userId) return m;
    }
    return null;
  }

  async listManagers(filters: ManagerSearchFilters = {}): Promise<Manager[]> {
    let results = Array.from(this.managers.values());
    if (filters.examId)       results = results.filter(m => m.examScopes.some(s => s.examId === filters.examId));
    if (filters.status)       results = results.filter(m => m.status === filters.status);
    if (filters.hasOpenTickets) {
      const withOpen = new Set(
        Array.from(this.assignments.values()).filter(a => !a.resolvedAt).map(a => a.managerId)
      );
      results = results.filter(m => withOpen.has(m.id));
    }
    // Sort
    if (filters.sortBy === 'csat')       results.sort((a, b) => b.metrics.csat - a.metrics.csat);
    if (filters.sortBy === 'tickets')    results.sort((a, b) => b.metrics.ticketsAssigned - a.metrics.ticketsAssigned);
    if (filters.sortBy === 'lastActive') results.sort((a, b) => (b.lastActiveAt?.getTime() ?? 0) - (a.lastActiveAt?.getTime() ?? 0));
    const offset = filters.offset ?? 0;
    const limit  = filters.limit  ?? 50;
    return results.slice(offset, offset + limit);
  }

  // ── SCOPE MANAGEMENT ─────────────────────────────────────────────────────

  async updateExamScopes(req: UpdateManagerScopeRequest, updatedBy: string): Promise<Manager> {
    const manager = this.managers.get(req.managerId);
    if (!manager) throw new Error(`Manager ${req.managerId} not found`);

    const now = new Date();
    manager.examScopes = req.examScopes.map(s => ({ ...s, assignedAt: now, assignedBy: updatedBy }));
    manager.updatedAt = now;

    this.emit('manager:scopes_updated', manager);
    return manager;
  }

  async addExamScope(managerId: string, scope: Omit<ManagerExamScope, 'assignedAt' | 'assignedBy'>, assignedBy: string): Promise<Manager> {
    const manager = this.managers.get(managerId);
    if (!manager) throw new Error(`Manager ${managerId} not found`);

    const now = new Date();
    const existing = manager.examScopes.findIndex(s => s.examId === scope.examId);
    if (existing >= 0) {
      manager.examScopes[existing] = { ...scope, assignedAt: now, assignedBy };
    } else {
      manager.examScopes.push({ ...scope, assignedAt: now, assignedBy });
    }
    manager.updatedAt = now;
    this.emit('manager:scope_added', { manager, scope: scope.examId });
    return manager;
  }

  async removeExamScope(managerId: string, examId: ExamType): Promise<Manager> {
    const manager = this.managers.get(managerId);
    if (!manager) throw new Error(`Manager ${managerId} not found`);
    manager.examScopes = manager.examScopes.filter(s => s.examId !== examId);
    manager.updatedAt = new Date();
    this.emit('manager:scope_removed', { manager, examId });
    return manager;
  }

  // ── TICKET ROUTING ────────────────────────────────────────────────────────

  /**
   * Route an L2-escalated ticket to the best available manager.
   * Priority: exam match → fewest open tickets → highest CSAT.
   */
  async routeTicket(ticketId: string, examId: ExamType | undefined, priority: string, category: string): Promise<ManagerTicketAssignment | null> {
    const eligible = Array.from(this.managers.values())
      .filter(m => m.status === 'active')
      .filter(m => !examId || m.examScopes.some(s => s.examId === examId));

    if (eligible.length === 0) return null;

    // Count open tickets per manager
    const openCounts = new Map<string, number>();
    for (const a of this.assignments.values()) {
      if (!a.resolvedAt) openCounts.set(a.managerId, (openCounts.get(a.managerId) ?? 0) + 1);
    }

    // Score: prefer fewer open tickets, then higher CSAT
    eligible.sort((a, b) => {
      const openDiff = (openCounts.get(a.id) ?? 0) - (openCounts.get(b.id) ?? 0);
      if (openDiff !== 0) return openDiff;
      return b.metrics.csat - a.metrics.csat;
    });

    const manager = eligible[0];
    const slaMinutes = priority === 'critical' ? 60 : priority === 'high' ? 240 : 1440;
    const now = new Date();

    const assignment: ManagerTicketAssignment = {
      ticketId,
      managerId: manager.id,
      examId: examId ?? 'OTHER' as ExamType,
      assignedAt: now,
      assignedBy: 'auto',
      priority: priority as any,
      category: category as any,
      dueAt: new Date(now.getTime() + slaMinutes * 60 * 1000),
    };

    this.assignments.set(ticketId, assignment);
    manager.metrics.ticketsAssigned++;
    manager.updatedAt = now;

    this.emit('ticket:assigned_to_manager', { assignment, manager });
    return assignment;
  }

  async resolveTicket(
    ticketId: string, managerId: string,
    resolution: string, note: string,
    updateTriggered?: string, rating?: number,
  ): Promise<ManagerTicketAssignment> {
    const assignment = this.assignments.get(ticketId);
    if (!assignment || assignment.managerId !== managerId) {
      throw new Error('Assignment not found or not owned by this manager');
    }
    const manager = this.managers.get(managerId)!;
    const now = new Date();

    assignment.resolvedAt = now;
    assignment.resolution = resolution;
    assignment.internalNote = note;
    assignment.updateTriggered = updateTriggered as any;
    assignment.satisfactionRating = rating;

    // Update metrics
    manager.metrics.ticketsResolved++;
    if (rating) {
      const prev = manager.metrics.csat;
      const count = manager.metrics.ticketsResolved;
      manager.metrics.csat = (prev * (count - 1) + rating) / count;
    }
    const slaBreached = now > assignment.dueAt;
    if (slaBreached) manager.metrics.slaBreaches++;
    manager.updatedAt = now;

    this.emit('ticket:manager_resolved', { assignment, manager, slaBreached });
    return assignment;
  }

  // ── OUTREACH ─────────────────────────────────────────────────────────────

  async sendOutreach(req: SendOutreachRequest): Promise<ManagerOutreach[]> {
    const manager = this.managers.get(req.managerId);
    if (!manager) throw new Error(`Manager ${req.managerId} not found`);

    const results: ManagerOutreach[] = [];
    const now = req.scheduleAt ?? new Date();

    for (const studentId of req.studentIds) {
      const outreach: ManagerOutreach = {
        id: this.nextId('outreach'),
        managerId: req.managerId,
        studentId,
        examId: manager.examScopes[0]?.examId ?? 'OTHER' as ExamType,
        type: req.type,
        channel: req.channel,
        message: req.message,
        subject: req.subject,
        sentAt: now,
        triggeredBy: 'manual',
      };
      this.outreaches.set(outreach.id, outreach);
      results.push(outreach);
      manager.metrics.proactiveOutreachSent++;
    }

    this.emit('outreach:sent', { manager, outreaches: results });
    return results;
  }

  async getOutreachHistory(managerId: string, limit = 50): Promise<ManagerOutreach[]> {
    return Array.from(this.outreaches.values())
      .filter(o => o.managerId === managerId)
      .sort((a, b) => (b.sentAt?.getTime() ?? 0) - (a.sentAt?.getTime() ?? 0))
      .slice(0, limit);
  }

  // ── UPDATE TRIGGERS ───────────────────────────────────────────────────────

  async triggerUpdate(req: TriggerUpdateRequest): Promise<ManagerUpdateTrigger> {
    const manager = this.managers.get(req.managerId);
    if (!manager) throw new Error(`Manager ${req.managerId} not found`);

    // Verify manager has scope for this exam
    const scope = manager.examScopes.find(s => s.examId === req.examId);
    if (!scope) throw new Error(`Manager does not have scope for exam ${req.examId}`);
    if (!scope.canTriggerUpdates) throw new Error(`Manager does not have update trigger permission`);

    const now = new Date();
    const trigger: ManagerUpdateTrigger = {
      id: this.nextId('trigger'),
      managerId: req.managerId,
      examId: req.examId,
      type: req.type,
      description: req.description,
      urgency: req.urgency,
      status: req.urgency === 'critical' ? 'approved' : 'pending',
      affectedStudentCount: 0,
      relatedTicketIds: req.relatedTicketIds ?? [],
      createdAt: now,
      updatedAt: now,
    };

    this.triggers.set(trigger.id, trigger);
    manager.metrics.contentUpdatesTriggered++;
    manager.updatedAt = now;

    this.emit('update:triggered', { trigger, manager });

    // Auto-dispatch to Atlas (content) or Forge (deploy) based on type
    const agentTarget = ['content_fix', 'syllabus_update', 'agent_prompt_update'].includes(req.type)
      ? 'atlas' : 'forge';
    this.emit('agent:task_requested', { agentTarget, trigger });

    return trigger;
  }

  async approveUpdate(triggerId: string, approvedBy: string): Promise<ManagerUpdateTrigger> {
    const trigger = this.triggers.get(triggerId);
    if (!trigger) throw new Error(`Trigger ${triggerId} not found`);
    trigger.status = 'approved';
    trigger.approvedBy = approvedBy;
    trigger.updatedAt = new Date();
    this.emit('update:approved', trigger);
    return trigger;
  }

  async getTriggers(managerId?: string, examId?: ExamType): Promise<ManagerUpdateTrigger[]> {
    return Array.from(this.triggers.values())
      .filter(t => (!managerId || t.managerId === managerId) && (!examId || t.examId === examId))
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  // ── STUDENT VISIBILITY ────────────────────────────────────────────────────

  /**
   * Returns at-risk students across all exams this manager owns.
   * In production this would query the DB; here we return a stub list.
   */
  async getAtRiskStudents(managerId: string): Promise<ManagerStudentView[]> {
    const manager = this.managers.get(managerId);
    if (!manager) return [];
    // Stub — in production join with users + analytics tables
    return [];
  }

  // ── STATS ─────────────────────────────────────────────────────────────────

  async getManagerStats(managerId: string) {
    const manager = this.managers.get(managerId);
    if (!manager) throw new Error('Not found');

    const openTickets = Array.from(this.assignments.values())
      .filter(a => a.managerId === managerId && !a.resolvedAt);
    const overdueTickets = openTickets.filter(a => new Date() > a.dueAt);

    return {
      ...manager.metrics,
      openTickets: openTickets.length,
      overdueTickets: overdueTickets.length,
      examCount: manager.examScopes.length,
    };
  }
}

export const managerService = new ManagerService();
