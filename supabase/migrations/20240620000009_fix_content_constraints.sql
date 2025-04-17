-- Add unique constraint on imdb_id to prevent duplicates
ALTER TABLE content ADD CONSTRAINT unique_imdb_id UNIQUE (imdb_id);

-- Add index on title for faster lookups
CREATE INDEX IF NOT EXISTS idx_content_title ON content (title);

-- Create a function to check for existing content
CREATE OR REPLACE FUNCTION check_content_exists(p_imdb_id TEXT) RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (SELECT 1 FROM content WHERE imdb_id = p_imdb_id);
END;
$$ LANGUAGE plpgsql;
