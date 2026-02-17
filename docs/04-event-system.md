# Event System

The event bus enables loose coupling between agents through typed, priority-aware message passing.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         EVENT BUS                            │
│                                                              │
│  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐    │
│  │  Subscriptions │  │ Priority Queue│  │  Dead Letter  │    │
│  │    Registry    │  │   (by level)  │  │    Queue      │    │
│  └───────────────┘  └───────────────┘  └───────────────┘    │
│                                                              │
├──────────────────────────────────────────────────────────────┤
│                      AGENT CHANNELS                          │
│                                                              │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐     │
│  │Scout │ │Atlas │ │ Sage │ │Mentor│ │Herald│ │Forge │     │
│  └──────┘ └──────┘ └──────┘ └──────┘ └──────┘ └──────┘     │
│                                                              │
│                        ┌──────┐                              │
│                        │Oracle│                              │
│                        └──────┘                              │
└──────────────────────────────────────────────────────────────┘
```

---

## Event Types

All events are strongly typed:

```typescript
// Event type definition
interface BaseEvent<T = unknown> {
  id: string;           // Unique event ID
  type: string;         // Event type (e.g., 'scout.trend.found')
  payload: T;           // Event data
  timestamp: number;    // Unix timestamp
  source?: string;      // Source agent
  correlationId?: string; // For tracking related events
  priority?: EventPriority;
}

type EventPriority = 'critical' | 'high' | 'normal' | 'low';
```

---

## Event Naming Convention

Events follow a hierarchical naming pattern:

```
{agent}.{domain}.{action}
```

### Examples

| Event Type | Description |
|------------|-------------|
| `scout.trend.found` | Scout found a new trend |
| `atlas.content.published` | Atlas published content |
| `sage.session.ended` | Sage ended tutoring session |
| `mentor.engagement.alert` | Mentor detected engagement issue |
| `herald.campaign.launched` | Herald launched campaign |
| `forge.deploy.completed` | Forge completed deployment |
| `oracle.anomaly.detected` | Oracle detected anomaly |

---

## Event Catalog

### Scout Events

```typescript
// Trend discovery
interface TrendFoundPayload {
  trendId: string;
  keyword: string;
  growth: number;
  source: string;
  relatedTopics: string[];
}

// Competitor update
interface CompetitorChangedPayload {
  competitorId: string;
  changeType: 'pricing' | 'feature' | 'content' | 'other';
  details: Record<string, unknown>;
}

// Opportunity found
interface OpportunityFoundPayload {
  type: 'content_gap' | 'keyword' | 'market_demand';
  topic: string;
  priority: number;
  suggestedActions: string[];
}
```

### Atlas Events

```typescript
// Content created
interface ContentCreatedPayload {
  contentId: string;
  title: string;
  contentType: 'lesson' | 'quiz' | 'summary' | 'practice';
  subject: string;
  topic: string;
  wordCount: number;
  createdAt: number;
}

// Content published
interface ContentPublishedPayload {
  contentId: string;
  url: string;
  publishedAt: number;
}
```

### Sage Events

```typescript
// Tutor request
interface TutorRequestPayload {
  sessionId: string;
  studentId: string;
  question: string;
  subject: string;
  topic: string;
}

// Tutor response
interface TutorResponsePayload {
  sessionId: string;
  studentId: string;
  response: string;
  responseType: 'question' | 'explanation' | 'hint' | 'encouragement';
  masteryUpdate?: { topic: string; before: number; after: number };
}

// Progress updated
interface StudentProgressPayload {
  studentId: string;
  subject: string;
  topic: string;
  masteryLevel: number;
  questionsAttempted: number;
  questionsCorrect: number;
  timeSpent: number;
  streakDays: number;
}
```

### Mentor Events

```typescript
// Engagement alert
interface EngagementAlertPayload {
  studentId: string;
  alertType: 'churn_risk' | 'inactivity' | 'declining_engagement';
  score: number;
  factors: Record<string, number>;
  recommendedAction: string;
  urgency: 'low' | 'medium' | 'high' | 'critical';
}

// Nudge sent
interface NudgeSentPayload {
  nudgeId: string;
  studentId: string;
  nudgeType: 'reminder' | 'encouragement' | 'challenge' | 'celebration';
  channel: 'push' | 'email' | 'whatsapp' | 'sms';
  sentAt: number;
  delivered: boolean;
}
```

### Herald Events

```typescript
// Campaign launched
interface CampaignLaunchedPayload {
  campaignId: string;
  campaignType: string;
  assets: Array<{ type: string; url: string; channel: string }>;
  launchedAt: number;
}

// Lead captured
interface LeadCapturedPayload {
  leadId: string;
  source: string;
  campaign?: string;
  email?: string;
  phone?: string;
  interests: string[];
  capturedAt: number;
}
```

### Forge Events

```typescript
// Deploy requested
interface DeployRequestPayload {
  environment: 'development' | 'staging' | 'production';
  version: string;
  artifact?: string;
  config?: Record<string, unknown>;
}

// Deploy completed
interface DeployCompletedPayload {
  deploymentId: string;
  environment: string;
  version: string;
  status: 'success' | 'failed' | 'rolled_back';
  duration?: number;
  error?: string;
  completedAt: number;
}
```

### Oracle Events

```typescript
// Analytics event
interface AnalyticsEventPayload {
  event: string;
  source: string;
  properties: Record<string, unknown>;
  timestamp: number;
}

// Anomaly detected
interface AnomalyAlertPayload {
  metric: string;
  type: 'spike' | 'drop';
  severity: 'low' | 'medium' | 'high' | 'critical';
  value: number;
  expected: number;
  deviation: number;
  detectedAt: number;
}

// Report generated
interface AnalyticsReportPayload {
  reportId: string;
  reportType: 'daily' | 'weekly' | 'monthly';
  period: string;
  highlights: string[];
  anomalyCount: number;
  generatedAt: number;
}
```

---

## Publishing Events

### Basic Publishing

```typescript
import { EventBus } from 'edugenius';

const eventBus = new EventBus();

// Publish event
await eventBus.publish('scout.trend.found', {
  trendId: 'trend-123',
  keyword: 'AI tutoring',
  growth: 150,
  source: 'google-trends',
});
```

### With Priority

```typescript
await eventBus.publish('mentor.engagement.alert', {
  studentId: 'student-123',
  alertType: 'churn_risk',
  score: 0.85,
  urgency: 'critical',
}, { priority: 'critical' });
```

### With Correlation

```typescript
const correlationId = 'workflow-abc123';

await eventBus.publish('forge.deploy.requested', {
  environment: 'production',
  version: 'v1.2.3',
}, { correlationId });

// Later events in same workflow
await eventBus.publish('forge.deploy.completed', {
  status: 'success',
}, { correlationId });
```

---

## Subscribing to Events

### Basic Subscription

```typescript
const unsubscribe = eventBus.subscribe('atlas.content.published', async (event) => {
  console.log('Content published:', event.payload.contentId);
});

// Later: unsubscribe
unsubscribe();
```

### Wildcard Subscription

```typescript
// Subscribe to all Scout events
eventBus.subscribeAll('scout.*', async (event) => {
  console.log('Scout event:', event.type, event.payload);
});

// Subscribe to all events
eventBus.subscribeAll('*', async (event) => {
  metrics.trackEvent(event);
});
```

### Once (Single Use)

```typescript
eventBus.once('forge.deploy.completed', async (event) => {
  // Only triggers once, then auto-unsubscribes
  notifyTeam(event.payload);
});
```

---

## Agent Channels

Each agent has a dedicated channel for communication:

```typescript
import { AgentChannel } from 'edugenius';

const scoutChannel = new AgentChannel('Scout', eventBus);

// Subscribe to events for this agent
scoutChannel.subscribe('request.market.scan', async (event) => {
  await performMarketScan();
});

// Publish from this agent
scoutChannel.publish('scout.trend.found', { ... });
```

---

## Workflow Orchestration

The WorkflowOrchestrator enables multi-step, event-driven workflows:

### Workflow Definition

```typescript
const examLaunchWorkflow: WorkflowDefinition = {
  id: 'exam-launch',
  name: 'New Exam Launch',
  version: '1.0.0',
  steps: [
    {
      id: 'research',
      name: 'Market Research',
      agentId: 'Scout',
      action: 'analyze_exam',
      timeout: 300000,
    },
    {
      id: 'content-plan',
      name: 'Content Planning',
      agentId: 'Atlas',
      action: 'plan_content',
      dependencies: ['research'],  // Waits for research to complete
    },
    {
      id: 'content-create',
      name: 'Content Creation',
      agentId: 'Atlas',
      action: 'create_content',
      dependencies: ['content-plan'],
    },
    {
      id: 'marketing-prep',
      name: 'Marketing Preparation',
      agentId: 'Herald',
      action: 'prepare_launch',
      dependencies: ['content-plan'],  // Parallel with content-create
    },
    // ... more steps
  ],
  triggers: [
    { type: 'event', event: 'exam.launch.requested' },
    { type: 'manual' },
  ],
};
```

### Starting Workflows

```typescript
const orchestrator = new WorkflowOrchestrator(eventBus);

// Register workflow
orchestrator.registerWorkflow(examLaunchWorkflow);

// Start workflow
const instanceId = await orchestrator.startWorkflow('exam-launch', {
  examId: 'cbse-10-math',
  examName: 'CBSE Class 10 Mathematics',
});

// Check status
const status = await orchestrator.getWorkflowStatus(instanceId);
```

### Workflow Events

| Event | Description |
|-------|-------------|
| `workflow.started` | Workflow instance started |
| `workflow.step.started` | Step execution started |
| `workflow.step.completed` | Step completed successfully |
| `workflow.step.failed` | Step failed |
| `workflow.completed` | Workflow completed successfully |
| `workflow.failed` | Workflow failed |
| `workflow.compensating` | Rollback in progress |

---

## Error Handling

### Handler Errors

Errors in handlers don't crash the event bus:

```typescript
eventBus.subscribe('risky.event', async (event) => {
  throw new Error('Handler crashed!');
});

eventBus.subscribe('risky.event', async (event) => {
  // This still runs even if previous handler threw
  console.log('Second handler runs');
});
```

### Dead Letter Queue

Failed events can be sent to DLQ for later processing:

```typescript
eventBus.on('event.failed', async (failedEvent, error) => {
  await deadLetterQueue.add(failedEvent, error);
});
```

---

## Performance

### Benchmarks

| Metric | Value |
|--------|-------|
| Events/second | 10,000+ |
| Subscription lookup | O(1) |
| Wildcard matching | O(n) patterns |
| Memory per event | ~500 bytes |

### Best Practices

1. **Keep handlers fast** — Offload heavy work to async queues
2. **Use specific subscriptions** — Avoid broad wildcards
3. **Handle errors gracefully** — Don't let handlers crash
4. **Track correlation IDs** — For debugging and tracing
