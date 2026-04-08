-- Migration 007: Study Commander
-- Adds study profiles (onboarding + diagnostic) and daily plans for the priority engine.

CREATE TABLE IF NOT EXISTS study_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT NOT NULL UNIQUE,
  user_id UUID REFERENCES auth.users(id),
  exam_date DATE NOT NULL,
  target_score INTEGER,
  weekly_hours INTEGER DEFAULT 10,
  topic_confidence JSONB NOT NULL,       -- {"linear-algebra": 3, "probability-statistics": 1, ...}
  diagnostic_scores JSONB DEFAULT '[]',  -- [{scores: {...}, taken_at: "..."}] append-only
  diagnostic_taken_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS daily_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id),
  plan_date DATE NOT NULL,
  tasks JSONB NOT NULL,       -- [{type: "practice", topic: "probability-statistics", reason: "...", est_min: 30}, ...]
  completed JSONB DEFAULT '[]', -- [{task_idx: 0, rating: "hard", completed_at: "..."}]
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(session_id, plan_date)
);

CREATE INDEX IF NOT EXISTS idx_study_profiles_user ON study_profiles(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_daily_plans_session ON daily_plans(session_id);
CREATE INDEX IF NOT EXISTS idx_daily_plans_user ON daily_plans(user_id) WHERE user_id IS NOT NULL;
