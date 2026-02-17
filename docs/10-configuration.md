# Configuration Reference

Complete configuration options for EduGenius.

---

## Configuration Hierarchy

```
Environment Variables
        ↓
Config Files (config/*.yaml)
        ↓
Programmatic Config
        ↓
Defaults
```

Higher levels override lower levels.

---

## Environment Variables

### Server

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | 3000 | API server port |
| `HOST` | 0.0.0.0 | Server bind address |
| `NODE_ENV` | development | Environment mode |
| `LOG_LEVEL` | info | Logging level (debug, info, warn, error) |

### LLM Providers

| Variable | Default | Description |
|----------|---------|-------------|
| `GEMINI_API_KEY` | - | Google AI API key |
| `ANTHROPIC_API_KEY` | - | Anthropic API key |
| `OPENAI_API_KEY` | - | OpenAI API key |
| `OLLAMA_BASE_URL` | http://localhost:11434 | Ollama server URL |
| `DEFAULT_LLM_PROVIDER` | gemini | Default LLM provider |

### Cache

| Variable | Default | Description |
|----------|---------|-------------|
| `REDIS_URL` | - | Redis connection URL |
| `CACHE_TTL_MS` | 3600000 | Default cache TTL (1 hour) |

### Database

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | - | Database connection string |

### Agents

| Variable | Default | Description |
|----------|---------|-------------|
| `ENABLED_AGENTS` | All | Comma-separated agent list |
| `AGENT_HEARTBEAT_ENABLED` | true | Enable agent heartbeats |

### Security

| Variable | Default | Description |
|----------|---------|-------------|
| `API_KEYS` | - | Comma-separated API keys |
| `AUTH_ENABLED` | false | Enable API authentication |
| `RATE_LIMIT_MAX` | 100 | Max requests per window |
| `RATE_LIMIT_WINDOW_MS` | 60000 | Rate limit window (ms) |
| `CORS_ORIGINS` | * | Allowed CORS origins |

---

## Config Files

### providers.yaml

LLM provider configuration:

```yaml
providers:
  gemini:
    enabled: true
    apiKey: ${GEMINI_API_KEY}
    defaultModel: gemini-1.5-flash
    models:
      - id: gemini-1.5-pro
        contextWindow: 1000000
        maxOutputTokens: 8192
        costPer1kInput: 0.00025
        costPer1kOutput: 0.0005
        taskTypes:
          - quality-critical
          - pedagogical
          
      - id: gemini-1.5-flash
        contextWindow: 1000000
        maxOutputTokens: 8192
        costPer1kInput: 0.000075
        costPer1kOutput: 0.0003
        taskTypes:
          - routine
          - high-volume

  anthropic:
    enabled: true
    apiKey: ${ANTHROPIC_API_KEY}
    defaultModel: claude-3-5-sonnet-20241022
    models:
      - id: claude-3-5-sonnet-20241022
        contextWindow: 200000
        maxOutputTokens: 8192
        costPer1kInput: 0.003
        costPer1kOutput: 0.015
        taskTypes:
          - quality-critical
          
      - id: claude-3-haiku-20240307
        contextWindow: 200000
        maxOutputTokens: 4096
        costPer1kInput: 0.00025
        costPer1kOutput: 0.00125
        taskTypes:
          - routine

  openai:
    enabled: true
    apiKey: ${OPENAI_API_KEY}
    defaultModel: gpt-4-turbo
    models:
      - id: gpt-4-turbo
        contextWindow: 128000
        maxOutputTokens: 4096
        costPer1kInput: 0.01
        costPer1kOutput: 0.03
        taskTypes:
          - quality-critical

  ollama:
    enabled: false
    baseUrl: http://localhost:11434
    models:
      - id: llama3
        contextWindow: 8000
        maxOutputTokens: 2048
        costPer1kInput: 0
        costPer1kOutput: 0
        taskTypes:
          - all
```

### agents.yaml

Agent configuration:

```yaml
agents:
  Scout:
    enabled: true
    heartbeatIntervalMs: 14400000  # 4 hours
    budget:
      dailyTokenLimit: 30000
      warningThreshold: 0.8
    subAgents:
      - TrendSpotter
      - CompetitorTracker
      - ExamMonitor
      - KeywordHunter
      - SentimentScanner

  Atlas:
    enabled: true
    heartbeatIntervalMs: 1800000  # 30 min
    budget:
      dailyTokenLimit: 200000
      warningThreshold: 0.9
    config:
      maxConcurrentContent: 3
      defaultContentLanguage: en

  Sage:
    enabled: true
    heartbeatIntervalMs: 300000  # 5 min
    budget:
      dailyTokenLimit: 300000
      warningThreshold: 0.9
    config:
      maxSessionDurationMs: 3600000  # 1 hour
      inactiveSessionTimeoutMs: 1800000  # 30 min

  Mentor:
    enabled: true
    heartbeatIntervalMs: 7200000  # 2 hours
    budget:
      dailyTokenLimit: 50000
      warningThreshold: 0.7
    config:
      churnRiskThreshold: 0.7
      nudgeChannels:
        - push
        - email
        - whatsapp

  Herald:
    enabled: true
    heartbeatIntervalMs: 7200000  # 2 hours
    budget:
      dailyTokenLimit: 100000
      warningThreshold: 0.8
    config:
      socialPlatforms:
        - twitter
        - linkedin
        - instagram

  Forge:
    enabled: true
    heartbeatIntervalMs: 300000  # 5 min
    budget:
      dailyTokenLimit: 10000
      warningThreshold: 0.9
    config:
      healthCheckIntervalMs: 60000
      rollbackThreshold:
        errorRate: 0.05
        latency: 2000

  Oracle:
    enabled: true
    heartbeatIntervalMs: 300000  # 5 min
    budget:
      dailyTokenLimit: 50000
      warningThreshold: 0.8
    config:
      anomalyDetection:
        enabled: true
        zScoreThreshold: 2.0
      reports:
        dailyTime: "06:00"
        weeklyDay: "monday"
```

### cache.yaml

Cache configuration:

```yaml
cache:
  type: memory  # memory, redis
  
  memory:
    maxSize: 1000
    ttlMs: 3600000
    
  redis:
    url: ${REDIS_URL}
    prefix: edugenius:
    ttlMs: 3600000
    
  strategies:
    session:
      ttlMs: 1800000  # 30 min
    content:
      ttlMs: 86400000  # 24 hours
    metrics:
      ttlMs: 300000  # 5 min
    embedding:
      ttlMs: 86400000  # 24 hours
```

---

## Programmatic Configuration

### Orchestrator

```typescript
import { getOrchestrator } from 'edugenius';

const orchestrator = getOrchestrator({
  // Select specific agents
  enabledAgents: ['Scout', 'Atlas', 'Sage'],
  
  // LLM configuration
  llmConfig: {
    defaultProvider: 'gemini',
    fallbackProviders: ['anthropic', 'openai'],
  },
  
  // Cache configuration
  cacheConfig: {
    host: 'localhost',
    port: 6379,
  },
  
  // Enable/disable features
  heartbeatEnabled: true,
  metricsEnabled: true,
});
```

### API Server

```typescript
import { createAPIServer } from 'edugenius';

const server = createAPIServer({
  port: 3000,
  host: '0.0.0.0',
  
  // CORS
  corsOrigins: ['https://app.edugenius.ai'],
  
  // Rate limiting
  rateLimit: {
    windowMs: 60000,
    maxRequests: 100,
  },
  
  // Authentication
  auth: {
    enabled: true,
    apiKeys: ['key1', 'key2'],
  },
});
```

### Agent Configuration

```typescript
import { SageAgent } from 'edugenius';

const sage = new SageAgent({
  // Override default config
  heartbeatIntervalMs: 60000,
  budget: {
    dailyTokenLimit: 500000,
    warningThreshold: 0.95,
  },
});
```

---

## Agent Budget Configuration

### Per-Agent Limits

| Agent | Daily Tokens | Cost/Day (~) | Use Case |
|-------|--------------|--------------|----------|
| Scout | 30,000 | $0.02 | Market analysis |
| Atlas | 200,000 | $0.15 | Content creation |
| Sage | 300,000 | $0.25 | Tutoring |
| Mentor | 50,000 | $0.04 | Engagement |
| Herald | 100,000 | $0.08 | Marketing |
| Forge | 10,000 | $0.01 | Deployment |
| Oracle | 50,000 | $0.04 | Analytics |
| **Total** | **780,000** | **~$0.60** | |

### Degradation Levels

```yaml
budget:
  degradationLevels:
    normal:
      threshold: 0.7
      action: use_preferred_models
    warning:
      threshold: 0.9
      action: use_cheaper_models
    critical:
      threshold: 0.95
      action: essential_only
    exceeded:
      threshold: 1.0
      action: block_requests
```

---

## Workflow Configuration

```typescript
const customWorkflow: WorkflowDefinition = {
  id: 'custom',
  name: 'Custom Workflow',
  version: '1.0.0',
  
  // Global timeout
  timeoutMs: 3600000,
  
  // Retry policy
  retry: {
    maxAttempts: 3,
    initialDelayMs: 1000,
    backoffMultiplier: 2,
  },
  
  steps: [
    {
      id: 'step-1',
      agentId: 'Scout',
      action: 'analyze',
      // Per-step timeout
      timeout: 60000,
      // Per-step retries
      retries: 2,
    },
  ],
  
  triggers: [
    { type: 'manual' },
    { type: 'schedule', cron: '0 6 * * *' },
    { type: 'event', event: 'custom.trigger' },
  ],
};
```

---

## Feature Flags

```yaml
features:
  # Enable experimental features
  experimental:
    streamingTutor: false
    multiModalContent: false
    
  # Production features
  production:
    autoRollback: true
    anomalyAlerts: true
    parentReports: true
    
  # Agent features
  agents:
    scout:
      competitorTracking: true
      sentimentAnalysis: true
    atlas:
      factChecking: true
      seoOptimization: true
    sage:
      emotionDetection: true
      languageAdaptation: true
```

---

## Logging Configuration

```yaml
logging:
  level: info  # debug, info, warn, error
  format: json  # json, pretty
  
  destinations:
    - type: console
    - type: file
      path: /var/log/edugenius/app.log
      maxSize: 10mb
      maxFiles: 5
    - type: sentry
      dsn: ${SENTRY_DSN}
      
  redact:
    - apiKey
    - password
    - token
```

---

## Validation

All configuration is validated on startup:

```typescript
// Validation errors throw on start
try {
  await orchestrator.start();
} catch (error) {
  if (error instanceof ConfigurationError) {
    console.error('Invalid configuration:', error.message);
    process.exit(1);
  }
}
```

### Common Validation Errors

| Error | Cause | Fix |
|-------|-------|-----|
| `Missing required API key` | No LLM provider configured | Set at least one API key |
| `Invalid agent ID` | Unknown agent in enabledAgents | Use valid agent names |
| `Invalid cron expression` | Malformed cron in workflow | Check cron syntax |
| `Circular dependency` | Workflow step depends on itself | Fix dependencies |
