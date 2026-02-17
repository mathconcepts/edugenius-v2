# Quick Start Guide

Get EduGenius running in 5 minutes.

---

## Prerequisites

- **Node.js** 18.0.0 or higher
- **npm** 9.0.0 or higher
- **TypeScript** 5.3.0 or higher (installed automatically)

---

## Installation

```bash
# Clone or navigate to the project
cd edugenius

# Install dependencies
npm install
```

---

## Running the Platform

### Development Mode

```bash
npm run dev
```

This starts the platform with hot-reloading. The API server runs on `http://localhost:3000`.

### Production Mode

```bash
# Build first
npm run build

# Run
npm start
```

### With Custom Port

```bash
PORT=8080 npm start
```

---

## Programmatic Usage

```typescript
import { start } from 'edugenius';

// Start with default options
const { orchestrator, api } = await start();

// Or with custom configuration
const { orchestrator, api } = await start({
  api: true,
  apiPort: 3000,
  enabledAgents: ['Scout', 'Atlas', 'Sage', 'Mentor', 'Herald', 'Forge', 'Oracle'],
});
```

---

## Verify It's Working

### Check Health

```bash
curl http://localhost:3000/health
```

**Expected response:**
```json
{
  "status": "ok",
  "timestamp": 1708171234567
}
```

### Check System Status

```bash
curl http://localhost:3000/status
```

**Expected response:**
```json
{
  "status": "running",
  "uptime": 12345,
  "agents": [
    { "id": "Scout", "status": "active" },
    { "id": "Atlas", "status": "active" },
    ...
  ],
  "metrics": {
    "totalEvents": 100,
    "eventsPerMinute": 5
  }
}
```

---

## Your First Actions

### 1. Start a Tutoring Session

```bash
curl -X POST http://localhost:3000/tutoring/sessions \
  -H "Content-Type: application/json" \
  -d '{"studentId": "student-001", "topic": "algebra"}'
```

**Response:**
```json
{
  "sessionId": "abc123-...",
  "studentId": "student-001"
}
```

### 2. Ask a Question

```bash
curl -X POST http://localhost:3000/tutoring/sessions/abc123/ask \
  -H "Content-Type: application/json" \
  -d '{"question": "What is a quadratic equation?"}'
```

### 3. Check Analytics

```bash
curl http://localhost:3000/analytics/report?type=daily
```

### 4. Run a Workflow

```bash
curl -X POST http://localhost:3000/workflows/daily-ops/start \
  -H "Content-Type: application/json" \
  -d '{}'
```

---

## Running Tests

```bash
# Run all tests
npm test

# Run with watch mode
npm run test:watch

# Run with coverage
npm run test:coverage
```

---

## Project Structure

```
edugenius/
├── src/
│   ├── agents/           # All 7 domain agents
│   │   ├── base-agent.ts # Base class
│   │   ├── scout/        # Market intelligence
│   │   ├── atlas/        # Content creation
│   │   ├── sage/         # AI tutoring
│   │   ├── mentor/       # Engagement
│   │   ├── herald/       # Marketing
│   │   ├── forge/        # Deployment
│   │   └── oracle/       # Analytics
│   ├── api/              # REST API server
│   ├── data/             # Data layer
│   ├── events/           # Event bus
│   ├── llm/              # LLM abstraction
│   ├── orchestrator/     # Agent coordinator
│   ├── utils/            # Utilities
│   ├── workflows/        # E2E workflows
│   └── index.ts          # Entry point
├── docs/                 # Documentation
├── package.json
├── tsconfig.json
└── vitest.config.ts
```

---

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | 3000 | API server port |
| `NODE_ENV` | development | Environment mode |
| `GEMINI_API_KEY` | - | Google AI API key |
| `ANTHROPIC_API_KEY` | - | Anthropic API key |
| `OPENAI_API_KEY` | - | OpenAI API key |

### Programmatic Config

```typescript
import { getOrchestrator } from 'edugenius';

const orchestrator = getOrchestrator({
  enabledAgents: ['Scout', 'Atlas', 'Sage'], // Select specific agents
  llmConfig: {
    defaultProvider: 'gemini',
    fallbackProviders: ['anthropic', 'openai'],
  },
});
```

---

## Next Steps

1. **Learn about agents:** [02-agent-architecture.md](./02-agent-architecture.md)
2. **Explore the API:** [06-api-reference.md](./06-api-reference.md)
3. **Understand workflows:** [07-workflows.md](./07-workflows.md)
4. **Deploy to production:** [09-deployment.md](./09-deployment.md)
