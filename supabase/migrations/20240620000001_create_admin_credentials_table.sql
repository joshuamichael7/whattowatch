-- Create admin_credentials table
CREATE TABLE IF NOT EXISTS admin_credentials (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id),
  password_hash TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Enable row level security
ALTER TABLE admin_credentials ENABLE ROW LEVEL SECURITY;

-- Create policy for admin users only
DROP POLICY IF EXISTS "Admin users can read their own credentials" ON admin_credentials;
CREATE POLICY "Admin users can read their own credentials"
  ON admin_credentials
  FOR SELECT
  USING (auth.uid() = user_id);

-- Only allow system to update credentials
DROP POLICY IF EXISTS "Only system can insert or update admin credentials" ON admin_credentials;
CREATE POLICY "Only system can insert or update admin credentials"
  ON admin_credentials
  FOR ALL
  USING (auth.uid() IN (SELECT id FROM users WHERE role = 'admin'));

-- Add a default admin password for initial setup (this will be a secure hash in production)
INSERT INTO admin_credentials (user_id, password_hash)
SELECT id, '$2a$10$zH7.4s2AbH8Kc.0RMunPZOeGmvzV6w0UGqUvOWMxgfS3UVjvKR5FW' -- hashed version of 'admin123'
FROM users
WHERE role = 'admin'
ON CONFLICT (user_id) DO NOTHING;

-- Enable realtime for this table
alter publication supabase_realtime add table admin_credentials;
