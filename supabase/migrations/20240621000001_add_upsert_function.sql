-- Create a function to safely insert content with conflict handling
CREATE OR REPLACE FUNCTION upsert_content(
  p_id TEXT,
  p_title TEXT,
  p_media_type TEXT,
  p_imdb_id TEXT,
  p_year TEXT DEFAULT NULL,
  p_poster_path TEXT DEFAULT NULL,
  p_overview TEXT DEFAULT NULL,
  p_plot TEXT DEFAULT NULL,
  p_content_rating TEXT DEFAULT NULL,
  p_runtime INTEGER DEFAULT NULL,
  p_genre_strings TEXT[] DEFAULT NULL,
  p_director TEXT DEFAULT NULL,
  p_actors TEXT DEFAULT NULL,
  p_imdb_rating TEXT DEFAULT NULL,
  p_vote_average NUMERIC DEFAULT NULL
) RETURNS BOOLEAN AS $$
BEGIN
  -- Try to insert the record, but if it already exists (by id or imdb_id), do nothing
  INSERT INTO content (
    id, title, media_type, imdb_id, year, poster_path, overview, plot, 
    content_rating, runtime, genre_strings, director, actors, imdb_rating, vote_average
  ) VALUES (
    p_id, p_title, p_media_type, p_imdb_id, p_year, p_poster_path, p_overview, p_plot, 
    p_content_rating, p_runtime, p_genre_strings, p_director, p_actors, p_imdb_rating, p_vote_average
  )
  ON CONFLICT (id) DO NOTHING;
  
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- Create a helper function to check if a record exists by imdb_id
CREATE OR REPLACE FUNCTION content_exists_by_imdb_id(p_imdb_id TEXT) RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (SELECT 1 FROM content WHERE imdb_id = p_imdb_id);
END;
$$ LANGUAGE plpgsql;
