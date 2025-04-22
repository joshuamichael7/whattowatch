-- Query to find content with missing genre information

-- Find content with empty genre_ids array
SELECT 
  id, 
  title, 
  media_type, 
  genre_ids, 
  genre_strings
FROM content
WHERE 
  (genre_ids IS NULL OR 
   genre_ids = '{}' OR 
   array_length(genre_ids, 1) = 0) OR
  (genre_strings IS NULL OR 
   genre_strings = '{}' OR 
   array_length(genre_strings, 1) = 0)
ORDER BY title
LIMIT 100;

-- Count of content by media_type with missing genres
SELECT 
  media_type, 
  COUNT(*) as missing_genre_count
FROM content
WHERE 
  (genre_ids IS NULL OR 
   genre_ids = '{}' OR 
   array_length(genre_ids, 1) = 0) OR
  (genre_strings IS NULL OR 
   genre_strings = '{}' OR 
   array_length(genre_strings, 1) = 0)
GROUP BY media_type
ORDER BY missing_genre_count DESC;

-- Find content with genre_ids but no genre_strings
SELECT 
  id, 
  title, 
  media_type, 
  genre_ids, 
  genre_strings
FROM content
WHERE 
  (genre_ids IS NOT NULL AND array_length(genre_ids, 1) > 0) AND
  (genre_strings IS NULL OR genre_strings = '{}' OR array_length(genre_strings, 1) = 0)
ORDER BY title
LIMIT 100;

-- Find content with genre_strings but no genre_ids
SELECT 
  id, 
  title, 
  media_type, 
  genre_ids, 
  genre_strings
FROM content
WHERE 
  (genre_strings IS NOT NULL AND array_length(genre_strings, 1) > 0) AND
  (genre_ids IS NULL OR genre_ids = '{}' OR array_length(genre_ids, 1) = 0)
ORDER BY title
LIMIT 100;