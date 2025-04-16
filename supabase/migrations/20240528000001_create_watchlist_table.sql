-- Create watchlist table for users to save content they want to watch
CREATE TABLE IF NOT EXISTS watchlist (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL,
  content_id TEXT NOT NULL,
  added_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  notes TEXT,
  priority SMALLINT DEFAULT 0,
  CONSTRAINT fk_user_id FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT fk_content_id FOREIGN KEY (content_id) REFERENCES content(id) ON DELETE CASCADE,
  CONSTRAINT unique_user_content UNIQUE (user_id, content_id)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_watchlist_user_id ON watchlist(user_id);
CREATE INDEX IF NOT EXISTS idx_watchlist_content_id ON watchlist(content_id);

-- Enable Row Level Security
ALTER TABLE watchlist ENABLE ROW LEVEL SECURITY;

-- Create policies
-- Users can only view their own watchlist items
DROP POLICY IF EXISTS "Users can view their own watchlist" ON watchlist;
CREATE POLICY "Users can view their own watchlist"
  ON watchlist FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert into their own watchlist
DROP POLICY IF EXISTS "Users can insert into their own watchlist" ON watchlist;
CREATE POLICY "Users can insert into their own watchlist"
  ON watchlist FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own watchlist items
DROP POLICY IF EXISTS "Users can update their own watchlist" ON watchlist;
CREATE POLICY "Users can update their own watchlist"
  ON watchlist FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can delete from their own watchlist
DROP POLICY IF EXISTS "Users can delete from their own watchlist" ON watchlist;
CREATE POLICY "Users can delete from their own watchlist"
  ON watchlist FOR DELETE
  USING (auth.uid() = user_id);
