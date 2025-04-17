-- Fix RLS policies for the users table to allow anonymous access

-- First, enable RLS on the users table if not already enabled
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Drop existing policies that might be too restrictive
DROP POLICY IF EXISTS "Allow public read access" ON users;

-- Create a policy that allows anyone to read from the users table
CREATE POLICY "Allow public read access" 
ON users
FOR SELECT
USING (true);

-- Create a policy that allows users to update their own profiles
DROP POLICY IF EXISTS "Users can update own profiles" ON users;
CREATE POLICY "Users can update own profiles"
ON users
FOR UPDATE
USING (auth.uid() = id);

-- Create a policy that allows the service role to do anything
DROP POLICY IF EXISTS "Service role has full access" ON users;
CREATE POLICY "Service role has full access"
ON users
FOR ALL
USING (auth.role() = 'service_role');
