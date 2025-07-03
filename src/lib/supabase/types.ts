export interface Customer {
  id: string;
  user_id: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  created_at: string;
}

export interface Project {
  id: string;
  user_id: string;
  customer_id: string;
  name: string;
  description?: string;
  status: string;
  created_at: string;
  customer?: Customer;
}

export interface Task {
  id: string;
  user_id: string;
  name: string;
  description?: string;
  status: string;
  created_at: string;
}

export interface TimeEntry {
  id: string;
  user_id: string;
  task_id: string;
  customer_id?: string;
  start_time: string;
  end_time?: string;
  description?: string;
  created_at: string;
  task?: Task;
  customer?: Customer;
  duration_minutes?: number;
  date?: string;
  billable?: boolean;
  rate?: number;
}
