/*
  # Add date and budget fields to projects table

  1. Changes
    - Add `start_date` (date, nullable) to `projects` table
    - Add `end_date` (date, nullable) to `projects` table
    - Add `budget` (numeric, nullable) to `projects` table
  
  2. Notes
    - All fields are optional
    - No changes to existing data or policies
*/

DO $$
BEGIN
  -- Add start_date column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'projects' AND column_name = 'start_date'
  ) THEN
    ALTER TABLE projects ADD COLUMN start_date date;
  END IF;

  -- Add end_date column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'projects' AND column_name = 'end_date'
  ) THEN
    ALTER TABLE projects ADD COLUMN end_date date;
  END IF;

  -- Add budget column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'projects' AND column_name = 'budget'
  ) THEN
    ALTER TABLE projects ADD COLUMN budget numeric;
  END IF;
END $$;
