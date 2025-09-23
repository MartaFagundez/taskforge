import { z } from 'zod';

export const IdParam = z.object({ id: z.coerce.number().int().positive() });

export const CreateTask = z.object({
  title: z.string().min(1, 'El título es requerido'),
  projectId: z.number().int().positive('projectId inválido'),
});

export const ListTasksQuery = z.object({
  status: z.enum(['all', 'done', 'pending']).default('all'),
  q: z.string().trim().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
});
