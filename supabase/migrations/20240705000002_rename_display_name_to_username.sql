-- Rename display_name column to username in users table
ALTER TABLE users RENAME COLUMN display_name TO username;

-- Update the realtime publication
alter publication supabase_realtime add table users;