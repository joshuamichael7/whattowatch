-- Create a function to execute SQL queries directly
CREATE OR REPLACE FUNCTION execute_sql(sql_query TEXT)
RETURNS VOID AS $$
BEGIN
  EXECUTE sql_query;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION execute_sql TO authenticated;

-- Add comment explaining the purpose
COMMENT ON FUNCTION execute_sql IS 'Executes a SQL query with elevated privileges. Use with caution.';
