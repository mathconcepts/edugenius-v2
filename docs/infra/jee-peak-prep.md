# JEE Peak Traffic — Infrastructure Runbook
*Forge ⚙️ — Updated 2026-02-21*

## Context

JEE Main runs Jan–Apr. Historical EdTech data shows **3–5x traffic spikes** during:
- Result day (≈2h spike)
- Answer key release (≈4h spike)
- 2–4 weeks before exam (sustained 2–3x baseline)

Baseline (Prism Cycle 1 seed data):
- 874 chat sessions / cycle
- 1,240 blog views / cycle
- 312 practice attempts / cycle

## Scale Thresholds

| Metric | Warning | Critical | Action |
|--------|---------|----------|--------|
| Concurrent sessions | 600 | 800 | Scale up compute |
| API p95 latency | 1.5s | 3s | Add LLM routing |
| Error rate | 1% | 5% | Alert + investigate |
| CPU utilization | 70% | 85% | Auto-scale trigger |
| Memory | 75% | 90% | Scale or OOM risk |

## Autoscale Config

```yaml
# autoscale.yaml — target values for JEE season
autoscale:
  min_instances: 2
  max_instances: 10
  scale_up_threshold:
    concurrent_sessions: 800
    cpu_pct: 70
  scale_down_threshold:
    concurrent_sessions: 200
    cpu_pct: 30
  cooldown_seconds: 180
```

## CDN Cache Strategy

Blog routes are the highest-traffic entry points. Target cache hit rate: **>85%**.

```
/website/blog/*           → Cache-Control: public, max-age=3600, stale-while-revalidate=86400
/website/blog/{slug}      → Cache-Control: public, max-age=1800, stale-while-revalidate=3600
/api/blog/*               → Cache-Control: public, max-age=300 (5min for dynamic data)
/api/chat/*               → Cache-Control: no-store (real-time, never cache)
```

Pre-warm CDN for top blog posts before exam week:
```bash
# Pre-warm top 10 blog posts (run before exam season)
TOP_POSTS=(
  "jee-main-2026-complete-strategy"
  "jee-main-2026-90-day-study-plan"
  "jee-main-2026-chapter-wise-weightage"
  "organic-chemistry-named-reactions-jee"
)

for slug in "${TOP_POSTS[@]}"; do
  curl -s -o /dev/null "https://edugenius.app/website/blog/$slug" &
done
wait
echo "CDN pre-warm complete"
```

## LLM Latency Budget

Sage must respond in **<3s p95** during peak.

| Tier | Target | Max |
|------|--------|-----|
| First token (streaming) | 400ms | 800ms |
| Full response (short) | 1.2s | 2s |
| Full response (complex) | 2s | 3s |

Fallback: If LLM API p95 > 2.5s, route to cached frequent answers.

## Trace Storage (localStorage)

- Key: `edugenius_traces`
- Max entries: 100 (LRU eviction active)
- Quota warning: 80% of 5MB (~4MB)
- **Action on quota warn**: `evictOldTraces()` called automatically (drops 25% oldest)

Monitor: `getTraceStorageUsage()` logs to console on every write.

## Prism State Persistence

- Key: `edugenius_prism_state`
- Ensure server-side Prism heartbeat state is written to a durable store before restart
- On cold start: Prism re-initializes from persisted state in < 30s

## Monitoring Checklist (pre-exam week)

- [ ] CDN cache hit rate > 85% on `/website/blog/*`
- [ ] Autoscale min_instances bumped to 3 during exam week
- [ ] LLM response latency p95 baseline measured and alerting set
- [ ] localStorage quota monitoring active in production (console warnings)
- [ ] Database connection pool sized for 3x baseline
- [ ] Error rate alerting: warn@1%, critical@5%
- [ ] On-call rotation confirmed
- [ ] Rollback plan tested

---

*Review this doc before each JEE exam window. Next window: JEE Main Session 2 (expected Apr 2026).*
