/*
  # Add Rate Column to Time Entries

  1. Schema Changes
    - Add `rate` column to `time_entries` table
    - Column is decimal type to store hourly rates
    - Column is nullable to allow blank rates

  2. Notes
    - Existing entries will have null rate values
    - New entries can optionally specify a rate
    - Billable amount calculations will use entry-specific rates when available
*/

ALTER TABLE time_entries 
ADD COLUMN rate decimal(10,2);