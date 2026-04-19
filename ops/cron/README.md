# Production Cron Jobs for GBrain

This directory contains the GitHub Actions workflow for GBrain's scheduled cron jobs.

## Why It's Here (Not in `.github/workflows/`)

The automated deployment PAT used to push this file doesn't have the `workflow` scope,
which GitHub requires for any file under `.github/workflows/`. A repo owner with full
permissions should install the workflow by running:

```bash
mkdir -p .github/workflows
cp ops/cron/github-workflow-gbrain-cron.yml .github/workflows/gbrain-cron.yml
git add .github/workflows/gbrain-cron.yml
git commit -m "ops: install gbrain cron workflow"
git push
```

Or use the GitHub web UI to create `.github/workflows/gbrain-cron.yml` by copying the
contents of `github-workflow-gbrain-cron.yml` here.

## Required Secrets (GitHub repo settings → Secrets and variables → Actions)

| Secret | Value |
|--------|-------|
| `CRON_SECRET` | Match the value Render auto-generated for your web service |
| `APP_URL` | Your Render URL, e.g. `https://gate-math-api.onrender.com` |

## Schedule

| Job | Schedule (UTC) | Purpose |
|-----|----------------|---------|
| `daily-intelligence` | 2:00 AM nightly | Refresh prereq alerts, recompute exam strategies, flag frustrated students, prune old logs |
| `seed-rag` | Sun 3:00 AM weekly | Pre-seed RAG cache with new PYQ + verified generated problem embeddings |
| `verify-sweep` | Mon 4:00 AM weekly | Re-verify 100 most-served generated problems, demote failures |
| `content-gap-fill` | Every 6 hours | Auto-generate problems for top-priority gaps (budget: 10/run) |

## Manual Runs

Trigger any job manually via:
**GitHub repo → Actions tab → GBrain Cron Jobs → Run workflow**

Select the job from the dropdown (`all` runs everything).

## Alternative: cron-job.org (if GitHub Actions unavailable)

For each job, create a scheduled HTTP POST at cron-job.org:
- URL: `$APP_URL/api/gbrain/<job-name>`
- Method: POST
- Header: `Authorization: Bearer <CRON_SECRET>`
- Timeout: 300-900 seconds depending on job
