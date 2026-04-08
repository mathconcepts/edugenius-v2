-- Content Intelligence Engine
-- Adds trend tracking, content prioritization, and feedback scoring

-- Trend signals from external sources (Reddit, Stack Exchange, YouTube, NewsAPI)
CREATE TABLE IF NOT EXISTS trend_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT NOT NULL CHECK (source IN ('reddit', 'stackexchange', 'youtube', 'newsapi', 'internal')),
  topic_match TEXT,
  title TEXT NOT NULL,
  url TEXT,
  score FLOAT DEFAULT 0,
  raw_data JSONB DEFAULT '{}',
  collected_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_trend_source ON trend_signals(source, collected_at DESC);
CREATE INDEX IF NOT EXISTS idx_trend_topic ON trend_signals(topic_match) WHERE topic_match IS NOT NULL;

-- Content priorities computed from trend + internal signals
CREATE TABLE IF NOT EXISTS content_priorities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topic TEXT NOT NULL,
  content_type TEXT,
  priority_score FLOAT NOT NULL,
  signals JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_priority_score ON content_priorities(priority_score DESC);

-- Add content scoring to blog_posts
ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS content_score FLOAT DEFAULT 0;
ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS last_scored_at TIMESTAMPTZ;

-- Cleanup expired trend signals (can be run via cron)
-- DELETE FROM trend_signals WHERE expires_at < NOW();
