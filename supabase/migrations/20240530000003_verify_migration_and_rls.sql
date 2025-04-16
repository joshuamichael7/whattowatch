-- Verify RLS policies
DO $$
BEGIN
  -- Verify RLS is enabled on user_feedback table
  IF EXISTS (
    SELECT 1 FROM pg_tables 
    WHERE schemaname = 'public' 
    AND tablename = 'user_feedback' 
    AND rowsecurity = true
  ) THEN
    RAISE NOTICE 'Success: RLS is enabled on user_feedback table';
  ELSE
    RAISE NOTICE 'Warning: RLS is not enabled on user_feedback table';
  END IF;

  -- Verify RLS is enabled on users table
  IF EXISTS (
    SELECT 1 FROM pg_tables 
    WHERE schemaname = 'public' 
    AND tablename = 'users' 
    AND rowsecurity = true
  ) THEN
    RAISE NOTICE 'Success: RLS is enabled on users table';
  ELSE
    RAISE NOTICE 'Warning: RLS is not enabled on users table';
  END IF;

  -- Verify RLS is enabled on user_preferences table
  IF EXISTS (
    SELECT 1 FROM pg_tables 
    WHERE schemaname = 'public' 
    AND tablename = 'user_preferences' 
    AND rowsecurity = true
  ) THEN
    RAISE NOTICE 'Success: RLS is enabled on user_preferences table';
  ELSE
    RAISE NOTICE 'Warning: RLS is not enabled on user_preferences table';
  END IF;
END
$$;