/*
  # Add project_id to tasks table
  
  1. Changes
    - Add project_id column to tasks table if it doesn't exist
    - Make project_id nullable to support tasks without projects
    - Add foreign key reference to projects table
  
  2. Notes
    - This fixes the "column tasks.project_id does not exist" error
    - Tasks can exist without being associated with a project
*/

-- Add project_id column to tasks table if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'tasks' AND column_name = 'project_id'
  ) THEN
    ALTER TABLE tasks ADD COLUMN project_id uuid REFERENCES projects(id);
  END IF;
END $$;
