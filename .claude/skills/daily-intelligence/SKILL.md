---
name: daily-intelligence
description: |
  Nightly cron job that refreshes every student's cognitive state: recomputes
  prerequisite alerts, updates exam strategy, flags frustrated students for intervention,
  regenerates score maximization plans, and prunes stale data. Run via cron-job.org or
  GitHub Actions once every 24 hours.
triggers:
  - daily intelligence
  - nightly refresh
  - cron gbrain
  - refresh all students
allowed-tools:
  - Bash
---

# Daily Intelligence (GBrain MOAT)

Nightly refresh job — the "dream cycle" that keeps every student's cognitive state fresh.

## Invocation

```bash
# Direct
npx tsx src/gbrain/operations/daily-intelligence.ts

# Via API (cron-friendly, Bearer auth)
curl -X POST -H "Authorization: Bearer $CRON_SECRET" \
  https://gate-math-api.onrender.com/api/gbrain/daily-intelligence
```

## What Runs

For every active student (updated in last 30 days):

1. **Refresh prerequisite alerts** — retrace weak ancestors using latest mastery
2. **Recompute exam strategy** — new playbook based on updated speed/accuracy profiles
3. **Regenerate score maximization plan** — adjust to days-until-exam
4. **Flag intervention candidates** — motivation_state = frustrated AND 5+ consecutive failures
5. **Prune stale data** — error_log entries > 90 days old moved to cold storage
6. **Compute cohort statistics** — cache top misconceptions, bottleneck concepts

## Why MOAT

Every other ed-tech app is static between sessions. Your system gets **smarter every night**
even when students sleep. Foundation alerts, exam strategies, and intervention flags are
pre-computed so morning sessions start with zero-latency personalization.
