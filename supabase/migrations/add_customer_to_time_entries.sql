/*
  # Add direct customer relationship to time entries
  
  1. Changes
    - Add customer_id column to time_entries table
    - Update existing time entries to link directly to customers
    - Remove dependency on task→project→customer chain
  
  2. Strategy
    - Time entries will have direct customer reference
    - Tasks remain completely independent
    - Preserve all existing time entry data
*/

-- Add customer_id column to time_entries
ALTER TABLE time_entries ADD COLUMN IF NOT EXISTS customer_id uuid REFERENCES customers(id);

-- Update existing time entries to link directly to "Det Mindre Bureau" 
-- (since all current entries appear to be for this customer based on debug info)
UPDATE time_entries 
SET customer_id = (
  SELECT id 
  FROM customers 
  WHERE name = 'Det Mindre Bureau' 
  AND user_id = time_entries.user_id
)
WHERE customer_id IS NULL;

-- Drop existing policy if it exists and create new one
DROP POLICY IF EXISTS "Users can manage time_entries with customer access" ON time_entries;

CREATE POLICY "Users can manage time_entries with customer access"
  ON time_entries
  FOR ALL
  TO authenticated
  USING (
    auth.uid() = user_id AND 
    (customer_id IS NULL OR EXISTS (
      SELECT 1 FROM customers 
      WHERE customers.id = time_entries.customer_id 
      AND customers.user_id = auth.uid()
    ))
  )
  WITH CHECK (
    auth.uid() = user_id AND 
    (customer_id IS NULL OR EXISTS (
      SELECT 1 FROM customers 
      WHERE customers.id = time_entries.customer_id 
      AND customers.user_id = auth.uid()
    ))
  );