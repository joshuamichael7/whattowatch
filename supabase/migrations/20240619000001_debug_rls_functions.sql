-- Create a function to get RLS policies for a table
CREATE OR REPLACE FUNCTION get_policies_for_table(table_name text)
RETURNS TABLE (
  policyname text,
  permissive text,
  roles text,
  cmd text,
  qual text
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    pg_policies.policyname,
    pg_policies.permissive,
    pg_policies.roles,
    pg_policies.cmd,
    pg_policies.qual
  FROM pg_policies
  WHERE pg_policies.tablename = table_name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a function to check if a user has access to a table
CREATE OR REPLACE FUNCTION check_user_access(user_id text, table_name text)
RETURNS boolean AS $$
DECLARE
  has_access boolean;
BEGIN
  EXECUTE format('SELECT EXISTS (SELECT 1 FROM %I WHERE id = %L)', table_name, user_id) INTO has_access;
  RETURN has_access;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a function to list all users
CREATE OR REPLACE FUNCTION list_all_users()
RETURNS TABLE (
  id text,
  email text,
  role text,
  created_at timestamptz
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    users.id,
    users.email,
    users.role,
    users.created_at
  FROM users;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a function to find a user by email (case insensitive)
CREATE OR REPLACE FUNCTION find_user_by_email(email_to_find text)
RETURNS TABLE (
  id text,
  email text,
  role text,
  created_at timestamptz
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    users.id,
    users.email,
    users.role,
    users.created_at
  FROM users
  WHERE LOWER(users.email) = LOWER(email_to_find);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant access to these functions
GRANT EXECUTE ON FUNCTION get_policies_for_table TO authenticated;
GRANT EXECUTE ON FUNCTION check_user_access TO authenticated;
GRANT EXECUTE ON FUNCTION list_all_users TO authenticated;
GRANT EXECUTE ON FUNCTION find_user_by_email TO authenticated;

-- Ensure public access to users table
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they're too restrictive
DROP POLICY IF EXISTS "Users can view their own data" ON public.users;
DROP POLICY IF EXISTS "Service role can view all users" ON public.users;
DROP POLICY IF EXISTS "Public access to users" ON public.users;

-- Create a policy that allows users to view their own data
CREATE POLICY "Users can view their own data"
ON public.users
FOR SELECT
USING (auth.uid() = id);

-- Create a policy that allows service role to view all users
CREATE POLICY "Service role can view all users"
ON public.users
FOR ALL
USING (auth.jwt() -> 'claims' ->> 'role' = 'service_role');

-- Create a policy that allows public access for debugging
CREATE POLICY "Public access to users"
ON public.users
FOR SELECT
USING (true);
