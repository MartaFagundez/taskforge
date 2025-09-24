import { Request, Response } from 'express';
import { z } from 'zod';
import { CreateTask, IdParam, ListTasksQuery } from '../schemas/tasks.schema';
import * as projects from '../services/projects.service';
import * as tasks from '../services/tasks.service';
import { deleteObjects } from '../lib/s3';
import { publishEventSafe } from '../lib/sns';

// GET /tasks
export const getTasks = async (_req: Request, res: Response) => {
  const list = await tasks.listAllTasks();
  res.json(list);
};

// POST /tasks
export const postTask = async (req: Request, res: Response) => {
  const parsed = CreateTask.safeParse(req.body);
  if (!parsed.success) {
    const { formErrors, fieldErrors } = z.flattenError(parsed.error);
    return res.status(400).json({ formErrors, fieldErrors });
  }

  const project = await projects.findProjectById(parsed.data.projectId);
  if (!project) {
    return res
      .status(400)
      .json({ error: 'El projectId no corresponde a un proyecto existente' });
  }

  const created = await tasks.createTask(
    parsed.data.title,
    parsed.data.projectId,
  );

  void publishEventSafe('TaskCreated', {
    id: created.id,
    title: created.title,
    projectId: created.projectId,
    done: created.done,
    createdAt: created.createdAt,
  });

  res.status(201).json(created);
};

// PATCH /tasks/:id/toggle
export const patchToggleTask = async (req: Request, res: Response) => {
  const parsed = IdParam.safeParse(req.params);
  if (!parsed.success)
    return res.status(400).json({ error: 'Parámetro id inválido' });

  const updated = await tasks.toggleTask(parsed.data.id);
  if (!updated) return res.status(404).json({ error: 'Task no encontrada' });

  void publishEventSafe('TaskUpdated', {
    id: updated.id,
    done: updated.done,
    projectId: updated.projectId,
    updatedAt: new Date().toISOString(),
  });

  res.json(updated);
};

// DELETE /tasks/:id  (con cleanup S3)
export const deleteTask = async (req: Request, res: Response) => {
  const parsed = IdParam.safeParse(req.params);
  if (!parsed.success)
    return res.status(400).json({ error: 'Parámetro id inválido' });
  const id = parsed.data.id;

  const found = await tasks.findTaskById(id);
  if (!found) return res.status(404).json({ error: 'Task no encontrada' });

  // borrar primero en S3
  const keys = await tasks.listAttachmentKeysByTask(id);
  if (keys.length) {
    try {
      await deleteObjects(keys);
    } catch (e) {
      console.error('[DELETE /tasks/:id] S3 bulk delete error', e);
      return res
        .status(502)
        .json({ error: 'No fue posible borrar archivos en S3' });
    }
  }

  await tasks.deleteTask(id);

  void publishEventSafe('TaskDeleted', {
    id,
    deletedAt: new Date().toISOString(),
  });

  res.status(204).send();
};

// GET /projects/:id/tasks (filtros+paginación)
export const getTasksByProject = async (req: Request, res: Response) => {
  const projectId = Number(req.params.id);
  if (!Number.isInteger(projectId) || projectId <= 0) {
    return res.status(400).json({ error: 'projectId inválido' });
  }

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

  const project = await projects.findProjectById(projectId);
  if (!project)
    return res.status(404).json({ error: 'Proyecto no encontrado' });

  const where: any = { projectId };
  if (qp.status === 'done') where.done = true;
  if (qp.status === 'pending') where.done = false;
  if (qp.q) where.title = { contains: qp.q }; // al migrar a PG evaluar mode:'insensitive'

  const total = await tasks.countTasks(where);
  const pages = Math.ceil(total / qp.limit) || 1;
  if (qp.page > 1 && qp.page > pages) {
    return res.status(404).json({
      error: `Página ${qp.page} no existe. Páginas disponibles: 1-${pages}`,
    });
  }

  const skip = (qp.page - 1) * qp.limit;
  const items = await tasks.listTasks({ where, skip, take: qp.limit });

  res.json({ items, page: qp.page, limit: qp.limit, total, pages });
};
