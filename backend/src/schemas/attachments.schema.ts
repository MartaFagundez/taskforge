import { z } from 'zod';

export const PresignUploadBody = z.object({
  taskId: z.number().int().positive(),
  originalName: z.string().min(1),
  contentType: z.string().min(1),
  size: z
    .number()
    .int()
    .positive()
    .max(parseInt(process.env.S3_UPLOAD_MAX_BYTES || '5242880')),
});

export const RegisterBody = z.object({
  taskId: z.number().int().positive(),
  key: z.string().min(1),
  originalName: z.string().min(1),
  contentType: z.string().min(1),
  size: z.number().int().positive(),
});

export const PresignDownloadQuery = z.object({
  key: z.string().min(1),
});
