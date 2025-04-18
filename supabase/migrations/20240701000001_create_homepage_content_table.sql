-- Create homepage_content table to curate content for the homepage
CREATE TABLE IF NOT EXISTS homepage_content (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  content_id TEXT NOT NULL REFERENCES content(id),
  "order" INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index on content_id for faster lookups
CREATE INDEX IF NOT EXISTS homepage_content_content_id_idx ON homepage_content(content_id);

-- Create index on order for faster sorting
CREATE INDEX IF NOT EXISTS homepage_content_order_idx ON homepage_content("order");

-- Enable row level security
ALTER TABLE homepage_content ENABLE ROW LEVEL SECURITY;

-- Create policy to allow anyone to read homepage content
DROP POLICY IF EXISTS "Anyone can read homepage content" ON homepage_content;
CREATE POLICY "Anyone can read homepage content"
  ON homepage_content
  FOR SELECT
  USING (true);

-- Create policy to allow only admins to modify homepage content
DROP POLICY IF EXISTS "Only admins can modify homepage content" ON homepage_content;
CREATE POLICY "Only admins can modify homepage content"
  ON homepage_content
  FOR ALL
  USING (auth.uid() IN (SELECT id FROM users WHERE role = 'admin'));

-- Add the table to realtime publication
alter publication supabase_realtime add table homepage_content;
