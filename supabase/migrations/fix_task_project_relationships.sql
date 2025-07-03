/*
  # Fix task-project relationships
  
  1. Changes
    - Update existing tasks to link them to appropriate projects
    - Ensure all tasks have valid project_id references
    - Fix the "Unknown" customer issue in reports
  
  2. Strategy
    - Link tasks to projects based on logical relationships
    - Use existing project names to match with task purposes
    - Ensure all tasks belong to projects under "Det Mindre Bureau" since that's where the time entries are
*/

-- Update tasks to link them to appropriate projects
-- First, let's link "Fakturering" task to the "Fakturering" project
UPDATE tasks 
SET project_id = (
  SELECT p.id 
  FROM projects p 
  WHERE p.name = 'Fakturering' 
  AND p.user_id = tasks.user_id
)
WHERE name = 'Fakturering' 
AND project_id IS NULL;

-- Link "Salg" and "Marketing" tasks to "DMB produktudvikling" project (sales/marketing related)
UPDATE tasks 
SET project_id = (
  SELECT p.id 
  FROM projects p 
  WHERE p.name = 'DMB produktudvikling' 
  AND p.user_id = tasks.user_id
)
WHERE name IN ('Salg', 'Marketing') 
AND project_id IS NULL;

-- Link "Diverse" and "Strategi" tasks to "DMB Bogholderi 2025" project (general business tasks)
UPDATE tasks 
SET project_id = (
  SELECT p.id 
  FROM projects p 
  WHERE p.name = 'DMB Bogholderi 2025' 
  AND p.user_id = tasks.user_id
)
WHERE name IN ('Diverse', 'Strategi') 
AND project_id IS NULL;

-- If any tasks still don't have project_id, link them to the first available DMB project
UPDATE tasks 
SET project_id = (
  SELECT p.id 
  FROM projects p 
  JOIN customers c ON p.customer_id = c.id
  WHERE c.name = 'Det Mindre Bureau' 
  AND p.user_id = tasks.user_id
  LIMIT 1
)
WHERE project_id IS NULL;