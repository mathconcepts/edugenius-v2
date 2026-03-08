# Agent Connection Map — Bidirectional Signal Reference

> **Last updated:** 2026-03-08  
> **Audit status:** ✅ Complete — all 7 core agents fully connected  
> **Source files:** `services/signalBus.ts`, `services/examOrchestrator.ts`, `services/persistenceDB.ts`

---

## Overview

EduGenius uses a **typed signal bus** (IndexedDB-backed) to connect all 7 domain agents bidirectionally. Every signal is:

- **Typed** — strongly typed union in `AgentSignal.type` (persistenceDB.ts)
- **Persisted** — survives page reload, delivered on next agent tick
- **Directed** — every signal has a `sourceAgent` and `targetAgent`
- **Emittable** — each signal type has a dedicated `emit*()` function in signalBus.ts
- **Orchestrated** — the `examOrchestrator.ts` routes all lifecycle signals through `processFeedbackLoop()`

---

## Full Connection Matrix

```
FROM ╲ TO    Scout  Atlas  Sage  Mentor Herald  Forge Oracle
─────────────────────────────────────────────────────────────
Scout          ·      ✓     ·      ·      ✓      ·     ·
Atlas          ·      ·     ✓      ·      ·      ·     ✓
Sage           ·      ✓     ·      ✓      ✓      ✓     ✓
Mentor         ·      ✓     ✓      ·      ·      ·     ·
Herald         ✓      ·     ·      ·      ·      ·     ✓
Forge          ✓      ·     ·      ✓      ✓      ·     ✓
Oracle         ✓      ✓     ·      ✓      ✓      ·     ·
CEO            ✓      ✓     ✓      ✓      ✓      ✓     ✓
UserService    ·      ·     ✓      ✓      ·      ·     ✓
Lens           ·      ✓     ·      ✓      ·      ·     ✓

✓ = connected  · = no direct signal (by design)
```

---

## Signal Catalogue — All 24 Types

### Student Learning Signals (runtime, Sage/Lens → others)

| Signal | Source → Target | Trigger | Emit Function |
|--------|----------------|---------|---------------|
| `CONTENT_GAP` | Sage → Atlas | Student can't understand a topic; Atlas generates an alternative explanation | `emitContentGap()` |
| `STRUGGLE_PATTERN` | Sage → Atlas | Multiple students failing same concept; Atlas generates targeted content | `emitStrugglePattern()` |
| `MASTERY_ACHIEVED` | Sage → Oracle + Mentor | Student masters a topic; Oracle tracks, Mentor celebrates | `emitMasteryAchieved()` |
| `FRUSTRATION_ALERT` | Sage → Mentor | Student shows frustration signals; Mentor sends encouragement | `emitFrustrationAlert()` |
| `BREAKTHROUGH` | Sage → Oracle + Mentor | Student has a breakthrough moment | `emitBreakthrough()` |
| `FORMAT_REQUEST` | Lens → Atlas | Student's channel/device needs a different content format | `emitFormatRequest()` |
| `FORMAT_SUCCESS` | Sage → Atlas | A specific format worked well; reinforce with Atlas | `emitFormatSuccess()` |
| `SR_OVERDUE` | Lens → Mentor | Spaced repetition review is overdue; Mentor sends nudge | `emitSROverdue()` |
| `BEHAVIORAL_SNAPSHOT` | Lens → Oracle | Session-level behavioral data for analytics | `emitBehavioralSnapshot()` |
| `CHURN_RISK` | Oracle → Mentor | Student at risk of dropping off; Mentor triggers re-engagement | `emitChurnRisk()` |

### Exam Lifecycle Signals (CEO approval → live exam → steady state)

| Signal | Source → Target | Trigger | Emit Function |
|--------|----------------|---------|---------------|
| `EXAM_APPROVED` | CEO → ALL 7 | CEO finalises exam in wizard; all agents start their jobs | `emitExamApproved()` |
| `CONTENT_READY` | Atlas → Sage | Content batch generated; Sage verifies accuracy | `emitContentReady()` |
| `CONTENT_VERIFIED` | Sage → Forge + Herald | Accuracy confirmed; Forge deploys, Herald promotes | `emitContentVerified()` |
| `EXAM_DEPLOYED` | Forge → Oracle + Herald + Mentor | Exam live on CDN; tracking, campaigns, onboarding begin | `emitExamDeployed()` |
| `MARKETING_LIVE` | Herald → Oracle | Marketing campaigns launched; Oracle tracks performance | `emitMarketingLive()` (via orchestrator) |
| `STUDENT_ENROLLED` | UserService → Mentor + Sage + Oracle | Student signs up; triggers onboarding, tutor context, tracking | `emitStudentEnrolled()` |
| `PERFORMANCE_INSIGHT` | Oracle → Scout + Atlas + Mentor | Weekly analytics; Scout researches gaps, Atlas refreshes content, Mentor adjusts nudges | `emitPerformanceInsight()` |
| `CONTENT_STALE` | Oracle → Atlas | Topic engagement dropped; Atlas regenerates | (via orchestrator) |
| `CHURN_COHORT_ALERT` | Oracle → Mentor | Cohort at risk; Mentor triggers intervention | (via orchestrator) |
| `EXAM_HEALTH_REPORT` | Oracle → CEO | Weekly health summary for CEO dashboard | (reserved) |

### Gap-Fill Connections (added 2026-03-08 — bidirectional audit)

| Signal | Source → Target | Trigger | Emit Function |
|--------|----------------|---------|---------------|
| `TREND_SIGNAL` | Scout → Atlas | New keyword/PYQ pattern found; Atlas generates targeted content | `emitTrendSignal()` |
| `KEYWORD_OPPORTUNITY` | Scout → Herald | High-volume keyword with low competition; Herald creates campaign | `emitKeywordOpportunity()` |
| `DEPLOY_METRICS` | Forge → Scout | Exam deployed; Scout monitors SEO rankings + CDN performance | `emitDeployMetrics()` |
| `STUDENT_STRUGGLING` | Mentor → Sage | Student stuck for N days; Sage triggers doubt-clearing session | `emitStudentStruggling()` |
| `ENGAGEMENT_GAP` | Mentor → Atlas | Topic has persistent low engagement; Atlas generates fresh variant | `emitEngagementGap()` |
| `CAMPAIGN_PERFORMANCE` | Oracle → Herald | Campaign CTR/ROAS data; Herald adjusts or kills campaigns | `emitCampaignPerformance()` |
| `CAMPAIGN_RESULT` | Herald → Scout | Campaign underperformed; Scout researches why | `emitCampaignResult()` |
| `CONTENT_PUBLISHED` | Atlas → Oracle | New content live; Oracle sets up performance tracking | `emitContentPublished()` |

---

## Agent Responsibility Summary

### Scout 🔍 (Market Intelligence)
**Receives from:** Oracle (performance_insight, via examOrchestrator), Forge (deploy_metrics), Herald (campaign_result)  
**Sends to:** Atlas (trend_signal), Herald (keyword_opportunity)  
**Job:** Monitor keywords, competitors, PYQ patterns. Feed actionable signals to content and marketing.

### Atlas 📚 (Content Factory)
**Receives from:** Sage (content_gap, struggle_pattern, format_success), Lens (format_request), Oracle (content_stale), Scout (trend_signal), Mentor (engagement_gap), CEO (exam_approved)  
**Sends to:** Sage (content_ready), Oracle (content_published)  
**Job:** Generate all content. React to every demand signal. Never idle when there's a gap.

### Sage 🎓 (AI Tutor)
**Receives from:** Atlas (content_ready), Mentor (student_struggling), CEO (exam_approved), UserService (student_enrolled)  
**Sends to:** Atlas (content_gap, struggle_pattern, format_success), Oracle (mastery_achieved, breakthrough, behavioral_snapshot), Mentor (mastery_achieved, frustration_alert, breakthrough), Forge (content_verified), Herald (content_verified)  
**Job:** Teach, verify, and report. Central learning signal hub.

### Mentor 👨‍🏫 (Engagement)
**Receives from:** Sage (mastery_achieved, frustration_alert, breakthrough), Oracle (churn_risk, churn_cohort_alert), Lens (sr_overdue), Forge (exam_deployed), CEO (exam_approved), UserService (student_enrolled)  
**Sends to:** Sage (student_struggling), Atlas (engagement_gap)  
**Job:** Keep students engaged. Escalate to Sage when stuck. Flag content gaps to Atlas.

### Herald 📢 (Marketing)
**Receives from:** Sage (content_verified), Forge (exam_deployed), Oracle (campaign_performance), Scout (keyword_opportunity), CEO (exam_approved)  
**Sends to:** Oracle (marketing_live), Scout (campaign_result)  
**Job:** Launch campaigns when content is verified and deployed. React to performance data. Feed results back to Scout.

### Forge ⚙️ (DevOps)
**Receives from:** Sage (content_verified), CEO (exam_approved)  
**Sends to:** Oracle (exam_deployed), Herald (exam_deployed), Mentor (exam_deployed), Scout (deploy_metrics)  
**Job:** Deploy and maintain infrastructure. Signal all stakeholders when live. Hand SEO monitoring to Scout.

### Oracle 📊 (Analytics)
**Receives from:** Sage (mastery_achieved, breakthrough, behavioral_snapshot), Lens (behavioral_snapshot), Oracle self (churn_risk calculation), Forge (exam_deployed), Herald (marketing_live), UserService (student_enrolled), Atlas (content_published)  
**Sends to:** Mentor (churn_risk, churn_cohort_alert), Atlas (content_stale), Scout (performance_insight), Herald (campaign_performance)  
**Job:** Track everything. Drive the feedback loops. Health score keeper.

---

## Exam Lifecycle Flow

```
CEO Approves Exam
        │
        ├──EXAM_APPROVED──▶ Scout   → begins keyword monitoring
        ├──EXAM_APPROVED──▶ Atlas   → starts daily content batch
        ├──EXAM_APPROVED──▶ Sage    → ingests exam context
        ├──EXAM_APPROVED──▶ Forge   → deploys infrastructure
        ├──EXAM_APPROVED──▶ Herald  → launches SEO campaigns
        ├──EXAM_APPROVED──▶ Oracle  → sets up analytics funnels
        └──EXAM_APPROVED──▶ Mentor  → configures nudge rules

Atlas generates content
        └──CONTENT_READY──▶ Sage   → verifies accuracy

Sage verifies
        ├──CONTENT_VERIFIED──▶ Forge  → deploy to CDN
        └──CONTENT_VERIFIED──▶ Herald → prepare promotion

Forge deploys
        ├──EXAM_DEPLOYED──▶ Oracle  → start tracking
        ├──EXAM_DEPLOYED──▶ Herald  → launch campaigns
        ├──EXAM_DEPLOYED──▶ Mentor  → begin student onboarding
        └──DEPLOY_METRICS──▶ Scout  → monitor SEO rankings

Herald launches campaigns
        ├──MARKETING_LIVE──▶ Oracle      → track CTR/conversions
        └──KEYWORD_OPPORTUNITY──▶ Herald (self-loop via Scout)

First student enrolls
        └──STUDENT_ENROLLED──▶ Mentor + Sage + Oracle  [phase → LIVE]

Steady state feedback loops (weekly / continuous):
        Oracle──PERFORMANCE_INSIGHT──▶ Scout + Atlas + Mentor
        Oracle──CAMPAIGN_PERFORMANCE──▶ Herald
        Oracle──CONTENT_STALE──▶ Atlas
        Oracle──CHURN_RISK──▶ Mentor
        Scout──TREND_SIGNAL──▶ Atlas
        Scout──KEYWORD_OPPORTUNITY──▶ Herald
        Atlas──CONTENT_PUBLISHED──▶ Oracle
        Herald──CAMPAIGN_RESULT──▶ Scout
        Mentor──STUDENT_STRUGGLING──▶ Sage
        Mentor──ENGAGEMENT_GAP──▶ Atlas
        Sage──CONTENT_GAP──▶ Atlas
```

---

## How to Add a New Signal

1. **Add type to `AgentSignal.type` union** in `persistenceDB.ts`
2. **Add an `emit*()` function** in `signalBus.ts`
3. **Add a `case` handler** in `processFeedbackLoop()` in `examOrchestrator.ts`
4. **Update this document** — add the signal to the catalogue and matrix
5. **Update the agent's inbox processor** if it needs to process this signal type

---

## Files Reference

| File | Purpose |
|------|---------|
| `services/persistenceDB.ts` | `AgentSignal` interface + type union; IndexedDB `enqueueSignal` / `drainPendingSignals` |
| `services/signalBus.ts` | All `emit*()` functions; inbox processors per agent |
| `services/examOrchestrator.ts` | `triggerExamApproval()`, `processAgentInbox()`, `processFeedbackLoop()` — routes all lifecycle signals |
| `services/examCreationWorkflow.ts` | 27-step wizard workflow definition (leads to `triggerExamApproval` on completion) |
| `components/ExamLifecycleDashboard.tsx` | CEO real-time view of all active exam lifecycles and agent status |
