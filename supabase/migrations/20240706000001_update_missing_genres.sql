-- Find all content records that have missing genre information
CREATE OR REPLACE FUNCTION find_content_without_genres()
RETURNS TABLE (
  id TEXT,
  title TEXT,
  imdb_id TEXT,
  media_type TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT c.id, c.title, c.imdb_id, c.media_type
  FROM content c
  WHERE 
    (c.genre_strings IS NULL OR 
     c.genre_strings = '{}' OR 
     array_length(c.genre_strings, 1) IS NULL) AND
    c.imdb_id IS NOT NULL;
END;
$$ LANGUAGE plpgsql;

-- Create a function to update genre information for a specific content item
CREATE OR REPLACE FUNCTION update_content_genres(
  p_id TEXT,
  p_genre_strings TEXT[],
  p_genre_ids INTEGER[]
)
RETURNS VOID AS $$
BEGIN
  UPDATE content
  SET 
    genre_strings = p_genre_strings,
    genre_ids = p_genre_ids,
    updated_at = NOW()
  WHERE id = p_id;
END;
$$ LANGUAGE plpgsql;

-- Example query to get all content without genres
-- SELECT * FROM find_content_without_genres();

-- Enable realtime for content table if not already enabled
ALTER PUBLICATION supabase_realtime ADD TABLE content;
