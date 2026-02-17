# API Reference

Complete documentation of all 23 REST API endpoints.

---

## Base URL

```
http://localhost:3000
```

---

## Authentication

Authentication is optional but recommended for production:

### API Key (Header)

```
X-API-Key: your-api-key
```

### Bearer Token

```
Authorization: Bearer your-token
```

---

## Response Format

All responses are JSON:

### Success Response

```json
{
  "data": { ... },
  "timestamp": 1708171234567
}
```

### Error Response

```json
{
  "error": "Error message",
  "code": "ERROR_CODE",
  "details": { ... }
}
```

---

## Health & Status

### GET /health

Health check endpoint.

**Response:**
```json
{
  "status": "ok",
  "timestamp": 1708171234567
}
```

### GET /status

System status with all agents.

**Response:**
```json
{
  "status": "running",
  "uptime": 12345,
  "agents": [
    {
      "id": "Scout",
      "status": "active",
      "lastHeartbeat": 1708171234567,
      "tokensUsedToday": 5000,
      "errors": 0
    },
    // ... other agents
  ],
  "metrics": {
    "totalEvents": 100,
    "eventsPerMinute": 5,
    "activeWorkflows": 2,
    "completedWorkflows": 50,
    "failedWorkflows": 1,
    "cacheHitRate": 0.95
  }
}
```

---

## Agents

### GET /agents

List all agents.

**Response:**
```json
{
  "agents": [
    {
      "id": "Scout",
      "status": "active",
      "lastHeartbeat": 1708171234567,
      "tokensUsedToday": 5000,
      "errors": 0
    },
    // ...
  ]
}
```

### GET /agents/:agentId

Get agent details.

**Parameters:**
- `agentId` - Agent ID (Scout, Atlas, Sage, etc.)

**Response:**
```json
{
  "id": "Scout",
  "name": "Scout",
  "description": "Market intelligence agent",
  "state": {
    "status": "active",
    "startedAt": 1708170000000,
    "lastHeartbeat": 1708171234567,
    "lastActivity": 1708171200000,
    "tokensUsedToday": 5000,
    "errors": []
  }
}
```

**Errors:**
- `404` - Agent not found

---

## Workflows

### GET /workflows

List available workflows.

**Response:**
```json
{
  "workflows": [
    { "id": "exam-launch", "name": "New Exam Launch" },
    { "id": "daily-ops", "name": "Daily Operations" },
    { "id": "student-session", "name": "Student Learning Session" },
    { "id": "content-pipeline", "name": "Content Creation Pipeline" },
    { "id": "deployment", "name": "Production Deployment" }
  ]
}
```

### POST /workflows/:workflowId/start

Start a workflow.

**Parameters:**
- `workflowId` - Workflow ID

**Body:**
```json
{
  "examId": "cbse-10-math",
  "examName": "CBSE Class 10 Mathematics"
}
```

**Response:**
```json
{
  "instanceId": "workflow-abc123",
  "workflowId": "exam-launch",
  "status": "started"
}
```

### GET /workflows/instances/:instanceId

Get workflow instance status.

**Parameters:**
- `instanceId` - Workflow instance ID

**Response:**
```json
{
  "instanceId": "workflow-abc123",
  "workflowId": "exam-launch",
  "status": "running",
  "currentStep": "content-create",
  "completedSteps": ["research", "content-plan"],
  "startedAt": 1708170000000
}
```

---

## Tutoring (Sage)

### POST /tutoring/sessions

Start a new tutoring session.

**Body:**
```json
{
  "studentId": "student-001",
  "topic": "algebra"
}
```

**Response:**
```json
{
  "sessionId": "session-abc123",
  "studentId": "student-001"
}
```

**Errors:**
- `400` - studentId is required

### POST /tutoring/sessions/:sessionId/ask

Ask a question in session.

**Parameters:**
- `sessionId` - Session ID

**Body:**
```json
{
  "question": "What is a quadratic equation?"
}
```

**Response:**
```json
{
  "status": "processing",
  "sessionId": "session-abc123"
}
```

**Errors:**
- `400` - question is required
- `404` - Session not found

### GET /tutoring/sessions/:sessionId

Get session details.

**Parameters:**
- `sessionId` - Session ID

**Response:**
```json
{
  "id": "session-abc123",
  "studentId": "student-001",
  "topic": "algebra",
  "status": "active",
  "startedAt": 1708170000000,
  "context": {
    "difficulty": "medium",
    "mastery": 0.65,
    "emotionalState": "neutral",
    "hintsUsed": 2,
    "questionsAsked": 5,
    "correctAnswers": 3
  },
  "messages": [
    {
      "role": "tutor",
      "content": "Hi! Ready to learn algebra?",
      "timestamp": 1708170000000
    },
    // ...
  ]
}
```

---

## Content (Atlas)

### POST /content

Create content request.

**Body:**
```json
{
  "topic": "Quadratic Equations",
  "type": "lesson",
  "subject": "mathematics"
}
```

**Response:**
```json
{
  "contentId": "content-abc123",
  "status": "queued"
}
```

**Errors:**
- `400` - topic, type, and subject are required

### GET /content/:contentId

Get content details.

**Parameters:**
- `contentId` - Content ID

**Response:**
```json
{
  "id": "content-abc123",
  "title": "Understanding Quadratic Equations",
  "type": "lesson",
  "subject": "mathematics",
  "topic": "Quadratic Equations",
  "status": "published",
  "body": "...",
  "metadata": {
    "wordCount": 1500,
    "readingTime": 8,
    "difficulty": 0.6
  }
}
```

---

## Students (Mentor)

### GET /students/:studentId/engagement

Get student engagement score.

**Parameters:**
- `studentId` - Student ID

**Response:**
```json
{
  "studentId": "student-001",
  "score": 0.75,
  "churnRisk": 0.25,
  "factors": {
    "recency": 0.9,
    "frequency": 0.7,
    "duration": 0.6,
    "progress": 0.8,
    "streak": 0.5
  },
  "calculatedAt": 1708171234567
}
```

### POST /students/:studentId/nudge

Send a nudge to student.

**Parameters:**
- `studentId` - Student ID

**Body:**
```json
{
  "message": "Keep up the great work!",
  "channel": "push"
}
```

**Response:**
```json
{
  "status": "sent",
  "studentId": "student-001"
}
```

---

## Campaigns (Herald)

### POST /campaigns

Create and launch a campaign.

**Body:**
```json
{
  "name": "Summer Sale",
  "type": "promotional",
  "channels": ["email", "twitter", "linkedin"]
}
```

**Response:**
```json
{
  "campaignId": "campaign-abc123",
  "status": "launched"
}
```

**Errors:**
- `400` - name, type, and channels are required

### GET /campaigns

List active campaigns.

**Response:**
```json
{
  "campaigns": [
    {
      "id": "campaign-abc123",
      "name": "Summer Sale",
      "type": "promotional",
      "status": "active",
      "channels": ["email", "twitter"],
      "metrics": {
        "impressions": 10000,
        "clicks": 500,
        "conversions": 50
      }
    }
  ]
}
```

---

## Deployments (Forge)

### POST /deploy

Start a deployment.

**Body:**
```json
{
  "environment": "staging",
  "version": "v1.2.3"
}
```

**Response:**
```json
{
  "deploymentId": "deploy-abc123",
  "status": "started"
}
```

**Errors:**
- `400` - environment and version are required

### GET /deploy/:deploymentId

Get deployment status.

**Parameters:**
- `deploymentId` - Deployment ID

**Response:**
```json
{
  "id": "deploy-abc123",
  "environment": "staging",
  "version": "v1.2.3",
  "status": "success",
  "startedAt": 1708170000000,
  "completedAt": 1708170300000,
  "duration": 300000
}
```

### GET /health-check

Run system health check.

**Response:**
```json
{
  "success": true,
  "overall": "healthy",
  "services": [
    {
      "service": "api",
      "status": "healthy",
      "latency": 50,
      "errorRate": 0.001,
      "uptime": 0.999
    },
    {
      "service": "db",
      "status": "healthy",
      "latency": 10,
      "errorRate": 0,
      "uptime": 1.0
    }
  ],
  "timestamp": 1708171234567
}
```

---

## Analytics (Oracle)

### GET /analytics/report

Get analytics report.

**Query Parameters:**
- `type` - Report type: `daily`, `weekly`, `monthly` (default: `daily`)

**Response:**
```json
{
  "id": "report-abc123",
  "type": "daily",
  "period": {
    "start": 1708128000000,
    "end": 1708214400000,
    "label": "2026-02-17"
  },
  "metrics": [
    {
      "name": "learning.sessions",
      "value": 150,
      "change": 0.15,
      "trend": "up"
    },
    {
      "name": "learning.mastery",
      "value": 0.72,
      "change": 0.03,
      "trend": "up"
    }
  ],
  "insights": [
    "learning.sessions increased by 15%"
  ],
  "highlights": [
    "📈 learning.sessions up 15%"
  ],
  "anomalies": [],
  "generatedAt": 1708171234567
}
```

### GET /analytics/funnel

Get funnel analysis.

**Response:**
```json
{
  "success": true,
  "funnel": {
    "id": "default",
    "steps": [
      {
        "name": "Visit",
        "count": 10000,
        "conversionRate": 1.0,
        "dropoff": 0
      },
      {
        "name": "Sign Up",
        "count": 2000,
        "conversionRate": 0.2,
        "dropoff": 0.8
      },
      {
        "name": "First Session",
        "count": 1500,
        "conversionRate": 0.75,
        "dropoff": 0.25
      },
      {
        "name": "Subscription",
        "count": 500,
        "conversionRate": 0.33,
        "dropoff": 0.67
      }
    ],
    "overallConversion": 0.05,
    "biggestDropoff": "Sign Up"
  },
  "recommendations": [
    "High dropoff at \"Sign Up\" (80%) — needs optimization"
  ]
}
```

### GET /analytics/cohorts

Get cohort analysis.

**Response:**
```json
{
  "success": true,
  "data": {
    "type": "weekly",
    "cohorts": [
      {
        "name": "2026-02",
        "size": 500,
        "retention": [1.0, 0.75, 0.60, 0.50, 0.45]
      },
      {
        "name": "2026-01",
        "size": 450,
        "retention": [1.0, 0.70, 0.55, 0.45, 0.40]
      }
    ],
    "avgRetention": [1.0, 0.72, 0.57, 0.47, 0.42]
  },
  "insights": [
    "📈 Recent cohorts showing improved retention"
  ]
}
```

### POST /analytics/metrics

Record a custom metric.

**Body:**
```json
{
  "name": "custom.metric",
  "value": 42,
  "dimensions": {
    "source": "api",
    "type": "custom"
  }
}
```

**Response:**
```json
{
  "status": "recorded"
}
```

**Errors:**
- `400` - name and value are required

---

## Rate Limiting

Default limits:
- **100 requests** per minute per IP
- Rate limit headers included in responses

**Headers:**
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1708171300
```

**429 Response:**
```json
{
  "error": "Too Many Requests"
}
```

---

## Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `INVALID_REQUEST` | 400 | Invalid request body |
| `UNAUTHORIZED` | 401 | Missing/invalid API key |
| `FORBIDDEN` | 403 | Insufficient permissions |
| `NOT_FOUND` | 404 | Resource not found |
| `RATE_LIMITED` | 429 | Too many requests |
| `INTERNAL_ERROR` | 500 | Server error |
| `SERVICE_UNAVAILABLE` | 503 | Agent unavailable |
