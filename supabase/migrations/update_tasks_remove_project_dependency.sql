/*
  # Update tasks table to remove project dependency
  
  1. Changes
    - Remove project_id foreign key constraint from tasks table
    - Make project_id column nullable
  
  2. Notes
    - Tasks are no longer associated with projects
    - This allows tasks to be used independently
*/

-- Make project_id nullable
ALTER TABLE tasks ALTER COLUMN project_id DROP NOT NULL;

-- Drop the foreign key constraint between tasks and projects
ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_project_id_fkey;
