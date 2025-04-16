-- Update user_preferences table to include more detailed preference fields
ALTER TABLE user_preferences
ADD COLUMN IF NOT EXISTS preferred_genres TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS excluded_genres TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS preferred_mood TEXT,
ADD COLUMN IF NOT EXISTS viewing_time_min INTEGER DEFAULT 120,
ADD COLUMN IF NOT EXISTS content_rating_limit TEXT DEFAULT 'PG-13',
ADD COLUMN IF NOT EXISTS family_friendly BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS content_warnings TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS favorite_content TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS content_to_avoid TEXT[] DEFAULT '{}';

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_preferences_user_id ON user_preferences(user_id);

-- Ensure RLS policies are in place
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist to avoid conflicts
DROP POLICY IF EXISTS "Users can view their own preferences" ON user_preferences;
DROP POLICY IF EXISTS "Users can update their own preferences" ON user_preferences;

-- Create policies for user_preferences table
CREATE POLICY "Users can view their own preferences"
ON user_preferences FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own preferences"
ON user_preferences FOR UPDATE
USING (auth.uid() = user_id);

-- Enable realtime for this table
ALTER PUBLICATION supabase_realtime ADD TABLE user_preferences;