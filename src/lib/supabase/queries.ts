import { supabase } from './client';
import type { TimeEntry, Customer, Project, Task } from './types';

export async function getTimeEntries(userId: string) {
  const { data, error } = await supabase
    .from('time_entries')
    .select(`
      *,
      task:tasks(id, name),
      customer:customers(id, name)
    `)
    .eq('user_id', userId)
    .order('start_time', { ascending: false });

  if (error) throw error;
  return data;
}

export async function getTimeEntriesWithDetails(userId: string) {
  const { data, error } = await supabase
    .from('time_entries')
    .select(`
      *,
      task:tasks(id, name),
      customer:customers(id, name)
    `)
    .eq('user_id', userId)
    .order('start_time', { ascending: false });

  if (error) throw error;
  return data;
}

export async function getCustomers(userId: string) {
  const { data, error } = await supabase
    .from('customers')
    .select('*')
    .eq('user_id', userId)
    .order('name');

  if (error) throw error;
  return data;
}

export async function getProjects(userId: string) {
  const { data, error } = await supabase
    .from('projects')
    .select(`
      *,
      customer:customers(id, name)
    `)
    .eq('user_id', userId)
    .order('name');

  if (error) throw error;
  return data;
}

export async function getTasks(userId: string) {
  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('user_id', userId)
    .order('name');

  if (error) throw error;
  return data;
}

export async function createTimeEntry(entry: Omit<TimeEntry, 'id' | 'created_at'>) {
  const { data, error } = await supabase
    .from('time_entries')
    .insert(entry)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateTimeEntry(id: string, updates: Partial<TimeEntry>) {
  const { data, error } = await supabase
    .from('time_entries')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteTimeEntry(id: string) {
  const { error } = await supabase
    .from('time_entries')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

export async function createCustomer(customer: Omit<Customer, 'id' | 'created_at'>) {
  const { data, error } = await supabase
    .from('customers')
    .insert(customer)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function createProject(project: Omit<Project, 'id' | 'created_at'>) {
  const { data, error } = await supabase
    .from('projects')
    .insert(project)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function createTask(task: Omit<Task, 'id' | 'created_at'>) {
  const { data, error } = await supabase
    .from('tasks')
    .insert(task)
    .select()
    .single();

  if (error) throw error;
  return data;
}

// Fix remaining time entries without customer attribution
export async function fixTimeEntryCustomerAttribution(userId: string) {
  // Get the "Det Mindre Bureau" customer ID for this user
  const { data: customer, error: customerError } = await supabase
    .from('customers')
    .select('id')
    .eq('user_id', userId)
    .eq('name', 'Det Mindre Bureau')
    .single();

  if (customerError || !customer) {
    throw new Error('Could not find Det Mindre Bureau customer');
  }

  // Update any remaining time entries without customer_id
  const { error: updateError } = await supabase
    .from('time_entries')
    .update({ customer_id: customer.id })
    .eq('user_id', userId)
    .is('customer_id', null);

  if (updateError) throw updateError;

  return { success: true };
}
