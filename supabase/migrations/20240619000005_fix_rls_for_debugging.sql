-- Completely disable RLS on users table for debugging
ALTER TABLE users DISABLE ROW LEVEL SECURITY;

-- Create a function to list all RLS policies for a table
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
    p.policyname,
    p.permissive::text,
    p.roles::text,
    p.cmd::text,
    p.qual::text
  FROM
    pg_policy p
    JOIN pg_class c ON p.polrelid = c.oid
    JOIN pg_namespace n ON c.relnamespace = n.oid
  WHERE
    c.relname = table_name
    AND n.nspname = 'public';
  RETURN;
END;
$$ LANGUAGE plpgsql;
