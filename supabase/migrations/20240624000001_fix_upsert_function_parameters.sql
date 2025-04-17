-- Drop the existing function first
DROP FUNCTION IF EXISTS upsert_content(text, text, text, text, text, text, text, text, text, integer, text[], text, text, text, numeric);

-- Recreate the function with the correct parameter defaults
CREATE OR REPLACE FUNCTION upsert_content(
  p_id TEXT,
  p_title TEXT,
  p_media_type TEXT,
  p_imdb_id TEXT DEFAULT NULL,
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
DECLARE
  v_exists BOOLEAN;
  v_id TEXT;
BEGIN
  -- Check if content with this imdb_id already exists
  SELECT EXISTS (
    SELECT 1 FROM content WHERE imdb_id = p_imdb_id
  ) INTO v_exists;
  
  IF v_exists THEN
    -- Update existing record
    UPDATE content SET
      title = COALESCE(p_title, title),
      media_type = COALESCE(p_media_type, media_type),
      year = COALESCE(p_year, year),
      poster_path = COALESCE(p_poster_path, poster_path),
      overview = COALESCE(p_overview, overview),
      plot = COALESCE(p_plot, plot),
      content_rating = COALESCE(p_content_rating, content_rating),
      runtime = COALESCE(p_runtime, runtime),
      genre_strings = COALESCE(p_genre_strings, genre_strings),
      director = COALESCE(p_director, director),
      actors = COALESCE(p_actors, actors),
      imdb_rating = COALESCE(p_imdb_rating, imdb_rating),
      vote_average = COALESCE(p_vote_average, vote_average),
      updated_at = NOW()
    WHERE imdb_id = p_imdb_id;
    
    RETURN TRUE;
  ELSE
    -- Insert new record
    INSERT INTO content (
      id, title, media_type, imdb_id, year, poster_path, 
      overview, plot, content_rating, runtime, genre_strings,
      director, actors, imdb_rating, vote_average, created_at, updated_at
    ) VALUES (
      p_id, p_title, p_media_type, p_imdb_id, p_year, p_poster_path,
      p_overview, p_plot, p_content_rating, p_runtime, p_genre_strings,
      p_director, p_actors, p_imdb_rating, p_vote_average, NOW(), NOW()
    );
    
    RETURN TRUE;
  END IF;
  
EXCEPTION WHEN unique_violation THEN
  -- Handle unique constraint violation gracefully
  RETURN FALSE;
END;
$$ LANGUAGE plpgsql;
