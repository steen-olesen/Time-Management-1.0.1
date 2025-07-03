/*
  # Add required fields to time entries
  
  1. Changes
    - Add customer_id column to time_entries table (required)
    - Add project_id column to time_entries table (required)
    - Add billable column to time_entries table (boolean, default true)
    - Add active column to time_entries table (boolean, default true)
  
  2. Notes
    - This adds customer and project associations to time entries
    - Adds flags for billable status and active status
    - All new fields have appropriate defaults
*/

-- Add customer_id column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'time_entries' AND column_name = 'customer_id'
  ) THEN
    ALTER TABLE time_entries ADD COLUMN customer_id uuid REFERENCES customers(id);
  END IF;
END $$;

-- Add project_id column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'time_entries' AND column_name = 'project_id'
  ) THEN
    ALTER TABLE time_entries ADD COLUMN project_id uuid REFERENCES projects(id);
  END IF;
END $$;

-- Add billable column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'time_entries' AND column_name = 'billable'
  ) THEN
    ALTER TABLE time_entries ADD COLUMN billable boolean DEFAULT true;
  END IF;
END $$;

-- Add active column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'time_entries' AND column_name = 'active'
  ) THEN
    ALTER TABLE time_entries ADD COLUMN active boolean DEFAULT true;
  END IF;
END $$;
