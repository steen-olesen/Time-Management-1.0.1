/*
  # Simplify tasks to universal entities

  1. Changes
    - Remove project_id foreign key constraint from tasks table
    - Remove status column from tasks table
    - Keep only name and description as main fields
  
  2. Notes
    - Tasks become universal entities like "Meeting", "Project management", etc.
    - Tasks are independent from projects
    - Only name and description are kept as main fields
*/

-- First, drop the foreign key constraint
ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_project_id_fkey;

-- Then, drop the project_id column
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tasks' AND column_name = 'project_id'
  ) THEN
    ALTER TABLE tasks DROP COLUMN project_id;
  END IF;
END $$;

-- Drop the status column
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tasks' AND column_name = 'status'
  ) THEN
    ALTER TABLE tasks DROP COLUMN status;
  END IF;
END $$;
