export type Project = { id: number; name: string; createdAt: string };
export type Task = {
  id: number;
  title: string;
  done: boolean;
  createdAt: string;
  projectId: number;
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
export type Paginated<T> = {
  items: T[];
  page: number;
  limit: number;
  total: number;
  pages: number;
};
