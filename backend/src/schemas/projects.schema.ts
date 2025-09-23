import { z } from 'zod';

export const CreateProject = z.object({
  name: z.string().min(1, 'El nombre es requerido'),
});
