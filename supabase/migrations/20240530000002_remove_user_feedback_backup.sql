-- Remove user_feedback_backup table if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT FROM pg_tables
    WHERE schemaname = 'public'
    AND tablename = 'user_feedback_backup'
  ) THEN
    DROP TABLE IF EXISTS public.user_feedback_backup;
    RAISE NOTICE 'Dropped user_feedback_backup table';
  ELSE
    RAISE NOTICE 'Table user_feedback_backup does not exist, nothing to drop';
  END IF;
END
$$;