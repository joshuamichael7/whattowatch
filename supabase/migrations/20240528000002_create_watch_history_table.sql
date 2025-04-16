-- Create watch_history table to track what users have watched
CREATE TABLE IF NOT EXISTS watch_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL,
  content_id TEXT NOT NULL,
  watched_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  progress_percentage SMALLINT DEFAULT 100,
  rating SMALLINT,
  CONSTRAINT fk_user_id FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT fk_content_id FOREIGN KEY (content_id) REFERENCES content(id) ON DELETE CASCADE
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_watch_history_user_id ON watch_history(user_id);
CREATE INDEX IF NOT EXISTS idx_watch_history_content_id ON watch_history(content_id);
CREATE INDEX IF NOT EXISTS idx_watch_history_watched_at ON watch_history(watched_at);

-- Enable Row Level Security
ALTER TABLE watch_history ENABLE ROW LEVEL SECURITY;

-- Create policies
-- Users can only view their own watch history
DROP POLICY IF EXISTS "Users can view their own watch history" ON watch_history;
CREATE POLICY "Users can view their own watch history"
  ON watch_history FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert into their own watch history
DROP POLICY IF EXISTS "Users can insert into their own watch history" ON watch_history;
CREATE POLICY "Users can insert into their own watch history"
  ON watch_history FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own watch history
DROP POLICY IF EXISTS "Users can update their own watch history" ON watch_history;
CREATE POLICY "Users can update their own watch history"
  ON watch_history FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can delete from their own watch history
DROP POLICY IF EXISTS "Users can delete from their own watch history" ON watch_history;
CREATE POLICY "Users can delete from their own watch history"
  ON watch_history FOR DELETE
  USING (auth.uid() = user_id);
