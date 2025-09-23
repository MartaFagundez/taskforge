import axios from 'axios';

export const api = axios.create({
  baseURL: 'http://localhost:3000',
  headers: { 'Content-Type': 'application/json' },
});

// Data types
export type Project = { id: number; name: string; createdAt: string };

export type Task = {
  id: number;
  title: string;
  done: boolean;
  createdAt: string;
  projectId: number;
};

export type TaskFilters = {
  status?: 'all' | 'done' | 'pending';
  q?: string;
  page?: number;
  limit?: number;
};

export type FilteredTasksResponse = {
  items: Task[];
  page: number;
  limit: number;
  total: number;
  pages: number;
};

export type Attachment = {
  id: number;
  taskId: number;
  key: string;
  originalName: string;
  contentType: string;
  size: number;
  createdAt: string;
};

// API functions
export const listProjects = async (): Promise<Project[]> =>
  (await api.get('/projects')).data;

export const createProject = async (name: string): Promise<Project> =>
  (await api.post('/projects', { name })).data;

export const listTasks = async (): Promise<Task[]> =>
  (await api.get('/tasks')).data;

export const createTask = async (
  projectId: number,
  title: string,
): Promise<Task> => (await api.post('/tasks', { title, projectId })).data;

export const toggleTask = async (id: number): Promise<Task> =>
  (await api.patch(`/tasks/${id}/toggle`)).data;

export const deleteTask = async (id: number): Promise<void> => {
  await api.delete(`/tasks/${id}`);
};

export const listTasksByProject = async (
  projectId: number,
  filters: TaskFilters = {},
): Promise<FilteredTasksResponse> => {
  const params = { status: 'all', page: 1, limit: 10, ...filters };
  return (await api.get(`/projects/${projectId}/tasks`, { params })).data;
};

export const presignUpload = async (body: {
  taskId: number;
  originalName: string;
  contentType: string;
  size: number;
}): Promise<{
  bucket: string;
  key: string;
  uploadUrl: string;
  headers: Record<string, string>;
}> => {
  return (await api.post('/attachments/presign', body)).data;
};

export const registerAttachment = async (body: {
  taskId: number;
  key: string;
  originalName: string;
  contentType: string;
  size: number;
}): Promise<Attachment> => {
  return (await api.post('/attachments/register', body)).data;
};

export async function listAttachments(taskId: number): Promise<Attachment[]> {
  return (await api.get(`/tasks/${taskId}/attachments`)).data;
}

export async function presignDownload(key: string): Promise<string> {
  return (await api.get('/attachments/download', { params: { key } })).data.url;
}

export async function deleteAttachment(id: number): Promise<void> {
  await api.delete(`/attachments/${id}`);
}
