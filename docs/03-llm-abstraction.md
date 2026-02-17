# LLM Abstraction Layer

The LLM layer provides provider-agnostic AI capabilities with intelligent routing, fallbacks, and budget management.

---

## Architecture

```
┌──────────────────────────────────────────────────────────┐
│                      LLMClient                            │
│         Unified interface for all LLM operations          │
├──────────────────────────────────────────────────────────┤
│                                                           │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐   │
│  │   Router    │  │   Budget    │  │    Fallback     │   │
│  │  (by task)  │  │   Tracker   │  │    Handler      │   │
│  └─────────────┘  └─────────────┘  └─────────────────┘   │
│                                                           │
├──────────────────────────────────────────────────────────┤
│                      ADAPTERS                             │
│                                                           │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  │
│  │  Gemini  │  │Anthropic │  │  OpenAI  │  │  Ollama  │  │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘  │
│                                                           │
│                    ┌──────────┐                           │
│                    │ LearnLM  │                           │
│                    └──────────┘                           │
└──────────────────────────────────────────────────────────┘
```

---

## Supported Providers

| Provider | Models | Best For |
|----------|--------|----------|
| **Gemini** | gemini-1.5-pro, gemini-1.5-flash, gemini-2.0-flash | Quality, speed, cost |
| **Anthropic** | claude-3-5-sonnet, claude-3-opus, claude-3-haiku | Complex reasoning |
| **OpenAI** | gpt-4-turbo, gpt-4o, gpt-3.5-turbo | General purpose |
| **Ollama** | llama3, mistral, codellama | Local/private |
| **LearnLM** | learnlm-1.5-pro | Pedagogical tasks |

---

## Configuration

### Provider Registry (`config/providers.yaml`)

```yaml
providers:
  gemini:
    enabled: true
    apiKey: ${GEMINI_API_KEY}
    models:
      - id: gemini-1.5-pro
        contextWindow: 1000000
        costPer1kInput: 0.00025
        costPer1kOutput: 0.0005
      - id: gemini-1.5-flash
        contextWindow: 1000000
        costPer1kInput: 0.000075
        costPer1kOutput: 0.0003

  anthropic:
    enabled: true
    apiKey: ${ANTHROPIC_API_KEY}
    models:
      - id: claude-3-5-sonnet-20241022
        contextWindow: 200000
        costPer1kInput: 0.003
        costPer1kOutput: 0.015

  openai:
    enabled: true
    apiKey: ${OPENAI_API_KEY}
    models:
      - id: gpt-4-turbo
        contextWindow: 128000
        costPer1kInput: 0.01
        costPer1kOutput: 0.03

  ollama:
    enabled: true
    baseUrl: http://localhost:11434
    models:
      - id: llama3
        contextWindow: 8000
        costPer1kInput: 0
        costPer1kOutput: 0
```

---

## Task-Based Routing

Different tasks route to different models based on requirements:

### Task Types

| Task Type | Description | Preferred Model |
|-----------|-------------|-----------------|
| `quality-critical` | Important content, complex reasoning | gemini-1.5-pro, claude-3-opus |
| `routine` | Standard operations | gemini-1.5-flash, claude-3-haiku |
| `high-volume` | Bulk processing | gemini-1.5-flash, gpt-3.5-turbo |
| `pedagogical` | Teaching-specific | LearnLM |
| `embedding` | Vector embeddings | text-embedding-3-small |

### Routing Logic

```typescript
function selectModel(taskType: TaskType, agentId: string): ModelRoute {
  const routes: Record<TaskType, ModelRoute[]> = {
    'quality-critical': [
      { provider: 'gemini', model: 'gemini-1.5-pro' },
      { provider: 'anthropic', model: 'claude-3-5-sonnet' },
    ],
    'routine': [
      { provider: 'gemini', model: 'gemini-1.5-flash' },
      { provider: 'openai', model: 'gpt-3.5-turbo' },
    ],
    'high-volume': [
      { provider: 'gemini', model: 'gemini-1.5-flash' },
    ],
    'pedagogical': [
      { provider: 'google', model: 'learnlm-1.5-pro' },
      { provider: 'gemini', model: 'gemini-1.5-pro' },
    ],
  };

  return routes[taskType][0];
}
```

---

## Request/Response Types

### LLMRequest

```typescript
interface LLMRequest {
  messages: Message[];
  temperature?: number;       // 0-1, default 0.7
  maxTokens?: number;         // Max output tokens
  topP?: number;              // Nucleus sampling
  stopSequences?: string[];   // Stop generation triggers
  taskType?: TaskType;        // For routing
  agentId?: string;           // For budget tracking
}

interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
}
```

### LLMResponse

```typescript
interface LLMResponse {
  content: string;
  model: string;
  provider: string;
  tokensUsed: {
    input: number;
    output: number;
  };
  latencyMs: number;
  cached: boolean;
  finishReason?: 'stop' | 'length' | 'content_filter';
}
```

---

## Fallback System

When a provider fails, the system automatically tries fallbacks:

```
Primary Provider (e.g., Gemini)
        ↓ (fails)
Fallback 1 (e.g., Anthropic)
        ↓ (fails)
Fallback 2 (e.g., OpenAI)
        ↓ (fails)
Fallback 3 (e.g., Ollama - local)
        ↓ (fails)
Error returned
```

### Fallback Configuration

```typescript
const fallbackChain: Record<string, string[]> = {
  gemini: ['anthropic', 'openai', 'ollama'],
  anthropic: ['gemini', 'openai', 'ollama'],
  openai: ['gemini', 'anthropic', 'ollama'],
  ollama: ['gemini', 'anthropic', 'openai'],
};
```

### Retry Logic

Each provider attempt includes:
- **Max attempts:** 3
- **Initial delay:** 1000ms
- **Backoff multiplier:** 2x
- **Jitter:** ±50%

---

## Budget Management

### Per-Agent Limits

```typescript
const agentBudgets: Record<AgentId, number> = {
  Jarvis: 50000,
  Scout: 30000,
  Atlas: 200000,
  Sage: 300000,
  Mentor: 50000,
  Herald: 100000,
  Forge: 10000,    // Minimal LLM usage
  Oracle: 50000,
};
```

### Budget Events

```typescript
// Warning at 80% usage
eventBus.emit('budget.warning', {
  agentId: 'Atlas',
  used: 160000,
  limit: 200000,
  percentage: 0.8,
});

// Hard stop at 100%
eventBus.emit('budget.exceeded', {
  agentId: 'Atlas',
  used: 200000,
  limit: 200000,
});
```

### Degradation Levels

| Usage | Level | Action |
|-------|-------|--------|
| < 70% | Normal | Use preferred models |
| 70-90% | Warning | Switch to cheaper models |
| 90-100% | Critical | Essential operations only |
| > 100% | Exceeded | Block new requests |

---

## Cost Tracking

### Per-Request Calculation

```typescript
function calculateCost(tokens: TokenUsage, model: ModelConfig): number {
  const inputCost = (tokens.input / 1000) * model.costPer1kInput;
  const outputCost = (tokens.output / 1000) * model.costPer1kOutput;
  return inputCost + outputCost;
}
```

### Daily Cost Estimate

Based on typical usage patterns:

| Agent | Daily Tokens | Est. Cost/Day |
|-------|--------------|---------------|
| Scout | 30K | $0.02 |
| Atlas | 200K | $0.15 |
| Sage | 300K | $0.25 |
| Mentor | 50K | $0.04 |
| Herald | 100K | $0.08 |
| Forge | 10K | $0.01 |
| Oracle | 50K | $0.04 |
| **Total** | **780K** | **~$0.60** |

---

## Caching

### Response Caching

Identical requests can be cached to reduce costs:

```typescript
const cacheKey = hash({
  messages: request.messages,
  model: request.model,
  temperature: request.temperature,
});

// Check cache (5 min TTL)
const cached = await cache.get(cacheKey);
if (cached) {
  return { ...cached, cached: true };
}
```

### Embedding Cache

Vector embeddings are cached longer (24h):

```typescript
const embeddingKey = `embed:${hash(text)}`;
const cached = await cache.get(embeddingKey);
```

---

## Streaming Support

For real-time tutoring responses:

```typescript
const stream = await llmClient.generateStream(request);

for await (const chunk of stream) {
  // Send chunk to client
  socket.emit('tutor:chunk', chunk);
}
```

---

## Usage Examples

### Basic Generation

```typescript
import { LLMClient } from 'edugenius';

const client = new LLMClient();

const response = await client.generate({
  messages: [
    { role: 'system', content: 'You are a helpful tutor.' },
    { role: 'user', content: 'Explain quadratic equations.' },
  ],
  temperature: 0.7,
  taskType: 'pedagogical',
  agentId: 'Sage',
});

console.log(response.content);
console.log(`Tokens: ${response.tokensUsed.input + response.tokensUsed.output}`);
```

### With Fallback

```typescript
const response = await client.generateWithFallback({
  messages: [...],
  primaryProvider: 'gemini',
  fallbackProviders: ['anthropic', 'openai'],
});
```

### Budget-Aware

```typescript
// Check budget before large operation
if (client.checkBudget('Atlas', 50000)) {
  await client.generate({ ... });
}
```
