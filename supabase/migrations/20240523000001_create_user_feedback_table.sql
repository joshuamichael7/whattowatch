-- Create a table to store user feedback on content recommendations
CREATE TABLE IF NOT EXISTS user_feedback (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT NOT NULL,
  content_id TEXT NOT NULL,
  source_content_id TEXT,
  is_positive BOOLEAN NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create an index for faster queries
CREATE INDEX IF NOT EXISTS idx_user_feedback_content_id ON user_feedback(content_id);
CREATE INDEX IF NOT EXISTS idx_user_feedback_source_content_id ON user_feedback(source_content_id);
CREATE INDEX IF NOT EXISTS idx_user_feedback_user_id ON user_feedback(user_id);

-- Add RLS (Row Level Security) policies if needed
ALTER TABLE user_feedback ENABLE ROW LEVEL SECURITY;

-- Example policy that allows anyone to insert but only the same user to read their own feedback
CREATE POLICY "Anyone can insert feedback" ON user_feedback FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can read their own feedback" ON user_feedback FOR SELECT USING (auth.uid()::text = user_id);