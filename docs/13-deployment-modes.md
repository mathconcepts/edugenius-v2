# Deployment Modes

## Overview

EduGenius uses a pilot-first deployment strategy. Every new exam or feature goes through a controlled pilot phase before full launch. This ensures quality, catches issues early, and allows data-driven promotion decisions.

## Deployment Lifecycle

```
┌─────────┐     ┌─────────┐     ┌─────────┐     ┌─────────┐
│  Draft  │ ──► │  Pilot  │ ──► │ Review  │ ──► │  Full   │
└─────────┘     └─────────┘     └─────────┘     └─────────┘
                     │                               │
                     ▼                               │
               ┌─────────┐                           │
               │Rollback │ ◄─────────────────────────┘
               └─────────┘
```

## Creating a Deployment

```typescript
import { deploymentManager } from 'edugenius';

const deployment = await deploymentManager.createDeployment({
  examId: 'jee-2026',
  examCode: 'JEE',
  examName: 'JEE Main 2026',
  config: {
    content: {
      blogsEnabled: true,
      vlogsEnabled: true,
      socialEnabled: true,
      cadence: {
        questionsPerDay: 50,
        blogsPerWeek: 5,
        videosPerWeek: 3,
        practiceTestsPerMonth: 4,
        revisionsPerChapter: 3,
      },
    },
    tutoring: {
      enabled: true,
      modelsAllowed: ['gemini-pro', 'claude-sonnet'],
      featuresEnabled: ['ai-tutoring', 'smart-notebook', 'adaptive-practice'],
    },
    marketing: {
      enabled: true,
      channels: ['social', 'email', 'ads'],
      budget: 25000,
    },
    features: ['ai-tutoring', 'adaptive-practice', 'gamification'],
  },
});
```

## Pilot Configuration

### Audience Selection Methods

| Method | Description | Example |
|--------|-------------|---------|
| `signup_source` | Filter by how users signed up | Organic, referral |
| `geography` | Filter by location | Mumbai, Delhi |
| `cohort` | Filter by user cohort | Beta testers |
| `random` | Random percentage | 10% of all users |

```typescript
const deployment = await deploymentManager.createDeployment({
  examId: 'neet-2026',
  examCode: 'NEET',
  examName: 'NEET UG 2026',
  config: { /* ... */ },
  pilotConfig: {
    audienceMethod: 'geography',
    audienceFilter: { geographies: ['Mumbai', 'Pune', 'Bangalore'] },
    targetSize: 500,
    durationType: 'fixed',
    durationDays: 14,
    rollbackTriggers: [
      {
        id: 'error-rate',
        metric: 'errorRate',
        operator: 'gt',
        threshold: 0.05,
        window: '1h',
        triggered: false,
      },
      {
        id: 'churn-rate',
        metric: 'churnRate',
        operator: 'gt',
        threshold: 0.15,
        window: '24h',
        triggered: false,
      },
    ],
    successCriteria: [
      {
        id: 'retention',
        metric: 'retentionRate',
        target: 0.7,
        operator: 'gte',
        weight: 0.4,
        achieved: false,
      },
      {
        id: 'conversion',
        metric: 'conversionRate',
        target: 0.05,
        operator: 'gte',
        weight: 0.3,
        achieved: false,
      },
    ],
    status: 'active',
  },
});
```

### Starting a Pilot

```typescript
await deploymentManager.startPilot('neet-2026');
```

### Checking Pilot Status

```typescript
const status = await deploymentManager.checkPilotStatus('neet-2026');

console.log(status);
// {
//   canPromote: false,
//   issues: [
//     'Minimum pilot duration not met (7/14 days)',
//     'Minimum pilot users not met (320/500)'
//   ],
//   successCriteria: [
//     { name: 'retentionRate', achieved: true, value: 0.75, target: 0.7 },
//     { name: 'conversionRate', achieved: false, value: 0.03, target: 0.05 }
//   ]
// }
```

### Extending a Pilot

```typescript
await deploymentManager.extendPilot('neet-2026', 7); // Add 7 more days
```

## Full Deployment

### Promotion Criteria

Before promoting, the system checks:

1. **Minimum pilot duration** (default: 7 days)
2. **Minimum pilot users** (default: 50)
3. **Success criteria** (retention, conversion, engagement)
4. **No active rollback triggers**

### Promoting to Full

```typescript
// Check if ready
const status = await deploymentManager.checkPilotStatus('neet-2026');

if (status.canPromote) {
  await deploymentManager.promoteToFull('neet-2026');
}
```

### What Changes on Full Promotion

| Aspect | Pilot | Full |
|--------|-------|------|
| Audience | Restricted | All users |
| Feature flags | Pilot-only enabled | Pilot-only disabled |
| Rollout % | Configurable | 100% |
| Marketing | Limited channels | All channels |
| Content | Reduced cadence | Full cadence |

## Feature Flags

### Default Feature Flags

| Flag | Description | Pilot-Only |
|------|-------------|------------|
| `ai-tutoring` | AI-powered tutoring | No |
| `smart-notebook` | AI note-taking | Yes |
| `adaptive-practice` | Personalized questions | No |
| `gamification` | Streaks, badges | No |
| `vernacular-content` | Regional languages | Yes |
| `video-solutions` | Video explanations | Yes |
| `parent-dashboard` | Parent reports | No |
| `social-learning` | Peer features | Yes |

### Managing Feature Flags

```typescript
// Enable a feature
await deploymentManager.setFeatureEnabled('neet-2026', 'video-solutions', true);

// Set rollout percentage
await deploymentManager.setFeatureRollout('neet-2026', 'video-solutions', 25);

// Check if feature is enabled for user
const enabled = await deploymentManager.isFeatureEnabled(
  'neet-2026',
  'video-solutions',
  'user-123'
);
```

### Creating Custom Feature Flags

```typescript
await deploymentManager.createFeatureFlag({
  id: 'new-quiz-ui',
  name: 'New Quiz Interface',
  description: 'Redesigned quiz taking experience',
  enabled: false,
  pilotOnly: true,
  examSpecific: true,
  rolloutPercentage: 0,
  category: 'ui',
  owner: 'sage',
});
```

## Rollback

### Automatic Rollback Triggers

When a rollback trigger fires:

1. System pauses feature flags
2. Reverts to previous stable state
3. Records event with reason
4. Notifies stakeholders

```typescript
// Manual rollback
await deploymentManager.rollback('neet-2026', 'High error rate detected');
```

### Rollback Events

```typescript
const events = await deploymentManager.getEvents('neet-2026');
// [
//   { type: 'deployment.created', timestamp: ... },
//   { type: 'deployment.pilot_started', timestamp: ... },
//   { type: 'metric.threshold_breached', data: { metric: 'errorRate', value: 0.08 } },
//   { type: 'deployment.rolled_back', data: { reason: 'High error rate' } }
// ]
```

## Metrics Tracking

### Updating Metrics

```typescript
await deploymentManager.updateMetrics('neet-2026', {
  totalUsers: 5000,
  activeUsers: 2500,
  pilotUsers: 320,
  avgSessionDuration: 1200,
  sessionsPerUser: 3.5,
  retentionRate: 0.75,
  conversionRate: 0.04,
  revenue: 15000,
  churnRate: 0.08,
  errorRate: 0.02,
  latencyP50: 200,
  latencyP95: 800,
});
```

### Metrics Dashboard

| Metric | Good | Warning | Critical |
|--------|------|---------|----------|
| Error Rate | < 2% | 2-5% | > 5% |
| Latency P95 | < 1s | 1-2s | > 2s |
| Churn Rate | < 5% | 5-10% | > 10% |
| Retention | > 70% | 50-70% | < 50% |

## Forge Integration

### Deployment Pipeline

```typescript
import { forgeDeploymentIntegration } from 'edugenius';

// Start full deployment pipeline
const pipeline = await forgeDeploymentIntegration.startDeploymentPipeline('JEE');

// Pipeline stages:
// 1. Validation - Check exam config
// 2. Pilot Setup - Create deployment, start pilot
// 3. Pilot Monitoring - Wait for metrics
// 4. Promotion Check - Verify criteria met
// 5. Full Deployment - Promote to all users
```

### Pre-Deployment Checks

```typescript
const checks = await forgeDeploymentIntegration.runPreDeploymentChecks('JEE');
// [
//   { name: 'Exam Config', passed: true, message: 'Configuration exists' },
//   { name: 'Config Validation', passed: true, message: 'All validations passed' },
//   { name: 'Content Readiness', passed: true, message: 'Content cadence configured' },
//   { name: 'Language Support', passed: true, message: '3 language(s) configured' },
//   { name: 'Marketing Budget', passed: true, message: 'Budget: $25000' }
// ]
```

### Health Monitoring

```typescript
const health = await forgeDeploymentIntegration.getDeploymentHealth('JEE');
// {
//   status: 'healthy', // or 'degraded', 'critical'
//   metrics: { ... },
//   issues: []
// }
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/deployments` | List all deployments |
| GET | `/deployments/:examId` | Get deployment details |
| POST | `/deployments` | Create deployment |
| POST | `/deployments/:examId/pilot/start` | Start pilot |
| POST | `/deployments/:examId/pilot/status` | Check pilot status |
| POST | `/deployments/:examId/promote` | Promote to full |
| POST | `/deployments/:examId/rollback` | Rollback deployment |
| GET | `/feature-flags` | List feature flags |
| PUT | `/deployments/:examId/features/:id/enabled` | Toggle feature |
| PUT | `/deployments/:examId/features/:id/rollout` | Set rollout % |

## Best Practices

1. **Always pilot first** — No exceptions, even for "small" changes
2. **Set conservative rollback triggers** — Better to roll back early
3. **Define clear success criteria** — Know what "good" looks like
4. **Monitor actively during pilot** — Don't just wait for triggers
5. **Document rollback reasons** — Learn from failures
6. **Gradual rollout** — Even after promotion, increase slowly
