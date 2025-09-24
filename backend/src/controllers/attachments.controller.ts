import { Request, Response } from 'express';
import { z } from 'zod';
import { IdParam } from '../schemas/tasks.schema';
import {
  PresignDownloadQuery,
  PresignUploadBody,
  RegisterBody,
} from '../schemas/attachments.schema';
import * as tasks from '../services/tasks.service';
import * as atts from '../services/attachments.service';
import { getDownloadUrl, getUploadUrl, S3_BUCKET } from '../lib/s3';
import { publishEventSafe } from '../lib/sns';

const allowedMime = (process.env.S3_ALLOWED_MIME || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

const isMimeAllowed = (mt: string) =>
  !allowedMime.length || allowedMime.includes(mt);

// POST /attachments/presign
export const postPresignUpload = async (req: Request, res: Response) => {
  const parsed = PresignUploadBody.safeParse(req.body);
  if (!parsed.success) {
    const { formErrors, fieldErrors } = z.flattenError(parsed.error);
    return res.status(400).json({ formErrors, fieldErrors });
  }
  const { taskId, originalName, contentType, size } = parsed.data;

  const task = await tasks.findTaskById(taskId);
  if (!task) return res.status(404).json({ error: 'Task no encontrada' });
  if (!isMimeAllowed(contentType)) {
    return res
      .status(400)
      .json({ error: `Content-Type no permitido (${contentType})` });
  }

  const ext = originalName.includes('.') ? originalName.split('.').pop() : '';
  const safeName = originalName.replace(/[^\w.\-]+/g, '_').slice(0, 80);
  const rand = Math.random().toString(16).slice(2, 10);
  const key = `projects/${task.projectId}/tasks/${taskId}/${Date.now()}_${rand}_${safeName}${ext ? '' : ''}`;

  const uploadUrl = await getUploadUrl(
    key,
    contentType || 'application/octet-stream',
    size,
  );

  res.json({
    bucket: S3_BUCKET,
    key,
    uploadUrl,
    headers: { 'Content-Type': contentType },
  });
};

// POST /attachments/register
export const postRegisterAttachment = async (req: Request, res: Response) => {
  const parsed = RegisterBody.safeParse(req.body);
  if (!parsed.success) {
    const { formErrors, fieldErrors } = z.flattenError(parsed.error);
    return res.status(400).json({ formErrors, fieldErrors });
  }
  const { taskId, key, originalName, contentType, size } = parsed.data;

  const task = await tasks.findTaskById(taskId);
  if (!task) return res.status(404).json({ error: 'Task no encontrada' });

  const attachment = await atts.registerAttachment({
    taskId,
    key,
    originalName,
    contentType,
    size,
  });

  void publishEventSafe('AttachmentAdded', {
    id: attachment.id,
    taskId,
    key,
    originalName,
    size,
    createdAt: attachment.createdAt,
  });

  res.status(201).json(attachment);
};

// GET /tasks/:id/attachments
export const getAttachmentsByTask = async (req: Request, res: Response) => {
  const parsed = IdParam.safeParse(req.params);
  if (!parsed.success)
    return res.status(400).json({ error: 'Parámetro id inválido' });

  const task = await tasks.findTaskById(parsed.data.id);
  if (!task) return res.status(404).json({ error: 'Task no encontrada' });

  const items = await atts.listAttachmentsByTask(parsed.data.id);
  res.json(items);
};

// GET /attachments/download?key=...
export const getPresignDownload = async (req: Request, res: Response) => {
  const parsed = PresignDownloadQuery.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ error: 'key requerida' });
  const url = await getDownloadUrl(parsed.data.key);
  res.json({ url });
};

// DELETE /attachments/:id
export const deleteAttachment = async (req: Request, res: Response) => {
  const parsed = IdParam.safeParse(req.params);
  if (!parsed.success)
    return res.status(400).json({ error: 'Parámetro id inválido' });

  const att = await atts.findAttachmentById(parsed.data.id);
  if (!att) return res.status(404).json({ error: 'Adjunto no encontrado' });

  const { deleteObject } = await import('../lib/s3'); // evita ciclos
  try {
    await deleteObject(att.key);
  } catch (e) {
    console.error('[DELETE attachment] S3 error', e);
    return res
      .status(502)
      .json({ error: 'No fue posible borrar el archivo en S3' });
  }

  await atts.deleteAttachmentById(parsed.data.id);

  void publishEventSafe('AttachmentDeleted', {
    id: parsed.data.id,
    deletedAt: new Date().toISOString(),
  });

  res.status(204).send();
};
