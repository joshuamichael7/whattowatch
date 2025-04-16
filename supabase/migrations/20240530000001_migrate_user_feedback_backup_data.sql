-- Check if user_feedback_backup table exists before attempting migration
DO $$
BEGIN
  IF EXISTS (
    SELECT FROM pg_tables
    WHERE schemaname = 'public'
    AND tablename = 'user_feedback_backup'
  ) THEN
    -- Migrate user_id data from user_feedback_backup to users table
    INSERT INTO public.users (id, created_at)
    SELECT DISTINCT user_id, NOW()
    FROM public.user_feedback_backup
    WHERE user_id IS NOT NULL
    AND user_id != 'anonymous'
    AND NOT EXISTS (
      SELECT 1 FROM public.users WHERE id = user_feedback_backup.user_id
    );

    -- Update user_feedback table with user_ids from user_feedback_backup
    UPDATE public.user_feedback
    SET user_id = backup.user_id
    FROM public.user_feedback_backup AS backup
    WHERE user_feedback.content_id = backup.content_id
    AND backup.user_id IS NOT NULL
    AND backup.user_id != 'anonymous'
    AND (user_feedback.user_id IS NULL OR user_feedback.user_id = 'anonymous');
  ELSE
    RAISE NOTICE 'Table user_feedback_backup does not exist, skipping migration';
  END IF;
END
$$;