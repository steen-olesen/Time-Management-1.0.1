/*
  # Add billable field to time entries

  1. Changes
    - Add `billable` boolean field to `time_entries` table with default true
    - Add `duration_minutes` field to support manual time entry
    - Add `date` field to support date-based entries without specific times

  2. Notes
    - Preserves existing data structure
    - Adds flexibility for different time tracking methods
    - Default billable to true for existing entries
*/

DO $$
BEGIN
  -- Add billable field if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'time_entries' AND column_name = 'billable'
  ) THEN
    ALTER TABLE time_entries ADD COLUMN billable boolean DEFAULT true;
  END IF;

  -- Add duration_minutes field if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'time_entries' AND column_name = 'duration_minutes'
  ) THEN
    ALTER TABLE time_entries ADD COLUMN duration_minutes integer;
  END IF;

  -- Add date field if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'time_entries' AND column_name = 'date'
  ) THEN
    ALTER TABLE time_entries ADD COLUMN date date;
  END IF;
END $$;
