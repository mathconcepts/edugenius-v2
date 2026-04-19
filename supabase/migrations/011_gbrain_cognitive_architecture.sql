-- GBrain Cognitive Architecture — Student Model v2 + Concept Graph
-- Migration 011: Foundation for all 6 GBrain pillars

-- ============================================================================
-- STUDENT MODEL (Layer 1) — Living profile, updates every interaction
-- ============================================================================

CREATE TABLE IF NOT EXISTS student_model (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT NOT NULL,
  user_id UUID,

  -- Academic Profile
  mastery_vector JSONB NOT NULL DEFAULT '{}',
  -- concept_id → {score: 0-1, attempts: N, correct: N, last_update: ISO}

  speed_profile JSONB NOT NULL DEFAULT '{}',
  -- topic → {avg_ms: N, by_difficulty: {easy: N, medium: N, hard: N}, samples: N}

  prerequisite_alerts JSONB NOT NULL DEFAULT '[]',
  -- [{concept, shaky_prereqs: [concept_ids], severity: 'critical'|'warning'}]

  -- Cognitive Profile
  representation_mode TEXT NOT NULL DEFAULT 'balanced'
    CHECK (representation_mode IN ('algebraic', 'geometric', 'numerical', 'balanced')),
  abstraction_comfort FLOAT NOT NULL DEFAULT 0.5
    CHECK (abstraction_comfort >= 0 AND abstraction_comfort <= 1),
  working_memory_est INT NOT NULL DEFAULT 4
    CHECK (working_memory_est >= 1 AND working_memory_est <= 8),

  -- Motivational Profile
  motivation_state TEXT NOT NULL DEFAULT 'steady'
    CHECK (motivation_state IN ('driven', 'steady', 'flagging', 'frustrated', 'anxious')),
  confidence_calibration JSONB NOT NULL DEFAULT '{"overconfident_rate": 0, "underconfident_rate": 0, "calibration_score": 0.5}',
  frustration_threshold INT NOT NULL DEFAULT 3
    CHECK (frustration_threshold >= 1 AND frustration_threshold <= 10),
  consecutive_failures INT NOT NULL DEFAULT 0,

  -- Exam Strategy
  exam_strategy JSONB NOT NULL DEFAULT '{}',
  -- {attempt_sequence: [topics], skip_threshold: 0-1, time_budget: {topic: mins},
  --  score_maximization: [{topic, current, target, expected_gain}]}

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_student_model_session UNIQUE (session_id)
);

CREATE INDEX IF NOT EXISTS idx_student_model_user ON student_model(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_student_model_session ON student_model(session_id);

-- ============================================================================
-- ERROR TAXONOMY — Classified log of every mistake
-- ============================================================================

CREATE TABLE IF NOT EXISTS error_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT NOT NULL,
  problem_id TEXT,
  concept_id TEXT NOT NULL,
  topic TEXT NOT NULL,

  -- Error classification
  error_type TEXT NOT NULL CHECK (error_type IN (
    'conceptual', 'procedural', 'notation', 'misread',
    'time_pressure', 'arithmetic', 'overconfidence_skip'
  )),
  misconception_id TEXT,
  diagnosis TEXT NOT NULL,
  why_tempting TEXT,
  why_wrong TEXT,
  corrective_hint TEXT,

  -- Context
  student_answer TEXT,
  correct_answer TEXT,
  time_taken_ms INT,
  confidence_before FLOAT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_error_log_session ON error_log(session_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_error_log_type ON error_log(session_id, error_type);
CREATE INDEX IF NOT EXISTS idx_error_log_concept ON error_log(session_id, concept_id);

-- ============================================================================
-- CONCEPT GRAPH — Static dependency structure, queried at runtime
-- ============================================================================

CREATE TABLE IF NOT EXISTS concept_graph (
  concept_id TEXT PRIMARY KEY,
  topic TEXT NOT NULL,
  label TEXT NOT NULL,
  description TEXT,
  difficulty_base FLOAT NOT NULL DEFAULT 0.5
    CHECK (difficulty_base >= 0 AND difficulty_base <= 1),
  gate_frequency TEXT DEFAULT 'medium'
    CHECK (gate_frequency IN ('high', 'medium', 'low', 'rare'))
);

CREATE TABLE IF NOT EXISTS concept_edges (
  prerequisite_id TEXT NOT NULL REFERENCES concept_graph(concept_id),
  dependent_id TEXT NOT NULL REFERENCES concept_graph(concept_id),
  strength FLOAT NOT NULL DEFAULT 1.0
    CHECK (strength >= 0 AND strength <= 1),
  PRIMARY KEY (prerequisite_id, dependent_id)
);

CREATE INDEX IF NOT EXISTS idx_concept_edges_dep ON concept_edges(dependent_id);
CREATE INDEX IF NOT EXISTS idx_concept_graph_topic ON concept_graph(topic);

-- ============================================================================
-- GENERATED PROBLEMS — Adaptive problem cache
-- ============================================================================

CREATE TABLE IF NOT EXISTS generated_problems (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  concept_id TEXT NOT NULL,
  topic TEXT NOT NULL,
  difficulty FLOAT NOT NULL CHECK (difficulty >= 0 AND difficulty <= 1),

  -- Problem content
  question_text TEXT NOT NULL,
  correct_answer TEXT NOT NULL,
  solution_steps JSONB NOT NULL DEFAULT '[]',
  distractors JSONB DEFAULT '[]',

  -- Targeting
  target_error_type TEXT,
  target_misconception TEXT,

  -- Verification
  verified BOOLEAN NOT NULL DEFAULT false,
  verification_method TEXT,
  verification_confidence FLOAT,

  -- Usage stats
  times_served INT NOT NULL DEFAULT 0,
  times_correct INT NOT NULL DEFAULT 0,
  empirical_difficulty FLOAT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gen_problems_concept ON generated_problems(concept_id, difficulty);
CREATE INDEX IF NOT EXISTS idx_gen_problems_topic ON generated_problems(topic, verified);
CREATE INDEX IF NOT EXISTS idx_gen_problems_target ON generated_problems(target_error_type) WHERE target_error_type IS NOT NULL;

-- ============================================================================
-- TASK REASONER LOG — What Layer 2 decided and why
-- ============================================================================

CREATE TABLE IF NOT EXISTS task_reasoner_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT NOT NULL,

  -- Input
  student_message TEXT NOT NULL,
  intent TEXT NOT NULL,

  -- Decision
  pedagogical_action TEXT NOT NULL,
  selected_concept TEXT,
  selected_difficulty FLOAT,
  format_instructions JSONB NOT NULL DEFAULT '{}',

  -- Reasoning
  reasoning TEXT,
  student_model_snapshot JSONB,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_task_log_session ON task_reasoner_log(session_id, created_at DESC);

-- ============================================================================
-- CONFIDENCE TRACKING — For calibration training
-- ============================================================================

CREATE TABLE IF NOT EXISTS confidence_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT NOT NULL,
  problem_id TEXT,
  concept_id TEXT,

  confidence_before FLOAT NOT NULL CHECK (confidence_before >= 0 AND confidence_before <= 1),
  was_correct BOOLEAN NOT NULL,
  time_taken_ms INT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_confidence_session ON confidence_log(session_id, created_at DESC);
