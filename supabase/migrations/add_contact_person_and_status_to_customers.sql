/*
  # Add contact person and status to customers table

  1. Changes
    - Add `contact_person` (text) column to `customers` table
    - Add `is_active` (boolean) column to `customers` table with default value of true
*/

-- Add contact_person column to customers table
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'customers' AND column_name = 'contact_person'
  ) THEN
    ALTER TABLE customers ADD COLUMN contact_person text;
  END IF;
END $$;

-- Add is_active column to customers table
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'customers' AND column_name = 'is_active'
  ) THEN
    ALTER TABLE customers ADD COLUMN is_active boolean DEFAULT true;
  END IF;
END $$;
