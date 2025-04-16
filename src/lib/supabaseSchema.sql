-- Supabase SQL schema for the MovieMatch application

-- Content table to store movie and TV show data
CREATE TABLE content (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  imdb_id TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  year TEXT,
  rated TEXT,
  released TEXT,
  runtime TEXT,
  genre TEXT,
  director TEXT,
  writer TEXT,
  actors TEXT,
  plot TEXT,
  language TEXT,
  country TEXT,
  awards TEXT,
  poster TEXT,
  ratings JSONB,
  metascore TEXT,
  imdb_rating TEXT,
  imdb_votes TEXT,
  type TEXT NOT NULL, -- 'movie' or 'series'
  total_seasons TEXT,
  dvd TEXT,
  box_office TEXT,
  production TEXT,
  website TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index on imdb_id for faster lookups
CREATE INDEX idx_content_imdb_id ON content(imdb_id);

-- Create index on title for faster text searches
CREATE INDEX idx_content_title ON content(title);

-- Create index on type for filtering by movie/series
CREATE INDEX idx_content_type ON content(type);

-- Content similarities junction table
CREATE TABLE content_similarities (
  id SERIAL PRIMARY KEY,
  content_id TEXT NOT NULL REFERENCES content(imdb_id) ON DELETE CASCADE,
  similar_content_id TEXT NOT NULL REFERENCES content(imdb_id) ON DELETE CASCADE,
  similarity_score FLOAT NOT NULL, -- 0-1 score
  similarity_type TEXT NOT NULL, -- 'plot', 'genre', 'actor', 'ai-suggested', etc.
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Ensure no duplicate relationships
  UNIQUE(content_id, similar_content_id, similarity_type)
);

-- Create index on content_id for faster lookups
CREATE INDEX idx_similarities_content_id ON content_similarities(content_id);

-- Create index on similarity score for sorting
CREATE INDEX idx_similarities_score ON content_similarities(similarity_score);

-- User feedback table for recommendations
CREATE TABLE recommendation_feedback (
  id SERIAL PRIMARY KEY,
  user_id TEXT, -- Can be anonymous or linked to auth system
  content_id TEXT NOT NULL REFERENCES content(imdb_id) ON DELETE CASCADE,
  feedback_type TEXT NOT NULL, -- 'like', 'dislike'
  source TEXT, -- Where the recommendation came from ('ai', 'vector', 'similar')
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- AI recommendation cache table
CREATE TABLE ai_recommendation_cache (
  id SERIAL PRIMARY KEY,
  query_hash TEXT NOT NULL UNIQUE, -- Hash of the query parameters
  query_params JSONB NOT NULL, -- The original query parameters
  recommendations JSONB NOT NULL, -- The recommendations returned by the AI
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '7 days')
);

-- Create index on query_hash for faster lookups
CREATE INDEX idx_ai_cache_query_hash ON ai_recommendation_cache(query_hash);

-- Create index on expiration for cleanup
CREATE INDEX idx_ai_cache_expires_at ON ai_recommendation_cache(expires_at);

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update updated_at on content table
CREATE TRIGGER set_updated_at
BEFORE UPDATE ON content
FOR EACH ROW
EXECUTE FUNCTION update_updated_at();
