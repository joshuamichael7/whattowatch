-- Add writer column to content table
ALTER TABLE content ADD COLUMN IF NOT EXISTS writer TEXT;
