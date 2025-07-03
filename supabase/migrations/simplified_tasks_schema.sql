/*
  # Simplified tasks table schema fix
  
  1. Changes
    - Use simple ALTER TABLE statements with IF EXISTS clauses
    - Avoid complex PL/pgSQL blocks that might cause issues with the API
  
  2. Notes
    - Tasks are independent entities not associated with projects
    - This migration uses simple SQL statements that are more likely to succeed
*/

-- Drop the constraint if it exists (this is safe even if it doesn't exist)
ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_project_id_fkey;

-- Attempt to modify the column if it exists
-- This statement will fail gracefully if the column doesn't exist
ALTER TABLE IF EXISTS tasks ALTER COLUMN project_id DROP NOT NULL;
