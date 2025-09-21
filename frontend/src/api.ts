import axios from 'axios';

export const api = axios.create({
  baseURL: 'http://localhost:3000',
  headers: { 'Content-Type': 'application/json' },
});

export type Task = {
  id: number;
  title: string;
  done: boolean;
  createdAt: string;
};

export const listTasks = async (): Promise<Task[]> =>
  (await api.get('/tasks')).data;
export const createTask = async (title: string): Promise<Task> =>
  (await api.post('/tasks', { title })).data;
export const toggleTask = async (id: number): Promise<Task> =>
  (await api.patch(`/tasks/${id}/toggle`)).data;
export const deleteTask = async (id: number): Promise<void> => {
  await api.delete(`/tasks/${id}`);
};
