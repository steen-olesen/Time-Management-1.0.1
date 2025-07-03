/*
  # Clean up unused rate structures

  1. Database Cleanup
    - Drop `personal_rate` table (no longer needed)
    - Remove `rate_id` column from `time_entries` table (replaced by direct rate column)

  2. Notes
    - These structures are no longer used after implementing direct rate column
    - Safe to remove as functionality has been replaced
*/

-- Drop the personal_rate table
DROP TABLE IF EXISTS personal_rate;

-- Remove rate_id column from time_entries table
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'time_entries' AND column_name = 'rate_id'
  ) THEN
    ALTER TABLE time_entries DROP COLUMN rate_id;
  END IF;
END $$;