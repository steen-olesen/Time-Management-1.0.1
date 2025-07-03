/*
  # Ensure tasks independence
  
  1. Changes
    - Ensure project_id column exists on tasks table but is completely optional
    - Remove any NOT NULL constraints on project_id if they exist
    - Make sure foreign key is optional (if it exists)
  
  2. Notes
    - Tasks are independent entities and should not require a project
    - This maintains the independence of tasks while allowing optional project association
*/

-- Add project_id column if it doesn't exist (as nullable)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'tasks' AND column_name = 'project_id'
  ) THEN
    ALTER TABLE tasks ADD COLUMN project_id uuid NULL;
  END IF;
END $$;

-- Ensure project_id is nullable (remove NOT NULL constraint if it exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'tasks' 
    AND column_name = 'project_id'
    AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE tasks ALTER COLUMN project_id DROP NOT NULL;
  END IF;
END $$;

-- Add optional foreign key if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints tc
    JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name
    WHERE tc.constraint_type = 'FOREIGN KEY' 
    AND tc.table_name = 'tasks' 
    AND ccu.column_name = 'project_id'
  ) AND EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_name = 'projects'
  ) THEN
    ALTER TABLE tasks ADD CONSTRAINT tasks_project_id_fkey 
    FOREIGN KEY (project_id) REFERENCES projects(id);
  END IF;
END $$;
