---
name: verify-sweep
description: |
  Re-verify all generated problems with the latest Wolfram + Gemini to catch model drift,
  prompt changes, or edge cases that slipped through initial verification. Runs weekly.
  Demotes problems that fail re-verification so they stop being served.
triggers:
  - verify sweep
  - re-verify problems
  - check problem correctness
  - verification audit
allowed-tools:
  - Bash
---

# Verification Sweep (GBrain MOAT)

Quality control layer that keeps the problem bank clean as models evolve.

## Invocation

```bash
# Sweep all verified problems
npx tsx src/gbrain/operations/verify-sweep.ts

# Sweep only a topic
npx tsx src/gbrain/operations/verify-sweep.ts --topic calculus

# Aggressive re-verify (use Wolfram even when Gemini agrees)
npx tsx src/gbrain/operations/verify-sweep.ts --strict
```

## Process

For each problem in `generated_problems` where `verified = true`:

1. Re-solve with fresh Gemini 2.5-flash call
2. If answer changes vs. stored `correct_answer`:
   - Demote to `verified = false`
   - Log to `verification_audit_log` with old/new answers
3. For problems passing Gemini: cross-check against Wolfram (if budget allows)
4. For problems passing both: update `verified_at` timestamp (freshness indicator)

## Demotion Policy

- Problem with disagreement → `verified = false`, stops being served
- 3 consecutive failed verifications → moved to `quarantine_problems` table
- Admin can manually review quarantine and restore/delete

## Why MOAT

Static question banks rot silently — nobody notices a wrong answer until a student complains.
Your system **catches model drift automatically**. When Gemini changes behavior, you detect
problems that no longer verify. Competitors just serve wrong answers.
