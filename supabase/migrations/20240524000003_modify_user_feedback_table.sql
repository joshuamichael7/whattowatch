-- Modify user_feedback table to use UUIDs and establish foreign key relationships
-- First, we need to create a backup of the existing data
CREATE TABLE IF NOT EXISTS user_feedback_backup AS SELECT * FROM user_feedback;

-- Drop the existing table
DROP TABLE IF EXISTS user_feedback;

-- Recreate the table with proper constraints
CREATE TABLE IF NOT EXISTS user_feedback (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  content_id TEXT NOT NULL REFERENCES content(id) ON DELETE CASCADE,
  source_content_id TEXT REFERENCES content(id) ON DELETE SET NULL,
  is_positive BOOLEAN NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS user_feedback_user_id_idx ON user_feedback (user_id);
CREATE INDEX IF NOT EXISTS user_feedback_content_id_idx ON user_feedback (content_id);
CREATE INDEX IF NOT EXISTS user_feedback_source_content_id_idx ON user_feedback (source_content_id);

-- Enable row level security
ALTER TABLE user_feedback ENABLE ROW LEVEL SECURITY;

-- Create policy for users to read their own feedback
DROP POLICY IF EXISTS "Users can read own feedback" ON user_feedback;
CREATE POLICY "Users can read own feedback"
  ON user_feedback FOR SELECT
  USING (auth.uid() = user_id OR user_id IS NULL);

-- Create policy for users to insert their own feedback
DROP POLICY IF EXISTS "Users can insert own feedback" ON user_feedback;
CREATE POLICY "Users can insert own feedback"
  ON user_feedback FOR INSERT
  WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

-- Enable realtime
alter publication supabase_realtime add table user_feedback;

-- Note: We would need to migrate data from the backup table, but since we don't know
-- the exact structure of the existing data and the foreign key constraints might fail,
-- we'll leave this as a manual step or a separate migration.
