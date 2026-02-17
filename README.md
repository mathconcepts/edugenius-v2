# EduGenius

**Autonomous AI Agent Platform for Education**

EduGenius is a multi-agent system that automates educational content creation, tutoring, engagement, marketing, deployment, and analytics.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     EduGenius Orchestrator                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│   ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐            │
│   │  Scout  │  │  Atlas  │  │   Sage  │  │ Mentor  │            │
│   │ Market  │  │ Content │  │  Tutor  │  │ Engage  │            │
│   └────┬────┘  └────┬────┘  └────┬────┘  └────┬────┘            │
│        │            │            │            │                  │
│   ┌─────────┐  ┌─────────┐  ┌─────────┐                          │
│   │ Herald  │  │  Forge  │  │ Oracle  │                          │
│   │Marketing│  │ Deploy  │  │Analytics│                          │
│   └────┬────┘  └────┬────┘  └────┬────┘                          │
│        │            │            │                                │
├────────┴────────────┴────────────┴────────────────────────────────┤
│                        Event Bus                                   │
├───────────────────────────────────────────────────────────────────┤
│     LLM Abstraction    │    Data Layer    │    Cache Layer        │
└───────────────────────────────────────────────────────────────────┘
```

## Agents

| Agent | Purpose | Sub-Agents |
|-------|---------|------------|
| **Scout** | Market intelligence | TrendSpotter, CompetitorTracker, ExamMonitor, KeywordHunter, SentimentScanner |
| **Atlas** | Content creation | Curator, Writer, QuizMaster, Visualizer, SEOOptimizer, Translator, FactChecker |
| **Sage** | AI tutoring | Socratic, Explainer, ProblemSolver, ConceptMapper, PracticeCoach, EmotionReader, LanguageAdapter |
| **Mentor** | Student engagement | ChurnPredictor, NudgeEngine, StreakTracker, MilestoneManager, ReEngager, ParentReporter |
| **Herald** | Marketing automation | CampaignManager, SocialPoster, EmailCrafter, LeadNurturer, ReferralManager, PRCoordinator, InfluencerFinder |
| **Forge** | CI/CD & deployment | BuildRunner, TestOrchestrator, CDNSyncer, CacheManager, DBMigrator, RollbackGuard, HealthChecker |
| **Oracle** | Analytics & insights | MetricTracker, AnomalyDetector, ReportGenerator, FunnelAnalyzer, CohortAnalyzer, ABEvaluator |

## Quick Start

```typescript
import { start } from 'edugenius';

const { orchestrator, api } = await start({
  api: true,
  apiPort: 3000,
});

// Start a tutoring session
const sessionId = await orchestrator.startTutoringSession('student-123', 'algebra');

// Get analytics
const report = await orchestrator.getReport('daily');

// Run a workflow
await orchestrator.startWorkflow('exam-launch', {
  examId: 'cbse-10-math',
  examName: 'CBSE Class 10 Mathematics',
});
```

## API Endpoints

### Health & Status
- `GET /health` - Health check
- `GET /status` - System status

### Agents
- `GET /agents` - List all agents
- `GET /agents/:id` - Get agent details

### Workflows
- `GET /workflows` - List workflows
- `POST /workflows/:id/start` - Start a workflow

### Tutoring (Sage)
- `POST /tutoring/sessions` - Start session
- `POST /tutoring/sessions/:id/ask` - Ask question
- `GET /tutoring/sessions/:id` - Get session

### Students (Mentor)
- `GET /students/:id/engagement` - Get engagement
- `POST /students/:id/nudge` - Send nudge

### Campaigns (Herald)
- `POST /campaigns` - Create campaign
- `GET /campaigns` - List campaigns

### Deployments (Forge)
- `POST /deploy` - Start deployment
- `GET /deploy/:id` - Get status
- `GET /health-check` - System health

### Analytics (Oracle)
- `GET /analytics/report` - Get report
- `GET /analytics/funnel` - Funnel analysis
- `GET /analytics/cohorts` - Cohort analysis
- `POST /analytics/metrics` - Record metric

## Workflows

### Exam Launch
Complete workflow for launching a new exam:
1. Market research (Scout)
2. Content planning (Atlas)
3. Content creation (Atlas)
4. Marketing prep (Herald)
5. Deployment (Forge)
6. Launch marketing (Herald)
7. Monitor (Oracle)

### Daily Operations
Daily automated operations:
1. Morning market scan (Scout)
2. Process content queue (Atlas)
3. Check engagement (Mentor)
4. Process scheduled posts (Herald)
5. System health check (Forge)
6. Generate daily report (Oracle)

### Student Session
Student learning workflow:
1. Initialize session (Sage)
2. Tutoring interaction (Sage)
3. End session (Sage)
4. Update progress (Mentor)
5. Track analytics (Oracle)

## Development

```bash
# Install dependencies
npm install

# Run in development mode
npm run dev

# Build
npm run build

# Run tests
npm test

# Type check
npm run typecheck
```

## Statistics

- **Lines of Code:** ~20,000 TypeScript
- **Total Size:** ~500KB
- **Agents:** 7 domain agents
- **Sub-agents:** 45 specialized workers
- **Test Coverage:** Comprehensive integration tests

## License

MIT
