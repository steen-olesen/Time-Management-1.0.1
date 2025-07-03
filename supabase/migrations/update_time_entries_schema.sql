/*
  # Update time entries schema for duration-based tracking
  
  1. Changes
    - Add duration_minutes column to time_entries table
    - Add date column to time_entries table for when the work was performed
    - Make start_time and end_time nullable since we're shifting to duration-based tracking
  
  2. Notes
    - This changes the time tracking approach from start/end time to total duration
    - Existing time entries will maintain their start/end times but new entries can use duration
*/

-- Add duration_minutes column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'time_entries' AND column_name = 'duration_minutes'
  ) THEN
    ALTER TABLE time_entries ADD COLUMN duration_minutes integer;
  END IF;
END $$;

-- Add date column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'time_entries' AND column_name = 'date'
  ) THEN
    ALTER TABLE time_entries ADD COLUMN date date;
  END IF;
END $$;

-- Make start_time and end_time nullable
ALTER TABLE time_entries ALTER COLUMN start_time DROP NOT NULL;
