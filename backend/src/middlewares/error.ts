import type { ErrorRequestHandler } from 'express';
import { Prisma } from '@prisma/client';
import { ZodError, flattenError } from 'zod';

// Respuesta de error uniforme
export const errorMiddleware: ErrorRequestHandler = (err, req, res, _next) => {
  // Prisma errors
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    switch (err.code) {
      case 'P2025':
        return res.status(404).json({ error: 'Recurso no encontrado' });
      case 'P2002':
        return res.status(409).json({ error: 'Recurso ya existe' });
      default:
        console.error('[PRISMA ERROR]', err.code, err.message);
        return res.status(500).json({ error: 'Error interno' });
    }
  }

  // Zod errors: si por algún motivo llega aquí (normalmente devolvemos 400 antes)
  if (err instanceof ZodError) {
    const { formErrors, fieldErrors } = flattenError(err);
    return res.status(400).json({
      error: 'Datos inválidos',
      formErrors,
      fieldErrors,
    });
  }

  // Log error with request context
  console.error('[ERROR]', {
    message: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    timestamp: new Date().toISOString(),
  });

  return res.status(500).json({ error: 'Error interno' });
};
