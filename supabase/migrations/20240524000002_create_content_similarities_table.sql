-- Create content_similarities table to store relationships between content items
CREATE TABLE IF NOT EXISTS content_similarities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  source_id TEXT NOT NULL REFERENCES content(id) ON DELETE CASCADE,
  target_id TEXT NOT NULL REFERENCES content(id) ON DELETE CASCADE,
  similarity_score NUMERIC NOT NULL DEFAULT 0.5 CHECK (similarity_score >= 0 AND similarity_score <= 1),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT unique_content_similarity UNIQUE (source_id, target_id)
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS content_similarities_source_id_idx ON content_similarities (source_id);
CREATE INDEX IF NOT EXISTS content_similarities_target_id_idx ON content_similarities (target_id);
CREATE INDEX IF NOT EXISTS content_similarities_score_idx ON content_similarities (similarity_score DESC);

-- Enable row level security
ALTER TABLE content_similarities ENABLE ROW LEVEL SECURITY;

-- Create policy for public read access
DROP POLICY IF EXISTS "Public read access" ON content_similarities;
CREATE POLICY "Public read access"
  ON content_similarities FOR SELECT
  USING (true);

-- Create policy for authenticated users to insert/update
DROP POLICY IF EXISTS "Authenticated users can insert and update" ON content_similarities;
CREATE POLICY "Authenticated users can insert and update"
  ON content_similarities FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- Enable realtime
alter publication supabase_realtime add table content_similarities;
