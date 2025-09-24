import { api } from './client';
import type { Attachment } from '../types';

export const listAttachments = async (taskId: number): Promise<Attachment[]> =>
  (await api.get(`/tasks/${taskId}/attachments`)).data;

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
}> => (await api.post('/attachments/presign', body)).data;

export const registerAttachment = async (body: {
  taskId: number;
  key: string;
  originalName: string;
  contentType: string;
  size: number;
}): Promise<Attachment> => (await api.post('/attachments/register', body)).data;

export const presignDownload = async (key: string): Promise<string> =>
  (await api.get('/attachments/download', { params: { key } })).data.url;

export const deleteAttachment = async (id: number): Promise<void> =>
  void (await api.delete(`/attachments/${id}`));
