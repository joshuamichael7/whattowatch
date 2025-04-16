-- Add role column to users table with default value 'user'
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'user';

-- Create policy to allow users to read their own role
DROP POLICY IF EXISTS "Users can read their own role" ON public.users;
CREATE POLICY "Users can read their own role"
  ON public.users
  FOR SELECT
  USING (auth.uid() = id);

-- Create policy to allow system to set role during user creation
DROP POLICY IF EXISTS "System can set role during creation" ON public.users;
CREATE POLICY "System can set role during creation"
  ON public.users
  FOR UPDATE
  USING (auth.uid() = id);
