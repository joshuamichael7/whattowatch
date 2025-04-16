-- Create content table to store movie and TV show information
CREATE TABLE IF NOT EXISTS content (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  media_type TEXT NOT NULL CHECK (media_type IN ('movie', 'series', 'episode')),
  poster_path TEXT,
  backdrop_path TEXT,
  release_date TEXT,
  first_air_date TEXT,
  vote_average NUMERIC,
  vote_count INTEGER,
  genre_ids INTEGER[],
  genre_strings TEXT[],
  overview TEXT,
  runtime INTEGER,
  content_rating TEXT,
  streaming_providers JSONB,
  popularity NUMERIC,
  imdb_id TEXT,
  year TEXT,
  plot TEXT,
  director TEXT,
  actors TEXT,
  imdb_rating TEXT,
  keywords TEXT[],
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index on frequently queried fields
CREATE INDEX IF NOT EXISTS content_title_idx ON content (title);
CREATE INDEX IF NOT EXISTS content_media_type_idx ON content (media_type);
CREATE INDEX IF NOT EXISTS content_popularity_idx ON content (popularity);

-- Enable row level security
ALTER TABLE content ENABLE ROW LEVEL SECURITY;

-- Create policy for public read access
DROP POLICY IF EXISTS "Public read access" ON content;
CREATE POLICY "Public read access"
  ON content FOR SELECT
  USING (true);

-- Create policy for authenticated users to insert/update
DROP POLICY IF EXISTS "Authenticated users can insert and update" ON content;
CREATE POLICY "Authenticated users can insert and update"
  ON content FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- Enable realtime
alter publication supabase_realtime add table content;
