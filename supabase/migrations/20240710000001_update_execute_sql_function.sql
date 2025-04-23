-- Drop the existing function first
DROP FUNCTION IF EXISTS execute_sql(text);

-- Create a function to execute SQL queries directly and return results
CREATE OR REPLACE FUNCTION execute_sql(sql_query TEXT)
RETURNS JSONB AS $$
DECLARE
  result JSONB;
BEGIN
  EXECUTE sql_query INTO result;
  RETURN result;
EXCEPTION WHEN OTHERS THEN
  -- Return the error information
  RETURN jsonb_build_object('error', SQLERRM, 'detail', SQLSTATE);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;