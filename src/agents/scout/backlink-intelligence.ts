/**
 * backlink-intelligence.ts — BacklinkIntelligence WhatsApp Batch-Arrival Auto-Classifier
 *
 * Spec v1.0 designed by Scout 🔍 | Implemented by Forge ⚙️ | 2026-02-21
 *
 * Classifies incoming WhatsApp batch-arrival traffic by group type:
 *   - teacher_forward   (highest CVR ~30-35%, confidence 0.90)
 *   - peer_study_group  (CVR ~28%, confidence 0.88)
 *   - parent_network    (CVR ~8-12%, confidence 0.75)
 *   - unclassified      (insufficient signal, confidence 0.0)
 *
 * Only confidence >= 0.80 batches feed into Prism's CVR baseline.
 * Protects the 28% clean peer CVR signal from contamination.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export type WhatsAppGroupType =
  | 'teacher_forward'
  | 'peer_study_group'
  | 'parent_network'
  | 'unclassified';

export interface BatchArrivalInput {
  /** utm_source=whatsapp sessions arriving in a rolling 30-min window */
  sessions: SessionArrival[];
  /** Optional: pre-computed from IP prefix / pin code clustering */
  geoCluster?: boolean;
}

export interface SessionArrival {
  sessionId: string;
  arrivalTime: Date;
  utmSource: string;
  utmCampaign?: string;
  /** Number of pages/interactions in the session */
  sessionDepth: number;
  /** Whether session had meaningful interaction (depth >= 3) */
  bounced: boolean;
}

export interface BatchClassification {
  batchId: string;
  groupType: WhatsAppGroupType;
  sessionCount: number;
  arrivalWindowMs: number;
  arrivalHour: number;
  isWeekend: boolean;
  avgSessionDepth: number;
  geoCluster: boolean;
  confidence: number;
  ruleMatched: string;
  utmCampaign?: string;
  firstSessionAt: string;
  lastSessionAt: string;
  /** Cross-validation: groupType doesn't match utm_campaign sub-tag */
  taggingAnomaly?: boolean;
  anomalyDetail?: string;
}

// ─── UTM-to-groupType mapping ─────────────────────────────────────────────────

const UTM_EXPECTED_GROUP: Record<string, WhatsAppGroupType> = {
  'sage_jee_2026_teacher': 'teacher_forward',
  'sage_jee_2026_peer': 'peer_study_group',
  'sage_jee_2026_parent': 'parent_network',
};

// ─── Core Classifier ──────────────────────────────────────────────────────────

/**
 * Classify a batch of WhatsApp session arrivals into a group type.
 * Call this whenever you detect >= 5 sessions with utm_source=whatsapp
 * arriving within a 30-minute window.
 *
 * @param input — batch of session arrivals (pre-filtered: utm_source=whatsapp only)
 * @param geoCluster — whether these sessions share a geo cluster (same pin code / district)
 */
export function classifyWhatsAppBatch(
  input: BatchArrivalInput,
): BatchClassification {
  const { sessions, geoCluster = false } = input;

  // Filter out bots/scrapers before classification
  const validSessions = sessions.filter(
    (s) => !s.bounced && s.sessionDepth >= 1,
  );

  if (validSessions.length === 0) {
    return buildClassification(sessions, 'unclassified', 0.0, 'NO_VALID_SESSIONS', geoCluster);
  }

  const batchSize = validSessions.length;
  const sorted = [...validSessions].sort(
    (a, b) => a.arrivalTime.getTime() - b.arrivalTime.getTime(),
  );
  const firstArrival = sorted[0].arrivalTime;
  const lastArrival = sorted[sorted.length - 1].arrivalTime;
  const arrivalWindowMs = lastArrival.getTime() - firstArrival.getTime();
  const arrivalHour = firstArrival.getUTCHours();
  const isWeekend = [0, 6].includes(firstArrival.getUTCDay()); // 0=Sun, 6=Sat
  const avgSessionDepth =
    validSessions.reduce((sum, s) => sum + s.sessionDepth, 0) / validSessions.length;

  // ── RULE 1: Teacher Forward (peak hours 18–20h, tight cluster) ───────────
  if (
    batchSize >= 30 &&
    arrivalWindowMs <= 600_000 &&
    arrivalHour >= 18 && arrivalHour <= 20
  ) {
    return buildClassification(sessions, 'teacher_forward', 0.90, 'RULE_1', geoCluster);
  }

  // ── RULE 2: Teacher Forward (off-peak, geo-clustered) ───────────────────
  if (
    batchSize >= 30 &&
    arrivalWindowMs <= 600_000 &&
    geoCluster === true
  ) {
    return buildClassification(sessions, 'teacher_forward', 0.80, 'RULE_2', geoCluster);
  }

  // ── RULE 3: Peer Study Group (late-night: 22–24h) ───────────────────────
  if (
    batchSize >= 5 && batchSize <= 20 &&
    arrivalWindowMs >= 900_000 && arrivalWindowMs <= 1_800_000 &&
    (arrivalHour >= 22 || arrivalHour === 0)
  ) {
    return buildClassification(sessions, 'peer_study_group', 0.88, 'RULE_3', geoCluster);
  }

  // ── RULE 4: Peer Study Group (weekend morning: 8–10h) ───────────────────
  if (
    batchSize >= 5 && batchSize <= 20 &&
    arrivalWindowMs >= 900_000 && arrivalWindowMs <= 1_800_000 &&
    isWeekend &&
    arrivalHour >= 8 && arrivalHour <= 10
  ) {
    return buildClassification(sessions, 'peer_study_group', 0.82, 'RULE_4', geoCluster);
  }

  // ── RULE 5: Parent Network (daytime, shallow sessions) ───────────────────
  if (
    batchSize > 5 &&
    arrivalHour >= 10 && arrivalHour <= 13 &&
    avgSessionDepth < 3
  ) {
    return buildClassification(sessions, 'parent_network', 0.75, 'RULE_5', geoCluster);
  }

  // ── RULE 6: Fallback / Unclassified ─────────────────────────────────────
  return buildClassification(sessions, 'unclassified', 0.0, 'RULE_6_FALLBACK', geoCluster);
}

// ─── Cross-Validation ────────────────────────────────────────────────────────

/**
 * Cross-validate groupType against utm_campaign sub-tag.
 * A mismatch means the content was reshared beyond the original target group.
 * This is useful signal for Herald — indicates organic viral spread.
 */
function crossValidate(
  groupType: WhatsAppGroupType,
  utmCampaign?: string,
): { anomaly: boolean; detail?: string } {
  if (!utmCampaign) return { anomaly: false };

  const expectedGroup = UTM_EXPECTED_GROUP[utmCampaign];
  if (!expectedGroup) return { anomaly: false };

  if (expectedGroup !== groupType) {
    return {
      anomaly: true,
      detail: `Classified as '${groupType}' but utm_campaign='${utmCampaign}' expected '${expectedGroup}'. Content likely reshared beyond original target. Signal for @Herald.`,
    };
  }

  return { anomaly: false };
}

// ─── Builder Helper ───────────────────────────────────────────────────────────

function buildClassification(
  sessions: SessionArrival[],
  groupType: WhatsAppGroupType,
  confidence: number,
  ruleMatched: string,
  geoCluster: boolean,
): BatchClassification {
  const sorted = [...sessions].sort(
    (a, b) => a.arrivalTime.getTime() - b.arrivalTime.getTime(),
  );
  const firstSession = sorted[0];
  const lastSession = sorted[sorted.length - 1];

  const firstAt = firstSession?.arrivalTime ?? new Date();
  const lastAt = lastSession?.arrivalTime ?? new Date();
  const arrivalWindowMs = lastAt.getTime() - firstAt.getTime();
  const arrivalHour = firstAt.getUTCHours();
  const isWeekend = [0, 6].includes(firstAt.getUTCDay());
  const avgSessionDepth =
    sessions.length > 0
      ? sessions.reduce((sum, s) => sum + s.sessionDepth, 0) / sessions.length
      : 0;

  // Detect utm_campaign from first session
  const utmCampaign = sessions.find((s) => s.utmCampaign)?.utmCampaign;

  const { anomaly, detail } = crossValidate(groupType, utmCampaign);

  return {
    batchId: `wa_batch_${firstAt.toISOString()}`,
    groupType,
    sessionCount: sessions.length,
    arrivalWindowMs,
    arrivalHour,
    isWeekend,
    avgSessionDepth,
    geoCluster,
    confidence,
    ruleMatched,
    utmCampaign,
    firstSessionAt: firstAt.toISOString(),
    lastSessionAt: lastAt.toISOString(),
    taggingAnomaly: anomaly,
    anomalyDetail: detail,
  };
}

// ─── Confidence Gate ─────────────────────────────────────────────────────────

/**
 * Returns true if this classification should feed into Prism's CVR baseline.
 * Low-confidence events go into an audit bucket instead.
 *
 * Threshold: >= 0.80 confidence required to protect the 28% peer CVR baseline.
 */
export function meetsConfidenceThreshold(classification: BatchClassification): boolean {
  return classification.confidence >= 0.80;
}

// ─── SignalExtractor Integration ─────────────────────────────────────────────

/**
 * SignalExtractor hook — call this from the WhatsApp session ingestion pipeline.
 *
 * Collects sessions within a rolling 30-minute window per utm_source=whatsapp,
 * then fires the classifier when the window closes or when a flush is triggered.
 *
 * Usage:
 *   const extractor = new WhatsAppSignalExtractor();
 *   extractor.ingest(session);  // call per incoming whatsapp session
 *   extractor.flush();          // call on a 30-min timer or end-of-batch
 */
export class WhatsAppSignalExtractor {
  private readonly WINDOW_MS = 30 * 60 * 1000; // 30 minutes
  private readonly MIN_BATCH = 5; // minimum batch size to trigger classifier
  private readonly COOLDOWN_MS = 4 * 60 * 60 * 1000; // 4-hour cooldown per group hash

  private pendingSessions: SessionArrival[] = [];
  private lastBatchAt: number = 0;
  private classifiedBatches: BatchClassification[] = [];

  private onClassified?: (batch: BatchClassification) => void;

  constructor(onClassified?: (batch: BatchClassification) => void) {
    this.onClassified = onClassified;
  }

  /**
   * Ingest a new session arrival. Must have utm_source=whatsapp.
   */
  ingest(session: SessionArrival): void {
    if (session.utmSource !== 'whatsapp') return;

    // Filter bots: session_depth=0 or instant bounce (<5s is handled by bounced flag)
    if (session.bounced && session.sessionDepth === 0) return;

    this.pendingSessions.push(session);

    // Auto-flush if we have >= 30 sessions in a tight window (teacher forward fast detection)
    const windowStart = Date.now() - this.WINDOW_MS;
    const windowSessions = this.pendingSessions.filter(
      (s) => s.arrivalTime.getTime() >= windowStart,
    );

    if (windowSessions.length >= 30) {
      this.flush();
    }
  }

  /**
   * Flush the current session window and classify if we have enough sessions.
   * Should be called every 30 minutes by a scheduler.
   */
  flush(geoCluster?: boolean): BatchClassification | null {
    const windowStart = Date.now() - this.WINDOW_MS;
    const windowSessions = this.pendingSessions.filter(
      (s) => s.arrivalTime.getTime() >= windowStart,
    );

    if (windowSessions.length < this.MIN_BATCH) {
      // Not enough sessions to classify — wait for more
      return null;
    }

    // Check cooldown (prevent same-batch double-classification)
    const timeSinceLastBatch = Date.now() - this.lastBatchAt;
    if (timeSinceLastBatch < this.COOLDOWN_MS && this.lastBatchAt > 0) {
      // Within cooldown window — sessions may be from same broadcast
      // Merge into last batch context by extending pending sessions
      console.log('[BacklinkIntelligence] Within cooldown window, accumulating sessions');
      return null;
    }

    const classification = classifyWhatsAppBatch({
      sessions: windowSessions,
      geoCluster: geoCluster ?? false,
    });

    this.classifiedBatches.push(classification);
    this.lastBatchAt = Date.now();

    // Clear processed sessions from pending
    this.pendingSessions = this.pendingSessions.filter(
      (s) => s.arrivalTime.getTime() < windowStart,
    );

    // Log confidence gate result
    const passesGate = meetsConfidenceThreshold(classification);
    console.log(
      `[BacklinkIntelligence] Batch classified: ${classification.groupType} ` +
      `(confidence=${classification.confidence}, sessions=${classification.sessionCount}, ` +
      `rule=${classification.ruleMatched}, gatePass=${passesGate})`,
    );

    if (classification.taggingAnomaly) {
      console.warn(
        `[BacklinkIntelligence] Tagging anomaly detected: ${classification.anomalyDetail}`,
      );
    }

    // Fire callback for Prism integration
    if (this.onClassified) {
      this.onClassified(classification);
    }

    return classification;
  }

  getClassifiedBatches(): BatchClassification[] {
    return [...this.classifiedBatches];
  }

  /** Returns only high-confidence batches suitable for CVR baseline */
  getConfidentBatches(): BatchClassification[] {
    return this.classifiedBatches.filter(meetsConfidenceThreshold);
  }

  /** Compute CVR breakdown by group type (for Oracle Cycle 4 reporting) */
  getCVRByGroupType(): Record<WhatsAppGroupType, { sessions: number; avgDepth: number }> {
    const result: Record<WhatsAppGroupType, { sessions: number; avgDepth: number }> = {
      teacher_forward: { sessions: 0, avgDepth: 0 },
      peer_study_group: { sessions: 0, avgDepth: 0 },
      parent_network: { sessions: 0, avgDepth: 0 },
      unclassified: { sessions: 0, avgDepth: 0 },
    };

    for (const batch of this.getConfidentBatches()) {
      const entry = result[batch.groupType];
      entry.sessions += batch.sessionCount;
      entry.avgDepth = (entry.avgDepth + batch.avgSessionDepth) / 2;
    }

    return result;
  }
}
