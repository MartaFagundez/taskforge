import { api } from './client';
import type { Task, Paginated } from '../types';

export const listTasks = async (): Promise<Task[]> =>
  (await api.get('/tasks')).data;
export const createTask = async (
  projectId: number,
  title: string,
): Promise<Task> => (await api.post('/tasks', { title, projectId })).data;
export const toggleTask = async (id: number): Promise<Task> =>
  (await api.patch(`/tasks/${id}/toggle`)).data;
export const deleteTask = async (id: number): Promise<void> =>
  void (await api.delete(`/tasks/${id}`));

export type TaskFilters = {
  status?: 'all' | 'done' | 'pending';
  q?: string;
  page?: number;
  limit?: number;
};
export const listTasksByProject = async (
  projectId: number,
  filters: TaskFilters = {},
): Promise<Paginated<Task>> => {
  const params = { status: 'all', page: 1, limit: 10, ...filters };
  return (await api.get(`/projects/${projectId}/tasks`, { params })).data;
};
