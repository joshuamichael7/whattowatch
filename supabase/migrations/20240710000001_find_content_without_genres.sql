-- Find content items that don't have genres (either NULL or empty arrays)
-- This query returns content items where:
-- 1. genre_strings is NULL or an empty array
-- 2. genre_ids is NULL or an empty array

SELECT 
  id, 
  title, 
  imdb_id, 
  media_type,
  genre_strings,
  genre_ids
FROM content
WHERE 
  (genre_strings IS NULL OR genre_strings = '{}' OR array_length(genre_strings, 1) IS NULL)
  OR
  (genre_ids IS NULL OR genre_ids = '{}' OR array_length(genre_ids, 1) IS NULL)
ORDER BY title;
