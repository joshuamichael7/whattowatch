-- Check current RLS policies on users table
SELECT tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE tablename = 'users';

-- Ensure public access to users table for authenticated users
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they're too restrictive
DROP POLICY IF EXISTS "Users can view their own data" ON public.users;

-- Create a policy that allows users to view their own data
CREATE POLICY "Users can view their own data"
ON public.users
FOR SELECT
USING (auth.uid() = id OR auth.jwt() -> 'claims' ->> 'role' = 'service_role');

-- Create a policy that allows service role to view all users
DROP POLICY IF EXISTS "Service role can view all users" ON public.users;
CREATE POLICY "Service role can view all users"
ON public.users
FOR ALL
USING (auth.jwt() -> 'claims' ->> 'role' = 'service_role');

-- Create a policy that allows public access for debugging
DROP POLICY IF EXISTS "Public access to users" ON public.users;
CREATE POLICY "Public access to users"
ON public.users
FOR SELECT
USING (true);
