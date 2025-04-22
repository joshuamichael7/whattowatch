-- Migration to update genre IDs based on the new explicit mapping

-- Create a function to map genre strings to consistent IDs
CREATE OR REPLACE FUNCTION map_genre_to_id(genre_name TEXT)
RETURNS INTEGER AS $$
DECLARE
  genre_id INTEGER;
BEGIN
  -- Movie genres
  IF genre_name = 'Action' THEN RETURN 28;
  ELSIF genre_name = 'Adventure' THEN RETURN 12;
  ELSIF genre_name = 'Animation' THEN RETURN 16;
  ELSIF genre_name = 'Comedy' THEN RETURN 35;
  ELSIF genre_name = 'Crime' THEN RETURN 80;
  ELSIF genre_name = 'Documentary' THEN RETURN 99;
  ELSIF genre_name = 'Drama' THEN RETURN 18;
  ELSIF genre_name = 'Family' THEN RETURN 10751;
  ELSIF genre_name = 'Fantasy' THEN RETURN 14;
  ELSIF genre_name = 'History' THEN RETURN 36;
  ELSIF genre_name = 'Horror' THEN RETURN 27;
  ELSIF genre_name = 'Music' THEN RETURN 10402;
  ELSIF genre_name = 'Mystery' THEN RETURN 9648;
  ELSIF genre_name = 'Romance' THEN RETURN 10749;
  ELSIF genre_name = 'Science Fiction' OR genre_name = 'Sci-Fi' THEN RETURN 878;
  ELSIF genre_name = 'TV Movie' THEN RETURN 10770;
  ELSIF genre_name = 'Thriller' THEN RETURN 53;
  ELSIF genre_name = 'War' THEN RETURN 10752;
  ELSIF genre_name = 'Western' THEN RETURN 37;
  
  -- TV genres
  ELSIF genre_name = 'Action & Adventure' THEN RETURN 10759;
  ELSIF genre_name = 'Kids' THEN RETURN 10762;
  ELSIF genre_name = 'News' THEN RETURN 10763;
  ELSIF genre_name = 'Reality' THEN RETURN 10764;
  ELSIF genre_name = 'Sci-Fi & Fantasy' THEN RETURN 10765;
  ELSIF genre_name = 'Soap' THEN RETURN 10766;
  ELSIF genre_name = 'Talk' THEN RETURN 10767;
  ELSIF genre_name = 'War & Politics' THEN RETURN 10768;
  
  -- Additional common genres
  ELSIF genre_name = 'Biography' THEN RETURN 36001;
  ELSIF genre_name = 'Sport' THEN RETURN 36002;
  ELSIF genre_name = 'Musical' THEN RETURN 36003;
  ELSIF genre_name = 'Short' THEN RETURN 36004;
  ELSIF genre_name = 'Adult' THEN RETURN 36005;
  ELSIF genre_name = 'Film-Noir' THEN RETURN 36006;
  ELSIF genre_name = 'Game-Show' THEN RETURN 36007;
  ELSIF genre_name = 'Talk-Show' THEN RETURN 36008;
  
  -- Return NULL for unknown genres
  ELSE RETURN NULL;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Create a function to update genre_ids based on genre_strings
CREATE OR REPLACE FUNCTION update_genre_ids()
RETURNS VOID AS $$
DECLARE
  content_rec RECORD;
  genre_string TEXT;
  new_genre_ids INTEGER[] := '{}';
  genre_array TEXT[];
BEGIN
  -- Loop through all content items with genre_strings
  FOR content_rec IN 
    SELECT id, genre_strings FROM content 
    WHERE genre_strings IS NOT NULL AND array_length(genre_strings, 1) > 0
  LOOP
    -- Reset the array for each content item
    new_genre_ids := '{}';
    
    -- Process each genre string in the array
    FOREACH genre_string IN ARRAY content_rec.genre_strings
    LOOP
      -- Map the genre string to an ID and add it to the array if not NULL
      IF map_genre_to_id(genre_string) IS NOT NULL THEN
        new_genre_ids := array_append(new_genre_ids, map_genre_to_id(genre_string));
      END IF;
    END LOOP;
    
    -- Update the content item with the new genre_ids
    UPDATE content 
    SET genre_ids = new_genre_ids,
        updated_at = NOW()
    WHERE id = content_rec.id;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Execute the function to update all genre IDs
SELECT update_genre_ids();

-- Drop the temporary functions
DROP FUNCTION update_genre_ids();
DROP FUNCTION map_genre_to_id(TEXT);
