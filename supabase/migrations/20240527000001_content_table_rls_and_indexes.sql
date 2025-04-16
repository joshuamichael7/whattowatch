-- Enable Row Level Security on the content table
ALTER TABLE content ENABLE ROW LEVEL SECURITY;

-- Create policy for public read access to content
DROP POLICY IF EXISTS "Content is viewable by everyone" ON content;
CREATE POLICY "Content is viewable by everyone"
ON content FOR SELECT
USING (true);

-- Create policy for service role to have full access
DROP POLICY IF EXISTS "Service role has full access to content" ON content;
CREATE POLICY "Service role has full access to content"
ON content FOR ALL
USING (auth.role() = 'service_role');

-- Add indexes to frequently queried fields
CREATE INDEX IF NOT EXISTS idx_content_title ON content (title);
CREATE INDEX IF NOT EXISTS idx_content_media_type ON content (media_type);
CREATE INDEX IF NOT EXISTS idx_content_release_date ON content (release_date);
CREATE INDEX IF NOT EXISTS idx_content_popularity ON content (popularity);
CREATE INDEX IF NOT EXISTS idx_content_genre_strings ON content USING GIN (genre_strings);
