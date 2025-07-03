/*
  # Create indexes for time tracking app

  1. Indexes
    - Add indexes on foreign keys for better query performance
    - Add indexes on frequently queried columns

  2. Purpose
    - Improve query performance for common operations
    - Optimize filtering and sorting operations
*/

-- Add indexes on customers table
CREATE INDEX IF NOT EXISTS customers_user_id_idx ON customers (user_id);

-- Add indexes on projects table
CREATE INDEX IF NOT EXISTS projects_user_id_idx ON projects (user_id);
CREATE INDEX IF NOT EXISTS projects_customer_id_idx ON projects (customer_id);

-- Add indexes on tasks table
CREATE INDEX IF NOT EXISTS tasks_user_id_idx ON tasks (user_id);
CREATE INDEX IF NOT EXISTS tasks_project_id_idx ON tasks (project_id);

-- Add indexes on time_entries table
CREATE INDEX IF NOT EXISTS time_entries_user_id_idx ON time_entries (user_id);
CREATE INDEX IF NOT EXISTS time_entries_task_id_idx ON time_entries (task_id);
CREATE INDEX IF NOT EXISTS time_entries_start_time_idx ON time_entries (start_time);
CREATE INDEX IF NOT EXISTS time_entries_end_time_idx ON time_entries (end_time);
