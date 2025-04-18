-- Change runtime column from integer to text in content table
ALTER TABLE content ALTER COLUMN runtime TYPE text USING runtime::text;

-- Update the upsert_content function to handle text runtime
CREATE OR REPLACE FUNCTION upsert_content(
  p_id text,
  p_title text,
  p_media_type text,
  p_imdb_id text,
  p_year text,
  p_poster_path text,
  p_overview text,
  p_plot text,
  p_content_rating text,
  p_runtime text,
  p_genre_strings text[],
  p_director text,
  p_actors text,
  p_imdb_rating text,
  p_vote_average numeric
) RETURNS void AS $$
BEGIN
  INSERT INTO content (
    id, title, media_type, imdb_id, year, poster_path, overview, plot, 
    content_rating, runtime, genre_strings, director, actors, imdb_rating, vote_average
  ) VALUES (
    p_id, p_title, p_media_type, p_imdb_id, p_year, p_poster_path, p_overview, p_plot, 
    p_content_rating, p_runtime, p_genre_strings, p_director, p_actors, p_imdb_rating, p_vote_average
  )
  ON CONFLICT (imdb_id) DO UPDATE SET
    title = p_title,
    media_type = p_media_type,
    year = p_year,
    poster_path = p_poster_path,
    overview = p_overview,
    plot = p_plot,
    content_rating = p_content_rating,
    runtime = p_runtime,
    genre_strings = p_genre_strings,
    director = p_director,
    actors = p_actors,
    imdb_rating = p_imdb_rating,
    vote_average = p_vote_average,
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- Update the content_exists_by_imdb_id function to ensure it still works with the modified schema
CREATE OR REPLACE FUNCTION content_exists_by_imdb_id(p_imdb_id text) RETURNS boolean AS $$
DECLARE
  exists_count integer;
BEGIN
  SELECT COUNT(*) INTO exists_count FROM content WHERE imdb_id = p_imdb_id;
  RETURN exists_count > 0;
END;
$$ LANGUAGE plpgsql;
