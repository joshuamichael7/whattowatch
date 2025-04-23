-- Temporarily disable RLS to allow the update operation to complete
ALTER TABLE content DISABLE ROW LEVEL SECURITY;

-- Run your genre updates while RLS is disabled

-- After updates are complete, re-enable RLS with proper policies
ALTER TABLE content ENABLE ROW LEVEL SECURITY;

-- Create policy for public read access to content
DROP POLICY IF EXISTS "Content is viewable by everyone" ON content;
CREATE POLICY "Content is viewable by everyone"
ON content FOR SELECT
USING (true);

-- Create policy for authenticated users to update content
DROP POLICY IF EXISTS "Authenticated users can update content" ON content;
CREATE POLICY "Authenticated users can update content"
ON content FOR UPDATE
USING (auth.role() = 'authenticated');

-- Create policy for service role to have full access
DROP POLICY IF EXISTS "Service role has full access to content" ON content;
CREATE POLICY "Service role has full access to content"
ON content FOR ALL
USING (auth.role() = 'service_role');
