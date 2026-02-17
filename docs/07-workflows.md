# Workflows

End-to-end automated workflows that coordinate multiple agents.

---

## Overview

Workflows are multi-step processes defined as DAGs (Directed Acyclic Graphs). They enable complex operations that span multiple agents with proper sequencing, parallel execution, and rollback capabilities.

---

## Available Workflows

| Workflow | Description | Agents Involved |
|----------|-------------|-----------------|
| **exam-launch** | Launch support for a new exam | Scout → Atlas → Herald → Forge → Oracle |
| **daily-ops** | Daily automated operations | All agents |
| **student-session** | Student learning session | Sage → Mentor → Oracle |
| **content-pipeline** | Content creation and distribution | Atlas → Forge → Herald → Oracle |
| **deployment** | Production deployment | Forge → Herald |

---

## Exam Launch Workflow

Complete workflow for launching support for a new exam.

### Workflow Definition

```
exam-launch
├── research (Scout)
│   └── Market analysis, competitor check
├── content-plan (Atlas)
│   └── Content strategy based on research
├── content-create (Atlas)
│   └── Create lessons, quizzes, materials
├── marketing-prep (Herald) [parallel with content-create]
│   └── Prepare campaign assets
├── deploy (Forge)
│   └── Deploy content to production
├── launch-marketing (Herald)
│   └── Launch campaigns
└── monitor (Oracle)
    └── Track launch metrics
```

### Phases

| Phase | Agent | Duration | Description |
|-------|-------|----------|-------------|
| Research | Scout | ~5 min | Analyze market, competitors, keywords |
| Content Planning | Atlas | ~3 min | Create content strategy |
| Content Creation | Atlas | ~10 min | Generate lessons, quizzes |
| Marketing Prep | Herald | ~5 min | Create campaign assets |
| Deployment | Forge | ~5 min | Deploy to production |
| Launch Marketing | Herald | ~3 min | Launch campaigns |
| Monitoring | Oracle | Ongoing | Track performance |

### Usage

```typescript
// Via orchestrator
const instanceId = await orchestrator.startWorkflow('exam-launch', {
  examId: 'cbse-10-math',
  examName: 'CBSE Class 10 Mathematics',
  board: 'CBSE',
  grade: 10,
  subject: 'Mathematics',
});

// Via API
curl -X POST http://localhost:3000/workflows/exam-launch/start \
  -H "Content-Type: application/json" \
  -d '{
    "examId": "cbse-10-math",
    "examName": "CBSE Class 10 Mathematics"
  }'
```

### Programmatic Launch

```typescript
import { launchExam, examTemplates } from 'edugenius/workflows';

// Using template
const result = await launchExam(examTemplates.cbse10('Mathematics'));

// Custom launch
const result = await launchExam({
  examId: 'jee-main-2026',
  examName: 'JEE Main 2026',
  board: 'NTA',
  grade: 12,
  subject: 'Physics, Chemistry, Mathematics',
  targetDate: new Date('2026-04-01'),
  budget: {
    content: 50000,
    marketing: 20000,
  },
});

// Result
console.log(result);
// {
//   success: true,
//   examId: 'jee-main-2026',
//   phases: [...],
//   metrics: {
//     contentCreated: 5,
//     questionsGenerated: 100,
//     marketingAssets: 5,
//     estimatedReach: 10000,
//   },
//   timeline: [...],
// }
```

---

## Daily Operations Workflow

Automated daily tasks across all agents.

### Schedule

Runs automatically at **6:00 AM UTC** daily.

### Steps

```
daily-ops
├── market-scan (Scout)
│   └── Morning market analysis
├── content-queue (Atlas)
│   └── Process pending content
├── engagement-check (Mentor)
│   └── Check student engagement
├── scheduled-posts (Herald)
│   └── Process scheduled social posts
├── health-check (Forge)
│   └── System health check
└── daily-report (Oracle)
    └── Generate daily report
```

### Manual Trigger

```typescript
await orchestrator.startWorkflow('daily-ops', {});
```

---

## Student Session Workflow

Complete student learning session flow.

### Trigger

Automatically triggered when a student starts a session.

### Steps

```
student-session
├── session-start (Sage)
│   └── Initialize tutoring session
├── tutoring (Sage)
│   └── Interactive tutoring (up to 1 hour)
├── session-end (Sage)
│   └── End session, generate summary
├── update-progress (Mentor)
│   └── Update student progress, streaks
└── track-analytics (Oracle)
    └── Record session metrics
```

### Programmatic Usage

```typescript
import { runStudentJourney } from 'edugenius/workflows';

const result = await runStudentJourney({
  studentId: 'student-001',
  topic: 'Quadratic Equations',
  subject: 'Mathematics',
  grade: 10,
  duration: 30, // minutes
  goals: ['Understand basics', 'Solve simple problems'],
});

// Result
console.log(result);
// {
//   success: true,
//   sessionId: 'session-abc123',
//   studentId: 'student-001',
//   summary: {
//     duration: 28,
//     topicsCovered: ['Quadratic Equations'],
//     questionsAsked: 12,
//     correctAnswers: 9,
//     masteryGained: 0.15,
//     hintsUsed: 3,
//     emotionalStates: ['neutral', 'confident'],
//   },
//   nextSteps: [
//     'Practice intermediate problems',
//     'Try the quiz',
//     'Come back tomorrow for streak!'
//   ],
//   engagementScore: 0.85,
// }
```

---

## Content Pipeline Workflow

End-to-end content creation and distribution.

### Steps

```
content-pipeline
├── plan (Atlas)
│   └── Plan content structure
├── create (Atlas)
│   └── Write content
├── review (Atlas)
│   └── Review and fact-check
├── seo-optimize (Atlas)
│   └── SEO optimization
├── publish (Forge)
│   └── Deploy content
├── promote (Herald)
│   └── Social promotion
└── track (Oracle)
    └── Track performance (24h)
```

### Trigger via API

```bash
curl -X POST http://localhost:3000/workflows/content-pipeline/start \
  -H "Content-Type: application/json" \
  -d '{
    "topic": "Understanding Calculus",
    "type": "lesson",
    "subject": "Mathematics",
    "grade": 12
  }'
```

---

## Deployment Workflow

Safe production deployment with rollback.

### Steps

```
deployment
├── build (Forge)
│   └── Build application
├── test (Forge)
│   └── Run test suite
├── deploy-staging (Forge)
│   └── Deploy to staging
├── health-staging (Forge)
│   └── Staging health check
├── deploy-production (Forge)
│   └── Deploy to production
├── health-production (Forge)
│   └── Production health check
├── cache-invalidate (Forge)
│   └── Invalidate caches
├── cdn-sync (Forge)
│   └── Sync CDN
└── notify (Herald)
    └── Notify stakeholders
```

### Rollback

If `health-production` fails, automatic rollback is triggered:

```
health-production (FAILED)
    ↓
rollback (Forge)
    └── Restore previous version
```

### Trigger

```typescript
await orchestrator.startWorkflow('deployment', {
  environment: 'production',
  version: 'v1.2.3',
});
```

---

## Workflow Configuration

### WorkflowDefinition Type

```typescript
interface WorkflowDefinition {
  id: string;
  name: string;
  description?: string;
  version: string;
  steps: WorkflowStep[];
  triggers: WorkflowTrigger[];
  compensations?: Record<string, CompensationStep>;
}

interface WorkflowStep {
  id: string;
  name: string;
  agentId: AgentId;
  action: string;
  dependencies?: string[];  // Steps that must complete first
  timeout?: number;         // Milliseconds
  retries?: number;
  input?: Record<string, unknown>;
}

interface WorkflowTrigger {
  type: 'event' | 'schedule' | 'manual';
  event?: string;           // For type: 'event'
  cron?: string;            // For type: 'schedule'
}

interface CompensationStep {
  action: string;
  agentId: AgentId;
}
```

### Creating Custom Workflows

```typescript
const customWorkflow: WorkflowDefinition = {
  id: 'custom-workflow',
  name: 'My Custom Workflow',
  version: '1.0.0',
  steps: [
    {
      id: 'step-1',
      name: 'First Step',
      agentId: 'Scout',
      action: 'analyze',
      timeout: 60000,
    },
    {
      id: 'step-2',
      name: 'Second Step',
      agentId: 'Atlas',
      action: 'create',
      dependencies: ['step-1'],
      timeout: 120000,
    },
    {
      id: 'step-3a',
      name: 'Parallel Step A',
      agentId: 'Herald',
      action: 'notify',
      dependencies: ['step-2'],
    },
    {
      id: 'step-3b',
      name: 'Parallel Step B',
      agentId: 'Oracle',
      action: 'track',
      dependencies: ['step-2'],
    },
  ],
  triggers: [
    { type: 'manual' },
    { type: 'event', event: 'custom.trigger' },
  ],
};

// Register
orchestrator.workflowOrchestrator.registerWorkflow(customWorkflow);

// Start
const instanceId = await orchestrator.startWorkflow('custom-workflow', {
  input: 'data',
});
```

---

## Monitoring Workflows

### Check Status

```typescript
const status = await orchestrator.getWorkflowStatus(instanceId);

console.log(status);
// {
//   instanceId: 'workflow-abc123',
//   workflowId: 'exam-launch',
//   status: 'running',
//   startedAt: 1708170000000,
//   currentStep: 'content-create',
//   completedSteps: ['research', 'content-plan'],
//   failedSteps: [],
//   stepResults: {
//     research: { output: {...}, duration: 300000 },
//     'content-plan': { output: {...}, duration: 180000 },
//   },
// }
```

### Workflow Events

Subscribe to workflow events:

```typescript
eventBus.subscribe('workflow.started', (event) => {
  console.log('Workflow started:', event.payload.instanceId);
});

eventBus.subscribe('workflow.step.completed', (event) => {
  console.log('Step completed:', event.payload.stepId);
});

eventBus.subscribe('workflow.completed', (event) => {
  console.log('Workflow completed:', event.payload.instanceId);
});

eventBus.subscribe('workflow.failed', (event) => {
  console.log('Workflow failed:', event.payload.error);
});
```

---

## Error Handling

### Retry Policy

Each step can specify retry behavior:

```typescript
{
  id: 'risky-step',
  name: 'Risky Operation',
  agentId: 'Forge',
  action: 'deploy',
  retries: 3,          // Retry up to 3 times
  timeout: 300000,     // 5 minute timeout
}
```

### Compensation (Rollback)

Define compensation actions for steps:

```typescript
{
  // ... workflow definition
  compensations: {
    'deploy-production': {
      action: 'rollback',
      agentId: 'Forge',
    },
    'launch-marketing': {
      action: 'pause_campaign',
      agentId: 'Herald',
    },
  },
}
```

When a step fails, compensations run in reverse order.

---

## Best Practices

1. **Keep steps focused** — One action per step
2. **Set appropriate timeouts** — Based on expected duration
3. **Use dependencies wisely** — Enable parallel execution where possible
4. **Define compensations** — For reversible operations
5. **Monitor actively** — Subscribe to workflow events
6. **Test workflows** — Use staging environment first
