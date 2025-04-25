-- Add media_type column to watchlist table if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'watchlist' AND column_name = 'media_type') THEN
        ALTER TABLE watchlist ADD COLUMN media_type TEXT;
    END IF;
END
$$;