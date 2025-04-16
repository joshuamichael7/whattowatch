-- Enable Row Level Security on the content_similarities table
ALTER TABLE content_similarities ENABLE ROW LEVEL SECURITY;

-- Create policy for public read access to content_similarities
DROP POLICY IF EXISTS "Content similarities are viewable by everyone" ON content_similarities;
CREATE POLICY "Content similarities are viewable by everyone"
ON content_similarities FOR SELECT
USING (true);

-- Create policy for service role to have full access
DROP POLICY IF EXISTS "Service role has full access to content_similarities" ON content_similarities;
CREATE POLICY "Service role has full access to content_similarities"
ON content_similarities FOR ALL
USING (auth.role() = 'service_role');

-- Add indexes to frequently queried fields
CREATE INDEX IF NOT EXISTS idx_content_similarities_source_id ON content_similarities (source_id);
CREATE INDEX IF NOT EXISTS idx_content_similarities_target_id ON content_similarities (target_id);
CREATE INDEX IF NOT EXISTS idx_content_similarities_score ON content_similarities (similarity_score);
CREATE INDEX IF NOT EXISTS idx_content_similarities_source_target ON content_similarities (source_id, target_id);
