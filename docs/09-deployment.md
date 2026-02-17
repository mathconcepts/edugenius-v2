# Deployment Guide

Production deployment and operations guide for EduGenius.

---

## Deployment Options

| Option | Best For | Complexity |
|--------|----------|------------|
| **Single Server** | Small scale, testing | Low |
| **Docker** | Standardized deployment | Medium |
| **Kubernetes** | High availability, scaling | High |
| **Serverless** | Event-driven, cost optimization | Medium |

---

## Prerequisites

- Node.js 18+ 
- npm 9+
- Environment variables configured
- (Optional) Redis for distributed caching
- (Optional) PostgreSQL/MongoDB for persistence

---

## Environment Variables

### Required

```bash
# LLM Providers (at least one required)
GEMINI_API_KEY=your-gemini-key
ANTHROPIC_API_KEY=your-anthropic-key
OPENAI_API_KEY=your-openai-key

# Server
PORT=3000
NODE_ENV=production
```

### Optional

```bash
# Cache (defaults to in-memory)
REDIS_URL=redis://localhost:6379

# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/edugenius

# Monitoring
SENTRY_DSN=https://...@sentry.io/...

# API Security
API_KEYS=key1,key2,key3
RATE_LIMIT_MAX=100
RATE_LIMIT_WINDOW_MS=60000

# Agent Configuration
ENABLED_AGENTS=Scout,Atlas,Sage,Mentor,Herald,Forge,Oracle
```

---

## Single Server Deployment

### 1. Build

```bash
npm ci --production
npm run build
```

### 2. Start

```bash
NODE_ENV=production npm start
```

### 3. Process Manager (PM2)

```bash
# Install PM2
npm install -g pm2

# Start with PM2
pm2 start dist/index.js --name edugenius

# Save process list
pm2 save

# Setup startup script
pm2 startup
```

### PM2 Ecosystem File

```javascript
// ecosystem.config.js
module.exports = {
  apps: [{
    name: 'edugenius',
    script: './dist/index.js',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3000,
    },
    env_production: {
      NODE_ENV: 'production',
    },
  }],
};
```

---

## Docker Deployment

### Dockerfile

```dockerfile
FROM node:20-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine

WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

CMD ["node", "dist/index.js"]
```

### docker-compose.yml

```yaml
version: '3.8'

services:
  edugenius:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - GEMINI_API_KEY=${GEMINI_API_KEY}
      - REDIS_URL=redis://redis:6379
    depends_on:
      - redis
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  redis:
    image: redis:7-alpine
    volumes:
      - redis-data:/data
    restart: unless-stopped

volumes:
  redis-data:
```

### Build and Run

```bash
# Build
docker-compose build

# Start
docker-compose up -d

# View logs
docker-compose logs -f edugenius

# Stop
docker-compose down
```

---

## Kubernetes Deployment

### deployment.yaml

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: edugenius
spec:
  replicas: 3
  selector:
    matchLabels:
      app: edugenius
  template:
    metadata:
      labels:
        app: edugenius
    spec:
      containers:
      - name: edugenius
        image: edugenius:latest
        ports:
        - containerPort: 3000
        env:
        - name: NODE_ENV
          value: "production"
        - name: GEMINI_API_KEY
          valueFrom:
            secretKeyRef:
              name: edugenius-secrets
              key: gemini-api-key
        resources:
          requests:
            memory: "512Mi"
            cpu: "500m"
          limits:
            memory: "1Gi"
            cpu: "1000m"
        livenessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 5
```

### service.yaml

```yaml
apiVersion: v1
kind: Service
metadata:
  name: edugenius
spec:
  selector:
    app: edugenius
  ports:
  - port: 80
    targetPort: 3000
  type: LoadBalancer
```

### Deploy

```bash
kubectl apply -f k8s/
```

---

## Health Monitoring

### Health Endpoints

| Endpoint | Purpose |
|----------|---------|
| `/health` | Basic health check |
| `/status` | Detailed system status |
| `/health-check` | Full health check (all services) |

### Monitoring Stack

```yaml
# docker-compose.monitoring.yml
version: '3.8'

services:
  prometheus:
    image: prom/prometheus
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml
    ports:
      - "9090:9090"

  grafana:
    image: grafana/grafana
    ports:
      - "3001:3000"
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin
```

### Key Metrics to Monitor

| Metric | Alert Threshold |
|--------|-----------------|
| API Response Time | > 500ms |
| Error Rate | > 1% |
| Agent Errors | > 5/hour |
| Token Usage | > 90% daily budget |
| Memory Usage | > 80% |
| CPU Usage | > 80% |

---

## Scaling

### Horizontal Scaling

```yaml
# Kubernetes HPA
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: edugenius-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: edugenius
  minReplicas: 3
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
```

### Agent Distribution

For high load, distribute agents across nodes:

```yaml
# Separate deployments per agent type
apiVersion: apps/v1
kind: Deployment
metadata:
  name: edugenius-sage
spec:
  replicas: 5  # More replicas for tutoring
  template:
    spec:
      containers:
      - name: edugenius
        env:
        - name: ENABLED_AGENTS
          value: "Sage"
```

---

## Security

### API Authentication

```typescript
// Enable API key authentication
const server = createAPIServer({
  auth: {
    enabled: true,
    apiKeys: process.env.API_KEYS?.split(',') || [],
  },
});
```

### Rate Limiting

```typescript
const server = createAPIServer({
  rateLimit: {
    windowMs: 60000,
    maxRequests: 100,
  },
});
```

### HTTPS

Use a reverse proxy (nginx, Caddy) for TLS termination:

```nginx
# nginx.conf
server {
    listen 443 ssl;
    server_name api.edugenius.ai;
    
    ssl_certificate /etc/ssl/certs/edugenius.crt;
    ssl_certificate_key /etc/ssl/private/edugenius.key;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

---

## Backup & Recovery

### Data to Backup

1. **Redis data** (cache, sessions)
2. **Database** (students, content, analytics)
3. **Configuration files**
4. **Logs** (for debugging)

### Backup Script

```bash
#!/bin/bash
DATE=$(date +%Y%m%d)
BACKUP_DIR=/backups/$DATE

mkdir -p $BACKUP_DIR

# Redis
redis-cli BGSAVE
cp /var/lib/redis/dump.rdb $BACKUP_DIR/

# PostgreSQL
pg_dump edugenius > $BACKUP_DIR/edugenius.sql

# Compress
tar -czf $BACKUP_DIR.tar.gz $BACKUP_DIR
```

---

## Logging

### Log Configuration

```typescript
// Use structured logging
const logger = {
  info: (msg, data) => console.log(JSON.stringify({ level: 'info', msg, ...data })),
  error: (msg, data) => console.error(JSON.stringify({ level: 'error', msg, ...data })),
};
```

### Log Aggregation

```yaml
# Filebeat config for ELK stack
filebeat.inputs:
- type: container
  paths:
    - '/var/lib/docker/containers/*/*.log'
  processors:
    - add_kubernetes_metadata:
        host: ${NODE_NAME}
        matchers:
        - logs_path:
            logs_path: "/var/log/containers/"

output.elasticsearch:
  hosts: ["elasticsearch:9200"]
```

---

## Rollback Procedure

### 1. Stop Current Deployment

```bash
# Docker
docker-compose down

# Kubernetes
kubectl rollout undo deployment/edugenius
```

### 2. Restore Previous Version

```bash
# Docker
docker-compose up -d --build --force-recreate

# Kubernetes
kubectl rollout history deployment/edugenius
kubectl rollout undo deployment/edugenius --to-revision=<N>
```

### 3. Verify

```bash
curl http://localhost:3000/health
curl http://localhost:3000/status
```

---

## Troubleshooting

### Common Issues

| Issue | Solution |
|-------|----------|
| Agent not starting | Check API keys, network |
| High memory usage | Reduce concurrent sessions |
| Slow responses | Check LLM provider latency |
| Token budget exceeded | Increase limits or optimize prompts |

### Debug Mode

```bash
NODE_ENV=development DEBUG=edugenius:* npm start
```

### Log Investigation

```bash
# Find errors
grep -i error /var/log/edugenius/*.log

# Recent activity
tail -f /var/log/edugenius/app.log
```
