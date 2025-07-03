/*
  # Remove project_id from tasks table
  
  1. Changes
    - Drop the project_id column from tasks table if it exists
    - Remove any foreign key constraints related to projects
  
  2. Notes
    - Tasks are completely independent entities with NO connection to projects
    - This migration ensures complete separation between tasks and projects
*/

-- Drop the foreign key constraint if it exists
ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_project_id_fkey;

-- Drop the project_id column if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'tasks' AND column_name = 'project_id'
  ) THEN
    ALTER TABLE tasks DROP COLUMN project_id;
  END IF;
END $$;
