---
name: weekly-digest
description: |
  Generate a student-facing weekly email digest with streak, topics mastered, errors fixed,
  progress trajectory, and one specific action for the coming week. Personalized tone
  based on motivation state.
triggers:
  - weekly digest
  - weekly email
  - send progress email
  - student report email
allowed-tools:
  - Bash
---

# Weekly Digest (GBrain MOAT)

Student-facing email that makes progress visible.

## Invocation

```bash
# Generate for one student
npx tsx src/gbrain/operations/weekly-digest.ts <sessionId>

# Batch via API (cron)
curl -X POST -H "Authorization: Bearer $CRON_SECRET" \
  https://gate-math-api.onrender.com/api/gbrain/weekly-digest
```

## Content

1. **Opening** — tailored to motivation_state (celebrate for driven, encourage for flagging)
2. **The numbers** — problems solved, accuracy, streak, topics mastered
3. **Growth proof** — specific concept that went from weak → strong
4. **The ugly truth** — one honest gap that needs attention next week
5. **One action** — concrete next step for this week (not a list, just one)
6. **Predicted score** — current trajectory → target exam score

## Why MOAT

Retention is the whole game in ed-tech. Weekly digests remind students of specific progress
(not vanity metrics) and give them one concrete task — not a overwhelming list. Every digest is
grounded in real cognitive data, not templated fluff. This is what makes students return weekly.
