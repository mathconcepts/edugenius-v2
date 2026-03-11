# Agent Architecture

Comprehensive documentation of all 8 agents (7 domain + Prism) and their 45+ sub-agents.

> **Last updated:** 2026-03-11 — Prism agent added (commit `d5968b0`)  
> **See also:** [`18-agent-connection-map.md`](./18-agent-connection-map.md) — complete bidirectional signal reference with full connection matrix, all 25+ signal types, inbox processors, and the exam lifecycle flow diagram. Updated 2026-03-11.

---

## Agent Hierarchy

```
EduGenius Orchestrator
├── Scout (Market Intelligence)
│   ├── TrendSpotter
│   ├── CompetitorTracker
│   ├── ExamMonitor
│   ├── KeywordHunter
│   └── SentimentScanner
├── Atlas (Content Engine)
│   ├── Curator
│   ├── Writer
│   ├── QuizMaster
│   ├── Visualizer
│   ├── SEOOptimizer
│   ├── Translator
│   └── FactChecker
├── Sage (AI Tutor)
│   ├── Socratic
│   ├── Explainer
│   ├── ProblemSolver
│   ├── ConceptMapper
│   ├── PracticeCoach
│   ├── EmotionReader
│   └── LanguageAdapter
├── Mentor (Engagement)
│   ├── ChurnPredictor
│   ├── NudgeEngine
│   ├── StreakTracker
│   ├── MilestoneManager
│   ├── ReEngager
│   └── ParentReporter
├── Herald (Marketing)
│   ├── CampaignManager
│   ├── SocialPoster
│   ├── EmailCrafter
│   ├── LeadNurturer
│   ├── ReferralManager
│   ├── PRCoordinator
│   └── InfluencerFinder
├── Forge (Deployment)
│   ├── BuildRunner
│   ├── TestOrchestrator
│   ├── CDNSyncer
│   ├── CacheManager
│   ├── DBMigrator
│   ├── RollbackGuard
│   └── HealthChecker
└── Oracle (Analytics)
    ├── MetricTracker
    ├── AnomalyDetector
    ├── ReportGenerator
    ├── FunnelAnalyzer
    ├── CohortAnalyzer
    └── ABEvaluator
```

---

## Base Agent

All agents extend `BaseAgent`, which provides:

### Lifecycle Management
```typescript
await agent.start();   // Initialize and begin heartbeat
await agent.stop();    // Graceful shutdown
```

### State Tracking
```typescript
interface AgentState {
  status: 'active' | 'idle' | 'busy' | 'blocked' | 'offline';
  startedAt: number;
  lastHeartbeat: number;
  lastActivity: number;
  tokensUsedToday: number;
  errors: AgentError[];
}
```

### Budget Management
- Daily token limits per agent
- Warning threshold (default 80%)
- Automatic tracking of LLM usage

### Sub-Agent Registration
```typescript
protected registerSubAgents(): void {
  this.registerSubAgent('SubAgentId', this.handler.bind(this));
}
```

### Event System Integration
```typescript
// Subscribe to events
this.subscribe('event.type', async (event) => { ... });

// Emit events
this.emit('agent.event.name', payload);
```

---

## Scout Agent — Market Intelligence

**Purpose:** Monitors market trends, competitors, and exam updates.

**Heartbeat:** Every 4 hours

**Daily Token Budget:** 30,000

### Sub-Agents

| Sub-Agent | Description | Triggers |
|-----------|-------------|----------|
| **TrendSpotter** | Monitors Google Trends, Reddit, education forums | Schedule: 4h |
| **CompetitorTracker** | Tracks competitor pricing, features, changes | Schedule: daily |
| **ExamMonitor** | Monitors exam syllabus changes, dates, patterns | Schedule: daily |
| **KeywordHunter** | Finds SEO keyword opportunities | Schedule: weekly |
| **SentimentScanner** | Analyzes brand mentions and reviews | Request |

### Key Events

**Emits:**
- `scout.trend.found` — New trend discovered
- `scout.competitor.changed` — Competitor update detected
- `scout.exam.updated` — Exam information changed
- `scout.opportunity.found` — Market opportunity identified

**Subscribes:**
- `request.market.scan` — Trigger market analysis

### Public API

```typescript
const scout = orchestrator.getAgent<ScoutAgent>('Scout');

// Run full market scan
await scout.runMarketScan();

// Analyze specific competitor
await scout.analyzeCompetitor('competitor-id');

// Get cached trends
const trends = scout.getCachedTrends();
```

---

## Atlas Agent — Content Engine

**Purpose:** Creates, optimizes, and manages educational content.

**Heartbeat:** Every 30 minutes

**Daily Token Budget:** 200,000

### Sub-Agents

| Sub-Agent | Description | Triggers |
|-----------|-------------|----------|
| **Curator** | Topic selection, content planning, gap analysis | Request |
| **Writer** | Creates lessons, explanations, summaries | Request |
| **QuizMaster** | Generates questions, assessments, practice tests | Request |
| **Visualizer** | Creates diagram/infographic specifications | Request |
| **SEOOptimizer** | Optimizes content for search engines | Request |
| **Translator** | Vernacular language support (9+ languages) | Request |
| **FactChecker** | Verifies content accuracy | Request |

### Content Pipeline

```
Request → Curator (plan) → Writer (draft) → QuizMaster (questions)
                                         → Visualizer (diagrams)
         → SEOOptimizer → FactChecker → Review → Publish
```

### Key Events

**Emits:**
- `atlas.content.created` — New content created
- `atlas.content.published` — Content published
- `atlas.content.updated` — Content updated

**Subscribes:**
- `scout.opportunity.found` — Create content for opportunities
- `atlas.content.requested` — Content creation request

### Public API

```typescript
const atlas = orchestrator.getAgent<AtlasAgent>('Atlas');

// Request content creation
const contentId = await atlas.requestContent('Quadratic Equations', 'lesson', 'mathematics');

// Process content queue
await atlas.processContentQueue();

// Get queue status
const queueSize = atlas.getQueueSize();
```

---

## Sage Agent — AI Tutor

**Purpose:** Provides personalized tutoring using Socratic method.

**Heartbeat:** Every 5 minutes (continuous operation)

**Daily Token Budget:** 300,000

### Sub-Agents

| Sub-Agent | Description | Triggers |
|-----------|-------------|----------|
| **Socratic** | Asks guiding questions, promotes discovery | Request |
| **Explainer** | Provides clear explanations with analogies | Request |
| **ProblemSolver** | Guides through step-by-step solutions | Request |
| **ConceptMapper** | Maps knowledge connections, prerequisites | Request |
| **PracticeCoach** | Manages spaced repetition, adaptive practice | Request |
| **EmotionReader** | Detects frustration, adjusts approach | Continuous |
| **LanguageAdapter** | Adapts language, handles code-switching | Request |

### Session Management

```typescript
// Start session
const sessionId = await sage.startSession('student-123', 'algebra');

// Ask question
await sage.ask(sessionId, 'What is a quadratic equation?');

// Get session
const session = sage.getSession(sessionId);

// Active sessions count
const count = sage.getActiveSessions();
```

### Session Context

```typescript
interface SessionContext {
  currentTopic?: string;
  difficulty: 'easy' | 'medium' | 'hard';
  mastery: number;           // 0-1
  emotionalState: EmotionalState;
  hintsUsed: number;
  questionsAsked: number;
  correctAnswers: number;
}
```

### Response Strategies

| Student State | Strategy | Sub-Agent |
|---------------|----------|-----------|
| Curious | Socratic questioning | Socratic |
| Confused | Clear explanation | Explainer |
| Stuck on problem | Step-by-step guide | ProblemSolver |
| Frustrated | Encouragement | EmotionReader |
| Ready for practice | Practice questions | PracticeCoach |

---

## Mentor Agent — Student Engagement

**Purpose:** Manages retention, gamification, and parent communication.

**Heartbeat:** Every 2 hours

**Daily Token Budget:** 50,000

### Sub-Agents

| Sub-Agent | Description | Triggers |
|-----------|-------------|----------|
| **ChurnPredictor** | Identifies at-risk students | Schedule: daily |
| **NudgeEngine** | Sends personalized notifications | Request, schedule |
| **StreakTracker** | Manages learning streaks | Event: session_end |
| **MilestoneManager** | Awards badges and achievements | Event: progress |
| **ReEngager** | Win-back campaigns for churned users | Schedule: weekly |
| **ParentReporter** | Generates progress reports for parents | Schedule: weekly |

### Engagement Score

```typescript
interface EngagementScore {
  studentId: string;
  score: number;        // 0-1
  churnRisk: number;    // 0-1
  factors: {
    recency: number;    // Days since last activity
    frequency: number;  // Sessions per week
    duration: number;   // Average session length
    progress: number;   // Learning progress
    streak: number;     // Current streak
  };
}
```

### Nudge Types

| Type | Use Case |
|------|----------|
| `reminder` | Remind to practice |
| `encouragement` | Motivate after progress |
| `challenge` | Engage with challenge |
| `celebration` | Celebrate achievements |
| `help` | Offer assistance |

### Channels

- Push notifications
- Email
- WhatsApp
- SMS
- In-app

---

## Herald Agent — Marketing Automation

**Purpose:** Manages campaigns, social media, and lead nurturing.

**Heartbeat:** Every 2 hours

**Daily Token Budget:** 100,000

### Sub-Agents

| Sub-Agent | Description | Triggers |
|-----------|-------------|----------|
| **CampaignManager** | Launches, tracks, optimizes campaigns | Request |
| **SocialPoster** | Manages social media content | Schedule: hourly |
| **EmailCrafter** | Creates and sends email campaigns | Request |
| **LeadNurturer** | Nurtures leads through funnel | Event, schedule |
| **ReferralManager** | Manages referral programs | Event |
| **PRCoordinator** | Handles press releases | Request |
| **InfluencerFinder** | Identifies influencer partnerships | Schedule: weekly |

### Campaign Lifecycle

```
Draft → Launch → Active → Monitor → Optimize → Complete
                   ↓
                 Pause (if needed)
```

### Lead Stages

```
New → Engaged → Qualified → Opportunity → Customer
```

### Platforms Supported

- Twitter/X
- LinkedIn
- Instagram
- Facebook
- YouTube
- Email

---

## Forge Agent — Deployment & Infrastructure

**Purpose:** Manages CI/CD, deployments, and system health.

**Heartbeat:** Every 5 minutes (continuous monitoring)

**Daily Token Budget:** 10,000 (minimal LLM usage)

### Sub-Agents

| Sub-Agent | Description | Triggers |
|-----------|-------------|----------|
| **BuildRunner** | Manages CI/CD pipelines | Event: push/pr |
| **TestOrchestrator** | Runs automated test suites | Event: build |
| **CDNSyncer** | Syncs content to CDN edge locations | Event: deploy |
| **CacheManager** | Manages cache invalidation | Event: deploy |
| **DBMigrator** | Handles database migrations | Event: deploy |
| **RollbackGuard** | Monitors and triggers rollbacks | Event: deploy |
| **HealthChecker** | Monitors system health and uptime | Continuous |

### Deployment Pipeline

```
Build → Test → Deploy Staging → Health Check → Deploy Production
                                      ↓
                              Health Check → Invalidate Cache → CDN Sync
                                      ↓
                              (Rollback if unhealthy)
```

### Health Metrics

```typescript
interface ServiceHealth {
  service: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  latency: number;
  errorRate: number;
  uptime: number;
  lastCheck: number;
}
```

---

## Oracle Agent — Analytics & Insights

**Purpose:** Tracks metrics, detects anomalies, and generates reports.

**Heartbeat:** Every 5 minutes (continuous monitoring)

**Daily Token Budget:** 50,000

### Sub-Agents

| Sub-Agent | Description | Triggers |
|-----------|-------------|----------|
| **MetricTracker** | Tracks and aggregates KPIs | Continuous |
| **AnomalyDetector** | Detects unusual patterns | Schedule: hourly |
| **ReportGenerator** | Creates daily/weekly/monthly reports | Schedule |
| **FunnelAnalyzer** | Analyzes conversion funnels | Request |
| **CohortAnalyzer** | Performs cohort retention analysis | Schedule: weekly |
| **ABEvaluator** | Evaluates experiment results | Request |

### Report Types

| Type | Frequency | Contents |
|------|-----------|----------|
| Daily | 6 AM UTC | Key metrics, anomalies, highlights |
| Weekly | Monday 9 AM | Trends, cohorts, recommendations |
| Monthly | 1st of month | Full analysis, comparisons |

### Anomaly Detection

Uses Z-score method:
- **> 2σ:** Medium severity
- **> 2.5σ:** High severity
- **> 3σ:** Critical severity

### A/B Test Evaluation

- Statistical significance testing (95% confidence)
- Automatic winner detection
- Uplift calculation
- Recommendations

---

## Agent Communication

### Event Flow Examples

**Content Creation Flow:**
```
Scout discovers opportunity
    ↓ scout.opportunity.found
Atlas receives request
    ↓ atlas.content.requested
Atlas creates content
    ↓ atlas.content.published
Herald promotes content
    ↓ herald.promote.requested
Oracle tracks performance
```

**Student Session Flow:**
```
Student starts session
    ↓ sage.session.started
Sage provides tutoring
    ↓ sage.tutor.response
Session ends
    ↓ sage.session.ended
Mentor updates progress
    ↓ mentor.progress.update
Oracle tracks analytics
```

**Deployment Flow:**
```
Deploy requested
    ↓ forge.deploy.requested
Forge builds and tests
    ↓ forge.build.completed
Forge deploys
    ↓ forge.deploy.completed
Oracle tracks deployment
    ↓ oracle.track.deployment
```

---

## Prism Agent — Journey Intelligence

> **Added:** 2026-03-11 (commit `d5968b0`)

**Purpose:** Analyses full user journey traces across all touchpoints (blog → signup → first session → subscription). Detects funnel leaks and emits targeted `FUNNEL_INSIGHT` signals to the agent responsible for fixing each leak.

**Heartbeat:** On-demand (triggered by Oracle when journey data is ready)

**Role:** Intelligence layer — reads data from Oracle, emits insights to Herald, Mentor, and Atlas. Does not teach, generate content, or deploy.

**Signal flow:**
```
Oracle exports journey events
    ↓ (journey data)
Prism analyses funnel stages
    ├── FUNNEL_INSIGHT → Herald    (acquisition leaks: blog→signup CTAs, ad copy)
    ├── FUNNEL_INSIGHT → Mentor    (activation leaks: onboarding→first-practice drop-off)
    └── FUNNEL_INSIGHT → Atlas     (content signals: high-converting topic/format discovery)
```

**Workflow:** `prism_analysis` — 4-step pipeline visible in `/agents` CEO dashboard.

**Sub-Agents:**

| Sub-Agent | Description |
|-----------|-------------|
| **JourneyMapper** | Maps raw page/session events into user journey traces |
| **LeakDetector** | Identifies drop-off points by stage and segment |
| **SegmentAnalyser** | Breaks journeys by exam, entry point, device, and user type |
| **InsightRouter** | Routes FUNNEL_INSIGHT signals to the correct target agent |

**Inbox processor:** `processPrismInbox()` — drains all Prism-targeted signals.
