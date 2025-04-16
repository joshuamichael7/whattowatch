-- Create recommendations table to cache personalized recommendations
CREATE TABLE IF NOT EXISTS recommendations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL,
  content_id TEXT NOT NULL,
  score FLOAT NOT NULL,
  recommendation_type VARCHAR(50) NOT NULL,
  source_content_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (content_id) REFERENCES content(id) ON DELETE CASCADE,
  FOREIGN KEY (source_content_id) REFERENCES content(id) ON DELETE SET NULL
);

-- Create index on user_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_recommendations_user_id ON recommendations(user_id);

-- Create index on content_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_recommendations_content_id ON recommendations(content_id);

-- Create index on recommendation_type for filtering
CREATE INDEX IF NOT EXISTS idx_recommendations_type ON recommendations(recommendation_type);

-- Create index on expires_at for cleaning up expired recommendations
CREATE INDEX IF NOT EXISTS idx_recommendations_expires_at ON recommendations(expires_at);

-- Enable row level security
ALTER TABLE recommendations ENABLE ROW LEVEL SECURITY;

-- Create policy to allow users to view only their own recommendations
DROP POLICY IF EXISTS "Users can view their own recommendations" ON recommendations;
CREATE POLICY "Users can view their own recommendations"
ON recommendations FOR SELECT
USING (auth.uid() = user_id);

-- Create policy to allow service role to manage all recommendations
DROP POLICY IF EXISTS "Service role can manage all recommendations" ON recommendations;
CREATE POLICY "Service role can manage all recommendations"
ON recommendations FOR ALL
USING (auth.role() = 'service_role');

-- Add to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE recommendations;