/*
  # Fix relationship between time_entries and tasks
  
  1. Changes
    - Add foreign key constraint between time_entries.task_id and tasks.id
    - This fixes the "Could not find a relationship between time_entries and tasks" error
  
  2. Notes
    - This ensures proper relationship between time entries and tasks
    - Enables proper joins in queries
*/

-- Add foreign key constraint between time_entries and tasks
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints tc
    JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name
    WHERE tc.constraint_type = 'FOREIGN KEY' 
    AND tc.table_name = 'time_entries' 
    AND ccu.table_name = 'tasks'
    AND ccu.column_name = 'id'
  ) THEN
    ALTER TABLE time_entries
    ADD CONSTRAINT time_entries_task_id_fkey
    FOREIGN KEY (task_id) REFERENCES tasks(id);
  END IF;
END $$;
