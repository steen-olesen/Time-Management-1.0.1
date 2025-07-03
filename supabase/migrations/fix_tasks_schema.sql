/*
  # Fix tasks schema for project association
  
  1. Changes
    - Ensure project_id column exists on tasks table
    - Make project_id nullable to support tasks without projects
    - Add foreign key constraint if missing
  
  2. Notes
    - This fixes the "column tasks.project_id does not exist" error
    - Uses a safer approach with explicit column addition
*/

-- Add project_id column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'tasks' AND column_name = 'project_id'
  ) THEN
    ALTER TABLE tasks ADD COLUMN project_id uuid;
  END IF;
END $$;

-- Add foreign key constraint if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints tc
    JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name
    WHERE tc.constraint_type = 'FOREIGN KEY' 
    AND tc.table_name = 'tasks' 
    AND ccu.column_name = 'project_id'
    AND ccu.table_name = 'projects'
  ) THEN
    ALTER TABLE tasks ADD CONSTRAINT tasks_project_id_fkey 
    FOREIGN KEY (project_id) REFERENCES projects(id);
  END IF;
END $$;
