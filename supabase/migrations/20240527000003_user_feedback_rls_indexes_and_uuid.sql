-- First, disable RLS on the table to remove policy dependencies
ALTER TABLE user_feedback DISABLE ROW LEVEL SECURITY;

-- Drop ALL existing policies that depend on the user_id column
DROP POLICY IF EXISTS "Users can read own feedback" ON user_feedback;
DROP POLICY IF EXISTS "Users can insert own feedback" ON user_feedback;
DROP POLICY IF EXISTS "Users can view their own feedback" ON user_feedback;
DROP POLICY IF EXISTS "Users can insert their own feedback" ON user_feedback;
DROP POLICY IF EXISTS "Service role has full access to user_feedback" ON user_feedback;

-- Create a backup of the user_feedback table before modifying it
CREATE TABLE IF NOT EXISTS user_feedback_backup AS SELECT * FROM user_feedback;

-- Drop the existing foreign key constraint if it exists
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_feedback_user_id_fkey') THEN
    ALTER TABLE user_feedback DROP CONSTRAINT user_feedback_user_id_fkey;
  END IF;
END $$;

-- Modify the user_feedback table to use UUIDs for user_id
ALTER TABLE user_feedback ALTER COLUMN user_id TYPE UUID USING NULL;

-- Add foreign key constraint to users table
ALTER TABLE user_feedback
  ADD CONSTRAINT user_feedback_user_id_fkey
  FOREIGN KEY (user_id)
  REFERENCES users(id)
  ON DELETE CASCADE;

-- Enable Row Level Security on the user_feedback table
ALTER TABLE user_feedback ENABLE ROW LEVEL SECURITY;

-- Create policy for users to read their own feedback
CREATE POLICY "Users can view their own feedback"
ON user_feedback FOR SELECT
USING (auth.uid() = user_id);

-- Create policy for users to insert their own feedback
CREATE POLICY "Users can insert their own feedback"
ON user_feedback FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Create policy for service role to have full access
CREATE POLICY "Service role has full access to user_feedback"
ON user_feedback FOR ALL
USING (auth.role() = 'service_role');

-- Add indexes to frequently queried fields
CREATE INDEX IF NOT EXISTS idx_user_feedback_user_id ON user_feedback (user_id);
CREATE INDEX IF NOT EXISTS idx_user_feedback_content_id ON user_feedback (content_id);
CREATE INDEX IF NOT EXISTS idx_user_feedback_source_content_id ON user_feedback (source_content_id);
CREATE INDEX IF NOT EXISTS idx_user_feedback_is_positive ON user_feedback (is_positive);
CREATE INDEX IF NOT EXISTS idx_user_feedback_created_at ON user_feedback (created_at);
