-- Drop the unique constraint on imdb_id if it's causing issues
ALTER TABLE content DROP CONSTRAINT IF EXISTS unique_imdb_id;

-- Create a more flexible upsert function that handles nulls better
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
BEGIN
  -- Try to insert the record, but if it already exists (by id), update it
  INSERT INTO content (
    id, title, media_type, imdb_id, year, poster_path, overview, plot, 
    content_rating, runtime, genre_strings, director, actors, imdb_rating, vote_average,
    created_at, updated_at
  ) VALUES (
    p_id, p_title, p_media_type, p_imdb_id, p_year, p_poster_path, p_overview, p_plot, 
    p_content_rating, p_runtime, p_genre_strings, p_director, p_actors, p_imdb_rating, p_vote_average,
    NOW(), NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    title = EXCLUDED.title,
    media_type = EXCLUDED.media_type,
    imdb_id = EXCLUDED.imdb_id,
    year = EXCLUDED.year,
    poster_path = EXCLUDED.poster_path,
    overview = EXCLUDED.overview,
    plot = EXCLUDED.plot,
    content_rating = EXCLUDED.content_rating,
    runtime = EXCLUDED.runtime,
    genre_strings = EXCLUDED.genre_strings,
    director = EXCLUDED.director,
    actors = EXCLUDED.actors,
    imdb_rating = EXCLUDED.imdb_rating,
    vote_average = EXCLUDED.vote_average,
    updated_at = NOW();
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Add a function to help with CSV imports
CREATE OR REPLACE FUNCTION import_csv_row(
  p_data JSONB
) RETURNS BOOLEAN AS $$
DECLARE
  v_id TEXT;
  v_title TEXT;
  v_media_type TEXT;
  v_imdb_id TEXT;
  v_year TEXT;
BEGIN
  -- Extract values from JSON
  v_title := p_data->>'Title';
  v_year := p_data->>'Year';
  v_media_type := CASE WHEN p_data->>'Type' = 'movie' THEN 'movie' ELSE 'tv' END;
  v_imdb_id := p_data->>'imdbID';
  
  -- Generate ID if not provided
  IF p_data->>'id' IS NOT NULL THEN
    v_id := p_data->>'id';
  ELSE
    v_id := COALESCE(v_imdb_id, '') || '-' || COALESCE(v_year, '');
  END IF;
  
  -- Insert using our upsert function
  RETURN upsert_content(
    v_id,
    v_title,
    v_media_type,
    v_imdb_id,
    v_year,
    p_data->>'Poster',
    p_data->>'Plot',
    p_data->>'Plot',
    p_data->>'Rated',
    CASE WHEN p_data->>'Runtime' ~ '^\d+$' THEN (p_data->>'Runtime')::INTEGER ELSE NULL END,
    CASE WHEN p_data->>'Genre' IS NOT NULL THEN string_to_array(p_data->>'Genre', ', ') ELSE NULL END,
    p_data->>'Director',
    p_data->>'Actors',
    p_data->>'imdbRating',
    CASE WHEN p_data->>'imdbRating' ~ '^\d+(\.\d+)?$' THEN (p_data->>'imdbRating')::NUMERIC ELSE NULL END
  );
END;
$$ LANGUAGE plpgsql;
