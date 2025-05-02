-- Create recommendation_cache table for storing processed recommendations
CREATE TABLE IF NOT EXISTS recommendation_cache (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cache_key TEXT NOT NULL UNIQUE,
  recommendations JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  metadata JSONB
);

-- Create index on cache_key for faster lookups
CREATE INDEX IF NOT EXISTS idx_recommendation_cache_key ON recommendation_cache(cache_key);

-- Create index on expiration date for cleanup operations
CREATE INDEX IF NOT EXISTS idx_recommendation_cache_expires_at ON recommendation_cache(expires_at);

-- Add RLS policies
ALTER TABLE recommendation_cache ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read from the cache
DROP POLICY IF EXISTS "Anyone can read recommendation cache" ON recommendation_cache;
CREATE POLICY "Anyone can read recommendation cache"
  ON recommendation_cache FOR SELECT
  USING (true);

-- Only authenticated users can insert/update the cache
DROP POLICY IF EXISTS "Authenticated users can insert recommendation cache" ON recommendation_cache;
CREATE POLICY "Authenticated users can insert recommendation cache"
  ON recommendation_cache FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Authenticated users can update recommendation cache" ON recommendation_cache;
CREATE POLICY "Authenticated users can update recommendation cache"
  ON recommendation_cache FOR UPDATE
  USING (auth.role() = 'authenticated');

-- Create a function to clean up expired cache entries
CREATE OR REPLACE FUNCTION cleanup_expired_recommendation_cache()
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
  deleted_count integer;
BEGIN
  DELETE FROM recommendation_cache
  WHERE expires_at < NOW()
  RETURNING count(*) INTO deleted_count;
  
  RETURN deleted_count;
END;
$$;

-- Enable realtime for this table
alter publication supabase_realtime add table recommendation_cache;
