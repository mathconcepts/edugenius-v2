# SKILLS.md — Agent Capabilities, Sub-Agents & Triggers

*Complete technical specification of what each agent (and sub-agent) can do.*

---

## Overview

The EduGenius system operates as a **3-level hierarchy**:

```
LEVEL 1: Lead (Jarvis)
    └── Orchestration, routing, escalation

LEVEL 2: Domain Agents (6 primary)
    ├── Scout (Market Intelligence)
    ├── Atlas (Content Engine)
    ├── Sage (Personalization)
    ├── Mentor (Teacher Success)
    ├── Herald (Marketing)
    └── Forge (DevOps)
    
LEVEL 3: Sub-Agents (28 specialized workers)
    └── Specific, atomic tasks within each domain
    
OBSERVER: Oracle (Analytics)
    └── Monitors all agents, reports insights
```

---

## LEVEL 1: JARVIS (Lead Orchestrator)

### Core Capabilities

| Capability | Description | Autonomy |
|------------|-------------|----------|
| Route requests | Direct queries to appropriate agent | Full |
| Model selection | Choose Flash vs Pro based on context | Full |
| Cost optimization | Budget management, degradation | Full |
| Quality gate | Auto-approve content > 0.85 | Full |
| Cross-agent synthesis | Combine outputs | Full |
| Escalation | Route to CEO | On-trigger |

### Triggers

| Trigger | Source | Action |
|---------|--------|--------|
| `exam.approved` | CEO | Initiate launch workflow |
| `content.ready` | Atlas | Route to Forge + Herald |
| `anomaly.critical` | Oracle | Escalate to CEO |
| `budget.exceeded` | Oracle | Pause non-critical, alert |
| `agent.blocked` | Any | Unblock or escalate |

### Decision Matrix

| Scenario | Jarvis Decides | CEO Decides |
|----------|---------------|-------------|
| New exam opportunity | No | Yes |
| Content quality > 0.85 | Approve | - |
| Content quality 0.70-0.85 | - | Review |
| Production deploy (auto) | Yes | - |
| Production deploy (manual) | - | Approve |
| Budget < 80% | Manage | - |
| Budget > 80% | Alert | Decide |
| Security incident | Alert | Respond |

### Heartbeat: Every 15 minutes

---

## LEVEL 2: DOMAIN AGENTS

---

### 🔍 SCOUT — Market Intelligence

**Primary Capabilities:**
- Trend analysis (Google Trends API)
- Competitor tracking (pricing, features, reviews)
- Demand forecasting (search volume)
- Niche scoring algorithm
- Gap analysis

**Heartbeat:** Every 4 hours

#### Sub-Agents

| Sub-Agent | Purpose | Trigger | Model | Token Limit |
|-----------|---------|---------|-------|-------------|
| `scout-trends` | Google Trends monitoring | Daily 00:00 UTC | Flash | 5K |
| `scout-competitor` | Competitor deep dive | Weekly Sunday | Flash | 10K |
| `scout-demand` | Search volume analysis | On-demand | Flash | 3K |
| `scout-niche` | Niche scoring | On opportunity | Pro | 5K |
| `scout-pricing` | Price scraping | Weekly + alerts | Flash | 3K |

#### Trigger Specifications

```yaml
scout-trends:
  schedule: "0 0 * * *"  # Daily midnight UTC
  input: 
    - keywords: [exam names, topic trending]
    - geo: [IN, US]
    - timeframe: "last_30_days"
  output:
    - trend_report → Scout
    - anomalies → Oracle

scout-competitor:
  schedule: "0 0 * * 0"  # Weekly Sunday
  input:
    - competitor_list: [Unacademy, Byju's, Khan Academy]
    - check: [pricing, features, reviews]
  output:
    - competitor_diff → Scout
    - alerts → Jarvis (if major change)

scout-niche:
  trigger: opportunity_detected
  input:
    - exam: string
    - market_data: from scout-trends
    - demand_data: from scout-demand
  output:
    - niche_score: 1-5
    - recommendation: GO | HOLD | SKIP
    - roi_estimate: number
```

#### API Connections

| API | Purpose | Rate Limit |
|-----|---------|------------|
| Google Trends | Trend data | 10 req/min |
| SimilarWeb | Traffic estimates | 100 req/day |
| App Store | Review scraping | 50 req/hour |
| Play Store | Review scraping | 50 req/hour |

---

### 📚 ATLAS — Content Engine

**Primary Capabilities:**
- Syllabus extraction (PDF, web scraping)
- Content generation (Gemini Pro)
- Math computation (Wolfram API)
- Quality scoring (pedagogical)
- RAG indexing (embeddings)
- Version control

**Heartbeat:** Every 30 minutes

#### Sub-Agents

| Sub-Agent | Purpose | Trigger | Model | Token Limit |
|-----------|---------|---------|-------|-------------|
| `atlas-scraper` | Syllabus extraction | On new exam | Flash | 8K |
| `atlas-generator` | Content generation | Batch queue | Pro | 20K |
| `atlas-wolfram` | Math computation | On math content | Flash+API | 5K |
| `atlas-qa` | Quality scoring | On content | Flash | 3K |
| `atlas-multimodal` | Video/interactive | On approval | Pro | 15K |
| `atlas-indexer` | RAG embedding | On content | Flash | 2K |
| `atlas-versioner` | Version tracking | On change | Flash | 1K |

#### Trigger Specifications

```yaml
atlas-scraper:
  trigger: exam.approved
  input:
    - exam_id: string
    - syllabus_sources: [urls, pdfs]
  process:
    - extract_text()
    - identify_topics()
    - build_hierarchy()
    - map_prerequisites()
  output:
    - structured_syllabus → Atlas
    - topic_count → Oracle

atlas-generator:
  trigger: batch_queue OR content_gap
  input:
    - topics: list
    - difficulty_levels: [1, 2, 3]
    - content_types: [explanation, example, problem]
  process:
    - for each topic:
        - generate_explanation(3_levels)
        - generate_examples(5)
        - generate_problems(10)
        - generate_mistakes_guide()
  output:
    - content_batch → atlas-qa
    - progress → Oracle

atlas-qa:
  trigger: content_generated
  input:
    - content_items: list
    - quality_criteria: [accuracy, clarity, pedagogy]
  process:
    - score_accuracy()
    - score_clarity()
    - score_pedagogy()
    - aggregate_score()
  output:
    - if score > 0.85: approved → atlas-indexer
    - if score 0.70-0.85: needs_review → Jarvis
    - if score < 0.70: regenerate → atlas-generator

atlas-wolfram:
  trigger: math_content_needed
  input:
    - expression: string
    - operation: solve | compute | verify
  process:
    - call_wolfram_api()
    - format_result()
  output:
    - computed_result → requesting_subagent
```

#### Content Pipeline Flow

```
1. atlas-scraper → Syllabus structure
2. atlas-generator → Raw content (parallel workers)
3. atlas-wolfram → Math verification (as needed)
4. atlas-qa → Quality scoring
5. [If approved] atlas-multimodal → Supporting media
6. atlas-indexer → RAG embedding
7. atlas-versioner → Version record
8. Atlas → Notify Jarvis + Forge
```

#### API Connections

| API | Purpose | Rate Limit |
|-----|---------|------------|
| Wolfram Alpha | Math computation | 2000 req/month |
| OpenAI Embeddings | RAG indexing | 3000 req/min |
| YouTube Data | Video metadata | 10000 req/day |

---

### 🎯 SAGE — Personalization & AI Tutor

**Primary Capabilities:**
- Socratic tutoring (conversational AI)
- Learning style detection (VAKT)
- Mastery tracking (per topic, per student)
- Adaptive path optimization
- Frustration detection
- Assessment generation
- Re-engagement triggers

**Heartbeat:** Continuous (event-driven)

#### Sub-Agents

| Sub-Agent | Purpose | Trigger | Model | Token Limit |
|-----------|---------|---------|-------|-------------|
| `sage-tutor` | AI tutoring | Student query | Pro/Flash* | 8K |
| `sage-assessor` | Question generation | On-demand | Pro | 5K |
| `sage-style` | Learning style | On signup | Flash | 3K |
| `sage-path` | Path optimization | On mastery change | Flash | 3K |
| `sage-mastery` | Mastery tracking | Every interaction | Flash | 1K |
| `sage-engagement` | Re-engagement | On inactivity | Flash | 2K |
| `sage-churn` | Churn prediction | Daily batch | Flash | 5K batch |

*sage-tutor: Pro on first query per topic, Flash on follow-ups

#### Trigger Specifications

```yaml
sage-tutor:
  trigger: student.query
  input:
    - student_id: string
    - query: string
    - context: conversation_history
    - mastery: current_mastery_state
  process:
    - retrieve_rag_context()
    - select_model(first_query: Pro, followup: Flash)
    - generate_socratic_response()
    - detect_frustration()
    - update_mastery()
  output:
    - response → Student
    - mastery_delta → sage-mastery

sage-style:
  trigger: student.signup
  input:
    - student_id: string
    - initial_interactions: list
  process:
    - analyze_interaction_patterns()
    - classify_vakt()
    - set_initial_preferences()
  output:
    - learning_profile → Sage
    - style → Oracle

sage-churn:
  trigger: schedule (daily 04:00 UTC)
  input:
    - all_students: list
    - engagement_metrics: last_30_days
    - mastery_trends: last_30_days
  process:
    - extract_features()
    - run_ml_model()
    - rank_by_risk()
  output:
    - high_risk_students → sage-engagement
    - risk_scores → Oracle

sage-engagement:
  trigger: inactivity.3_days OR churn_risk.high
  input:
    - student_id: string
    - last_activity: timestamp
    - mastery_state: object
  process:
    - select_reengagement_strategy()
    - generate_personalized_message()
    - identify_easy_win_topic()
  output:
    - notification → Student (WhatsApp/Telegram/Email)
    - engagement_attempt → Oracle
```

#### Personalization Dimensions

| Dimension | Detection Method | Adaptation |
|-----------|-----------------|------------|
| Mastery | Assessment scores | Content difficulty |
| Learning style (VAKT) | Interaction analysis | Modality preference |
| Pace | Response times | Content density |
| Emotional state | Frustration signals | Tone, simplification |
| Exam mode | User preference | Mastery vs Speed |
| Language | User preference | Vernacular (Hinglish) |

#### Frustration Signals

| Signal | Indicator | Response |
|--------|-----------|----------|
| Repeated wrong answers | >3 on same concept | Simplify, encourage |
| Long pauses | >60s between messages | Prompt, offer hint |
| Negative language | "I don't get it" | Empathize, alternate |
| Session abandonment | Mid-question exit | Re-engagement |

---

### 🎓 MENTOR — Teacher Success

**Primary Capabilities:**
- Class analytics (mastery heatmaps)
- At-risk student detection
- Lesson plan generation
- Worksheet creation
- Parent report generation
- Teacher upskilling

**Heartbeat:** Every 2 hours

#### Sub-Agents

| Sub-Agent | Purpose | Trigger | Model | Token Limit |
|-----------|---------|---------|-------|-------------|
| `mentor-analytics` | Class performance | Daily 06:00 UTC | Flash | 5K |
| `mentor-alerts` | At-risk detection | On mastery drop | Flash | 2K |
| `mentor-content` | Teaching materials | On request | Pro | 10K |
| `mentor-reports` | Parent reports | On request | Flash | 5K |
| `mentor-upskill` | Training suggestions | Weekly | Flash | 3K |
| `mentor-planner` | Lesson plans | On request | Pro | 8K |

#### Trigger Specifications

```yaml
mentor-analytics:
  trigger: schedule (daily 06:00 UTC)
  input:
    - class_id: string
    - student_mastery: aggregated
    - topic_coverage: percentages
  process:
    - compute_class_average()
    - generate_heatmap()
    - identify_trends()
    - prepare_dashboard()
  output:
    - dashboard → Teacher
    - metrics → Oracle

mentor-alerts:
  trigger: student.mastery_drop > 20%
  input:
    - student_id: string
    - mastery_before: object
    - mastery_after: object
    - recent_activity: list
  process:
    - analyze_drop_cause()
    - generate_alert()
    - suggest_intervention()
  output:
    - alert → Teacher
    - notification → Sage (for coordination)

mentor-planner:
  trigger: teacher.request
  input:
    - topic: string
    - duration_minutes: number
    - class_profile: object
    - learning_objectives: list
  process:
    - structure_lesson()
    - add_warmup()
    - add_concept_delivery()
    - add_worked_examples()
    - add_practice()
    - add_wrapup()
  output:
    - lesson_plan → Teacher
    - supporting_content → from Atlas
```

---

### 📣 HERALD — Marketing & Growth

**Primary Capabilities:**
- Landing page generation
- Blog content creation
- Social media repurposing
- SEO optimization
- Email sequences
- Campaign scheduling
- Retargeting

**Heartbeat:** Every 2 hours

#### Sub-Agents

| Sub-Agent | Purpose | Trigger | Model | Token Limit |
|-----------|---------|---------|-------|-------------|
| `herald-acquisition` | Top-of-funnel content | On trigger | Pro | 15K |
| `herald-seo` | SEO optimization | On publish | Flash | 3K |
| `herald-social` | Social repurposing | On blog publish | Flash | 5K |
| `herald-email` | Email sequences | On user event | Flash | 3K |
| `herald-calendar` | Content scheduling | Weekly planning | Flash | 5K |
| `herald-landing` | Landing page gen | On new exam | Pro | 20K |
| `herald-retarget` | Churned user campaigns | On churn event | Flash | 3K |

#### Trigger Specifications

```yaml
herald-landing:
  trigger: exam.content_80_percent
  input:
    - exam_id: string
    - key_topics: list
    - competitor_data: from Scout
    - testimonials: from Sage
  process:
    - generate_hero_copy()
    - create_feature_sections()
    - add_social_proof()
    - optimize_ctas()
    - add_seo_meta()
  output:
    - landing_page_html → Forge for deploy
    - page_config → Oracle

herald-acquisition:
  trigger: content_strategy.blog_needed
  input:
    - topic: string
    - intent: viral_hook | deep_dive | comparison
    - keywords: from scout-demand
  process:
    - research_topic()
    - outline_structure()
    - write_draft()
    - add_visuals()
    - optimize_seo()
  output:
    - blog_post → herald-calendar
    - social_variants → herald-social

herald-social:
  trigger: blog.published
  input:
    - blog_id: string
    - blog_content: string
    - target_platforms: [twitter, linkedin, instagram]
  process:
    - for each platform:
        - adapt_format()
        - optimize_for_platform()
        - schedule()
  output:
    - scheduled_posts → calendar
    - metrics → Oracle
```

#### Content Calendar Structure

```yaml
weekly_schedule:
  monday: 
    - blog: deep_dive
    - social: 3 posts
  wednesday:
    - blog: viral_hook
    - social: 3 posts
  friday:
    - blog: tips_list OR comparison
    - social: 3 posts
  daily:
    - email: based on triggers
    - retargeting: based on churn
```

---

### ⚙️ FORGE — Infrastructure & DevOps

**Primary Capabilities:**
- CI/CD pipeline management
- Staging/production deployment
- Health monitoring
- Auto-rollback
- Security scanning
- Cost tracking

**Heartbeat:** Continuous monitoring

#### Sub-Agents

| Sub-Agent | Purpose | Trigger | Model | Token Limit |
|-----------|---------|---------|-------|-------------|
| `forge-build` | Build process | On commit | N/A | N/A |
| `forge-test` | Automated testing | On build | N/A | N/A |
| `forge-deploy` | Deployment | On test pass | N/A | N/A |
| `forge-monitor` | Health checks | Continuous | N/A | N/A |
| `forge-security` | Security scans | On deploy + weekly | N/A | N/A |
| `forge-rollback` | Rollback execution | On error spike | N/A | N/A |
| `forge-cost` | Cost tracking | Daily | N/A | N/A |

#### Pipeline Specification

```yaml
forge-build:
  trigger: github.push OR content.deploy_ready
  steps:
    - pull_latest()
    - install_dependencies()
    - run_build()
    - generate_artifacts()
  output:
    - build_artifact → forge-test
    - build_status → Oracle

forge-test:
  trigger: build.complete
  steps:
    - run_unit_tests()
    - run_integration_tests()
    - run_e2e_tests() # Playwright
    - run_accessibility_tests()
    - run_performance_tests() # Lighthouse
  output:
    - test_results → forge-deploy (if pass)
    - test_results → Jarvis (if fail)

forge-deploy:
  trigger: tests.pass
  config:
    auto_deploy_staging: true
    auto_deploy_prod: configurable # default: false
    deployment_strategy: blue_green
  steps:
    - deploy_to_staging()
    - run_smoke_tests()
    - [if auto_prod OR ceo_approve]: deploy_to_prod()
    - warm_caches()
    - notify_all_agents()
  output:
    - deploy_status → Jarvis
    - deploy_metrics → Oracle

forge-monitor:
  trigger: continuous
  checks:
    - error_rate: every 1 min
    - latency_p99: every 1 min
    - cpu_memory: every 5 min
    - api_health: every 1 min
  thresholds:
    error_rate_warn: 2%
    error_rate_critical: 5%
    latency_warn: 500ms
    latency_critical: 2000ms
  actions:
    warn: alert → Jarvis
    critical: auto_rollback → forge-rollback

forge-rollback:
  trigger: error_rate > 5% OR manual
  steps:
    - identify_last_good_version()
    - execute_rollback()
    - verify_health()
    - notify_jarvis()
  output:
    - rollback_status → Jarvis → CEO
```

---

### 📊 ORACLE — Analytics & Review

**Primary Capabilities:**
- Metric aggregation
- Anomaly detection
- Churn prediction
- A/B test analysis
- Revenue tracking
- Report generation

**Heartbeat:** Continuous observation

#### Sub-Agents

| Sub-Agent | Purpose | Trigger | Model | Token Limit |
|-----------|---------|---------|-------|-------------|
| `oracle-metrics` | Data aggregation | Continuous | N/A | N/A |
| `oracle-anomaly` | Anomaly detection | On metric | Flash | 2K |
| `oracle-churn` | Churn model | Daily batch | Flash | 10K batch |
| `oracle-report` | Report generation | Scheduled | Pro | 8K |
| `oracle-ab` | A/B analysis | On test complete | Flash | 5K |
| `oracle-revenue` | Financial tracking | Continuous | N/A | N/A |

#### Metrics Tracked

| Category | Metrics | Granularity |
|----------|---------|-------------|
| Users | DAU, WAU, MAU, signups, churn | Daily |
| Revenue | MRR, LTV, CAC, ARPU | Daily |
| Engagement | Sessions, time, mastery | Hourly |
| Content | Views, completion, friction | Hourly |
| System | Errors, latency, uptime | Real-time |
| AI | Token usage, costs, model calls | Real-time |

#### Anomaly Detection Rules

```yaml
signups:
  baseline: rolling_7_day_avg
  warn: > 1.5x baseline
  alert: > 2x baseline OR < 0.5x baseline

churn:
  baseline: rolling_30_day_avg
  warn: > 1.3x baseline
  critical: > 1.5x baseline

errors:
  baseline: last_24h_avg
  warn: > 2%
  critical: > 5%

costs:
  daily_budget: $100
  warn: > 80% at 6pm UTC
  critical: > 100%
```

#### Report Templates

```yaml
daily_pulse:
  schedule: "0 8 * * *"  # 8am UTC
  channel: telegram
  metrics:
    - mrr_change
    - dau
    - signups
    - churn
    - delight_score
    - ai_cost
    - alerts_summary

weekly_review:
  schedule: "0 8 * * 0"  # Sunday 8am
  channel: email
  sections:
    - executive_summary
    - user_metrics
    - content_performance
    - marketing_attribution
    - system_health
    - recommendations

monthly_deep_dive:
  schedule: "0 8 1 * *"  # 1st of month
  channel: dashboard
  sections:
    - all_weekly_content
    - cohort_analysis
    - revenue_trends
    - competitor_comparison
    - strategic_recommendations
```

---

## CROSS-AGENT TRIGGERS

### Event → Agent Routing

| Event | Primary Handler | Also Notified |
|-------|-----------------|---------------|
| `exam.approved` | Jarvis | Scout, Atlas |
| `content.generated` | Atlas | Jarvis |
| `content.deployed` | Forge | Herald, Oracle |
| `student.signup` | Sage | Oracle |
| `student.query` | Sage | - |
| `student.inactive_3d` | Sage | - |
| `student.churn_risk` | Sage | Jarvis (if high-value) |
| `teacher.request` | Mentor | - |
| `blog.published` | Herald | Oracle |
| `deploy.completed` | Forge | All |
| `error.spike` | Forge | Jarvis |
| `anomaly.detected` | Oracle | Relevant agent |
| `budget.warning` | Oracle | Jarvis |

---

## BUDGET LIMITS

### Daily Token Allocation

| Agent | Daily Limit | Typical Usage |
|-------|-------------|---------------|
| Jarvis | 50K | 20K |
| Scout | 30K | 15K |
| Atlas | 200K | 120K |
| Sage | 300K | 200K |
| Mentor | 50K | 25K |
| Herald | 100K | 60K |
| Oracle | 50K | 20K |
| **Total** | **780K** | **~460K** |

### Cost Optimization

1. **Model Selection:** Flash default, Pro only when needed
2. **Caching:** 1-hour TTL on RAG, 24-hour on market data
3. **Batching:** Content in batches of 10, analytics hourly
4. **Degradation:** At 80% budget, Flash-only; at 95%, critical-only

---

## FAILURE HANDLING

| Failure Type | Detection | Recovery | Escalation |
|--------------|-----------|----------|------------|
| Sub-agent timeout | Parent monitors | Retry 3x | Parent agent |
| API rate limit | HTTP 429 | Exponential backoff | - |
| Quality < threshold | atlas-qa | Regenerate | Jarvis (if persists) |
| Budget exhausted | Oracle | Queue non-critical | CEO |
| Deploy failure | forge-test | Block deploy | Jarvis |
| Error spike | forge-monitor | Auto-rollback | Jarvis → CEO |

---

*This is the complete technical specification. Implementation follows this design.*
