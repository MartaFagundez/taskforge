import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import * as z from 'zod';
import { prisma } from './prisma';
import { Prisma } from '@prisma/client';
import { getUploadUrl, getDownloadUrl, deleteObject, S3_BUCKET } from './s3';
import crypto from 'crypto';

const app = express();
app.use(cors({ origin: 'http://localhost:5173' }));
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'taskforge-backend',
    ts: new Date().toISOString(),
  });
});

// Zod schemas
const CreateTask = z.object({
  title: z.string().min(1, 'El título es requerido'),
  projectId: z.number().int().positive('projectId inválido'),
});
const ListTasksQuery = z.object({
  status: z.enum(['all', 'done', 'pending']).default('all'),
  q: z.string().trim().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
});
const IdParam = z.object({ id: z.coerce.number().int().positive() });
const CreateProject = z.object({
  name: z.string().min(1, 'El nombre es requerido'),
});
const PresignUploadBody = z.object({
  taskId: z.number().int().positive(),
  originalName: z.string().min(1),
  contentType: z.string().min(1),
  size: z
    .number()
    .int()
    .positive()
    .max(parseInt(process.env.S3_UPLOAD_MAX_BYTES || '5242880')),
});
const PresignDownloadQuery = z.object({
  key: z.string().min(1),
});
const RegisterBody = z.object({
  taskId: z.number().int().positive(),
  key: z.string().min(1),
  originalName: z.string().min(1),
  contentType: z.string().min(1),
  size: z.number().int().positive(),
});

// Whitelist de MIME
const allowedMime = (process.env.S3_ALLOWED_MIME || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
function isMimeAllowed(mt: string) {
  return allowedMime.length === 0 || allowedMime.includes(mt);
}

// Endpoints
// Listar proyectos
app.get('/projects', async (_req, res) => {
  try {
    const projects = await prisma.project.findMany({
      orderBy: { createdAt: 'desc' },
    });
    res.json(projects);
  } catch (err) {
    console.error('[GET /projects] error', err);
    return res.status(500).json({ error: 'Error interno' });
  }
});

// Crear proyecto
app.post('/projects', async (req, res) => {
  const parsed = CreateProject.safeParse(req.body);
  if (!parsed.success) {
    const { formErrors, fieldErrors } = z.flattenError(parsed.error);
    // formErrors: errores a nivel de formulario (path: [])
    // fieldErrors: mapa de campo -> string[]
    return res.status(400).json({ formErrors, fieldErrors });
  }
  try {
    const project = await prisma.project.create({
      data: { name: parsed.data.name },
    });
    res.status(201).json(project);
  } catch (err) {
    console.error('[POST /projects] error', err);
    return res.status(500).json({ error: 'Error interno' });
  }
});

// Listar tareas de un proyecto con filtros y paginación
app.get('/projects/:id/tasks', async (req, res) => {
  const projectId = Number(req.params.id);
  if (!Number.isInteger(projectId) || projectId <= 0)
    return res.status(400).json({ error: 'projectId inválido' });

  const parsed = ListTasksQuery.safeParse(req.query);
  if (!parsed.success) {
    const { formErrors, fieldErrors } = z.flattenError(parsed.error);
    return res.status(400).json({
      error: 'Parámetros de consulta inválidos',
      formErrors,
      fieldErrors,
    });
  }
  const qp = parsed.data;

  // Construimos el filtro dinámicamente
  const where: any = { projectId };
  if (qp.status === 'done') where.done = true;
  if (qp.status === 'pending') where.done = false;
  // En mis pruebas verifico que contains es case-insensitive en SQLite, aunque la documentación especifica lo contario: https://www.prisma.io/docs/orm/prisma-client/queries/case-sensitivity#sqlite-provider
  // Al momento de migrar a postrgre habrá que verificar este comportamiento
  if (qp.q) where.title = { contains: qp.q };

  try {
    const projectExists = await prisma.project.findUnique({
      where: { id: projectId },
    });
    if (!projectExists) {
      return res.status(404).json({ error: 'Proyecto no encontrado' });
    }

    // Primero obtenemos el total para validar la página
    const total = await prisma.task.count({ where });
    const maxPages = Math.ceil(total / qp.limit);

    // Si se solicita una página que no existe
    if (qp.page > 1 && qp.page > maxPages) {
      return res.status(404).json({
        error: `Página ${qp.page} no existe. Páginas disponibles: 1-${maxPages > 0 ? maxPages : 1}`,
      });
    }

    const skip = (qp.page - 1) * qp.limit;
    const items = await prisma.task.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: qp.limit,
    });

    res.json({
      items,
      page: qp.page,
      limit: qp.limit,
      total,
      pages: maxPages,
    });
  } catch (err) {
    console.error('[GET /projects/:id/tasks] error', err);
    return res.status(500).json({ error: 'Error interno' });
  }
});

// Listar tareas
app.get('/tasks', async (_req, res) => {
  try {
    const tasks = await prisma.task.findMany({
      orderBy: { createdAt: 'desc' },
    });
    return res.json(tasks);
  } catch (err) {
    console.error('[GET /tasks] error', err);
    return res.status(500).json({ error: 'Error interno' });
  }
});

// Crear tarea
app.post('/tasks', async (req, res) => {
  const parsed = CreateTask.safeParse(req.body);
  if (!parsed.success) {
    const { formErrors, fieldErrors } = z.flattenError(parsed.error);
    return res.status(400).json({ formErrors, fieldErrors });
  }

  try {
    const projectExists = await prisma.project.findUnique({
      where: { id: parsed.data.projectId },
    });
    if (!projectExists) {
      return res.status(400).json({
        error: 'El projectId no corresponde a un proyecto existente',
      });
    }

    const task = await prisma.task.create({
      data: { title: parsed.data.title, projectId: parsed.data.projectId },
    });
    return res.status(201).json(task);
  } catch (err) {
    console.error('[POST /tasks] error', err);
    return res.status(500).json({ error: 'Error interno' });
  }
});

// Alternar done
app.patch('/tasks/:id/toggle', async (req, res) => {
  const parsed = IdParam.safeParse(req.params);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Parámetro id inválido' });
  }
  const { id } = parsed.data;

  try {
    // Leemos el estado actual (si no existe, devolveremos 404)
    const current = await prisma.task.findUnique({ where: { id } });
    if (!current) return res.status(404).json({ error: 'Task no encontrada' });

    const task = await prisma.task.update({
      where: { id },
      data: { done: !current.done },
    });

    return res.json(task);
  } catch (err) {
    // Si hubo una carrera y alguien la borró entre el find y el update
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === 'P2025'
    ) {
      return res.status(404).json({ error: 'Task no encontrada' });
    }
    console.error('[PATCH /tasks/:id/toggle] error', err);
    return res.status(500).json({ error: 'Error interno' });
  }
});

// Eliminar tarea
app.delete('/tasks/:id', async (req, res) => {
  const parsed = IdParam.safeParse(req.params);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Parámetro id inválido' });
  }
  const { id } = parsed.data;

  try {
    await prisma.task.delete({ where: { id } });
    return res.status(204).send();
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === 'P2025'
    ) {
      return res.status(404).json({ error: 'Task no encontrada' });
    }
    console.error('[DELETE /tasks/:id] error', err);
    return res.status(500).json({ error: 'Error interno' });
  }
});

// Presign de subida
// Devuelve la URL firmada y la key que se usará para subir
app.post('/attachments/presign', async (req, res) => {
  const parsed = PresignUploadBody.safeParse(req.body);
  if (!parsed.success) {
    const { formErrors, fieldErrors } = z.flattenError(parsed.error);
    return res.status(400).json({ formErrors, fieldErrors });
  }
  const { taskId, originalName, contentType, size } = parsed.data;

  try {
    // verificar que task existe
    const task = await prisma.task.findUnique({ where: { id: taskId } });
    if (!task) return res.status(404).json({ error: 'Task no encontrada' });

    if (!isMimeAllowed(contentType)) {
      return res
        .status(400)
        .json({ error: `Content-Type no permitido (${contentType})` });
    }

    // Generar key única y “ordenada” por proyecto/tarea
    //const ext = originalName.includes('.') ? originalName.split('.').pop() : '';
    const safeName = originalName.replace(/[^\w.\-]+/g, '_').slice(0, 80);
    const rand = crypto.randomBytes(8).toString('hex');
    const key = `projects/${task.projectId}/tasks/${taskId}/${Date.now()}_${rand}_${safeName}`;

    const url = await getUploadUrl(key, contentType, size);

    return res.json({
      bucket: S3_BUCKET,
      key,
      uploadUrl: url,
      // el cliente necesita usar estos headers al hacer el PUT a S3 (para que coincida con la firma)
      headers: { 'Content-Type': contentType },
    });
  } catch (err) {
    console.error('[POST /attachments/presign] error', err);
    return res.status(500).json({ error: 'Error interno' });
  }
});

// Registrar metadatos (después de subir a S3)
app.post('/attachments/register', async (req, res) => {
  const parsed = RegisterBody.safeParse(req.body);
  if (!parsed.success) {
    const { formErrors, fieldErrors } = z.flattenError(parsed.error);
    return res.status(400).json({ formErrors, fieldErrors });
  }
  const { taskId, key, originalName, contentType, size } = parsed.data;

  try {
    const task = await prisma.task.findUnique({ where: { id: taskId } });
    if (!task) return res.status(404).json({ error: 'Task no encontrada' });

    const attachment = await prisma.attachment.create({
      data: { taskId, key, originalName, contentType, size },
    });
    return res.status(201).json(attachment);
  } catch (err) {
    console.error('[POST /attachments/register] error', err);
    return res.status(500).json({ error: 'Error interno' });
  }
});

// Listar adjuntos de una tarea
app.get('/tasks/:id/attachments', async (req, res) => {
  const parsed = IdParam.safeParse(req.params);
  if (!parsed.success)
    return res.status(400).json({ error: 'Parámetro id inválido' });
  const { id } = parsed.data;

  try {
    const task = await prisma.task.findUnique({ where: { id } });
    if (!task) return res.status(404).json({ error: 'Task no encontrada' });

    const items = await prisma.attachment.findMany({
      where: { taskId: id },
      orderBy: { createdAt: 'desc' },
    });
    return res.json(items);
  } catch (err) {
    console.error('[GET /tasks/:id/attachments] error', err);
    return res.status(500).json({ error: 'Error interno' });
  }
});

// Presign de descarga (link temporal para descargar desde S3)
app.get('/attachments/download', async (req, res) => {
  const parsed = PresignDownloadQuery.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ error: 'key requerida' });
  const { key } = parsed.data;

  try {
    // Verificar que la key exista en la tabla Attachment
    const exists = await prisma.attachment.findFirst({ where: { key } });
    if (!exists)
      return res.status(404).json({ error: 'Adjunto no registrado' });

    const url = await getDownloadUrl(key);
    return res.json({ url });
  } catch (err) {
    console.error('[GET /attachments/download] error', err);
    return res.status(500).json({ error: 'Error interno' });
  }
});

// Eliminar un adjunto (S3 + DB)
app.delete('/attachments/:id', async (req, res) => {
  const parsed = IdParam.safeParse(req.params);
  if (!parsed.success)
    return res.status(400).json({ error: 'Parámetro id inválido' });
  const { id } = parsed.data;

  try {
    const att = await prisma.attachment.findUnique({ where: { id } });
    if (!att) return res.status(404).json({ error: 'Adjunto no encontrado' });

    // 1) Borrar en S3 (idempotente: si no existe, S3 no rompe)
    try {
      await deleteObject(att.key);
    } catch (e) {
      // Si S3 falla, corta y reporta; evita orfandad de archivo
      console.error('[DELETE S3 object] error', e);
      return res
        .status(502)
        .json({ error: 'No fue posible borrar el archivo en S3' });
    }

    // 2) Borrar metadatos en DB
    await prisma.attachment.delete({ where: { id } });

    return res.status(204).send();
  } catch (err) {
    console.error('[DELETE /attachments/:id] error', err);
    return res.status(500).json({ error: 'Error interno' });
  }
});

const PORT = process.env.PORT ?? '3000';
app.listen(PORT, () => {
  console.log(`[backend] listening on http://localhost:${PORT}`);
});
