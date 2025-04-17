-- Create a function for bulk importing content from JSON array
CREATE OR REPLACE FUNCTION bulk_import_content(p_content_array JSONB)
RETURNS TABLE(success BOOLEAN, message TEXT, count INTEGER) AS $$
DECLARE
  v_item JSONB;
  v_success BOOLEAN;
  v_count INTEGER := 0;
  v_skipped INTEGER := 0;
  v_errors INTEGER := 0;
BEGIN
  -- Loop through each item in the array
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_content_array)
  LOOP
    BEGIN
      -- Skip if imdb_id is null or empty
      IF v_item->>'imdbID' IS NULL OR v_item->>'imdbID' = '' THEN
        v_skipped := v_skipped + 1;
        CONTINUE;
      END IF;
      
      -- Check if content with this imdb_id already exists
      IF EXISTS (SELECT 1 FROM content WHERE imdb_id = v_item->>'imdbID') THEN
        v_skipped := v_skipped + 1;
        CONTINUE;
      END IF;
      
      -- Insert the content
      INSERT INTO content (
        id,
        title,
        media_type,
        imdb_id,
        year,
        poster_path,
        overview,
        plot,
        content_rating,
        runtime,
        genre_strings,
        director,
        actors,
        imdb_rating,
        vote_average,
        created_at,
        updated_at
      ) VALUES (
        COALESCE(v_item->>'id', (v_item->>'imdbID') || '-' || (v_item->>'Year')),
        v_item->>'Title',
        CASE WHEN v_item->>'Type' = 'movie' THEN 'movie' ELSE 'tv' END,
        v_item->>'imdbID',
        v_item->>'Year',
        v_item->>'Poster',
        v_item->>'Plot',
        v_item->>'Plot',
        v_item->>'Rated',
        CASE WHEN v_item->>'Runtime' ~ '^\d+' THEN 
          (regexp_replace(v_item->>'Runtime', '[^0-9]', '', 'g'))::INTEGER 
        ELSE NULL END,
        CASE WHEN v_item->>'Genre' IS NOT NULL THEN 
          string_to_array(v_item->>'Genre', ', ') 
        ELSE NULL END,
        v_item->>'Director',
        v_item->>'Actors',
        v_item->>'imdbRating',
        CASE WHEN v_item->>'imdbRating' ~ '^\d+(\.\d+)?$' THEN 
          (v_item->>'imdbRating')::NUMERIC 
        ELSE NULL END,
        NOW(),
        NOW()
      );
      
      v_count := v_count + 1;
    EXCEPTION WHEN unique_violation THEN
      v_skipped := v_skipped + 1;
    WHEN OTHERS THEN
      v_errors := v_errors + 1;
    END;
  END LOOP;
  
  success := v_errors = 0;
  message := format('Processed %s items: %s inserted, %s skipped, %s errors', 
                   v_count + v_skipped + v_errors, v_count, v_skipped, v_errors);
  count := v_count;
  
  RETURN NEXT;
  RETURN;
END;
$$ LANGUAGE plpgsql;
