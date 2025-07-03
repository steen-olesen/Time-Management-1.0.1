/*
  # Remove dependency between time entries and tasks
  
  1. Changes
    - Remove task_id foreign key constraint from time_entries table
    - Keep the task_id column for reference but without constraint
  
  2. Notes
    - Time entries are no longer strictly dependent on tasks
    - The task_id column is kept for reference purposes
    - This allows tasks to be used across all time entries without database constraints
*/

-- Drop the foreign key constraint between time_entries and tasks
ALTER TABLE time_entries DROP CONSTRAINT IF EXISTS time_entries_task_id_fkey;
