-- Add media_type column to homepage_content table
ALTER TABLE homepage_content ADD COLUMN media_type TEXT;

-- Update existing records based on content table
UPDATE homepage_content
SET media_type = c.media_type
FROM content c
WHERE homepage_content.content_id = c.id;

-- Create index for faster filtering
CREATE INDEX idx_homepage_content_media_type ON homepage_content(media_type);
