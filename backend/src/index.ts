import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import * as z from 'zod';
import { prisma } from './prisma';
import { Prisma } from '@prisma/client';

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
const IdParam = z.object({ id: z.coerce.number().int().positive() });
const CreateProject = z.object({
  name: z.string().min(1, 'El nombre es requerido'),
});

// Endpoints V2
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

const PORT = process.env.PORT ?? '3000';
app.listen(PORT, () => {
  console.log(`[backend] listening on http://localhost:${PORT}`);
});
