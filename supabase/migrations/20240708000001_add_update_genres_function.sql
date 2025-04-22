-- Create a function to update content genres
CREATE OR REPLACE FUNCTION update_content_genres(p_id UUID, p_genre_strings TEXT[], p_genre_ids INTEGER[])
RETURNS VOID AS $$
BEGIN
  UPDATE content
  SET 
    genre_strings = p_genre_strings,
    genre_ids = p_genre_ids,
    updated_at = NOW()
  WHERE id = p_id;
  
  -- Log the update for debugging
  RAISE NOTICE 'Updated genres for content %: genres %, ids %', 
    p_id, p_genre_strings, p_genre_ids;
 END;
$$ LANGUAGE plpgsql;
