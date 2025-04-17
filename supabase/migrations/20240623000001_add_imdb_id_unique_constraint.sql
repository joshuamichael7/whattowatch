-- Add unique constraint on imdb_id to prevent duplicates
ALTER TABLE content ADD CONSTRAINT content_imdb_id_unique UNIQUE (imdb_id);

-- Update the upsert_content function to handle the unique constraint
CREATE OR REPLACE FUNCTION upsert_content(
  p_id TEXT,
  p_title TEXT,
  p_media_type TEXT,
  p_imdb_id TEXT,
  p_year TEXT,
  p_poster_path TEXT,
  p_overview TEXT,
  p_plot TEXT,
  p_content_rating TEXT,
  p_runtime INTEGER,
  p_genre_strings TEXT[],
  p_director TEXT,
  p_actors TEXT,
  p_imdb_rating TEXT,
  p_vote_average NUMERIC
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

-- Create a function to check if content exists by imdb_id
CREATE OR REPLACE FUNCTION content_exists_by_imdb_id(p_imdb_id TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM content WHERE imdb_id = p_imdb_id
  );
END;
$$ LANGUAGE plpgsql;

-- Create a function for importing CSV rows that handles duplicates
CREATE OR REPLACE FUNCTION import_csv_row(
  p_id TEXT,
  p_title TEXT,
  p_media_type TEXT,
  p_imdb_id TEXT,
  p_year TEXT,
  p_poster_path TEXT,
  p_overview TEXT,
  p_plot TEXT,
  p_content_rating TEXT,
  p_runtime TEXT,
  p_genre TEXT,
  p_director TEXT,
  p_actors TEXT,
  p_imdb_rating TEXT
) RETURNS BOOLEAN AS $$
DECLARE
  v_runtime INTEGER;
  v_genre_strings TEXT[];
  v_vote_average NUMERIC;
BEGIN
  -- Skip if imdb_id is null or empty
  IF p_imdb_id IS NULL OR p_imdb_id = '' THEN
    RETURN FALSE;
  END IF;
  
  -- Convert runtime string to integer
  BEGIN
    v_runtime := NULLIF(regexp_replace(p_runtime, '[^0-9]', '', 'g'), '')::INTEGER;
  EXCEPTION WHEN OTHERS THEN
    v_runtime := NULL;
  END;
  
  -- Convert genre string to array
  IF p_genre IS NOT NULL AND p_genre != '' THEN
    v_genre_strings := string_to_array(p_genre, ', ');
  ELSE
    v_genre_strings := NULL;
  END IF;
  
  -- Convert imdb_rating to numeric for vote_average
  BEGIN
    v_vote_average := NULLIF(p_imdb_rating, '')::NUMERIC;
  EXCEPTION WHEN OTHERS THEN
    v_vote_average := 0;
  END;
  
  -- Use the upsert_content function to handle the insert/update
  RETURN upsert_content(
    COALESCE(p_id, p_imdb_id || '-' || p_year),
    p_title,
    p_media_type,
    p_imdb_id,
    p_year,
    p_poster_path,
    p_overview,
    p_plot,
    p_content_rating,
    v_runtime,
    v_genre_strings,
    p_director,
    p_actors,
    p_imdb_rating,
    v_vote_average
  );
END;
$$ LANGUAGE plpgsql;