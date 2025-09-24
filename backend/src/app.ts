import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import healthRoutes from './routes/health.routes';
import projectsRoutes from './routes/projects.routes';
import tasksRoutes from './routes/tasks.routes';
import attachmentsRoutes from './routes/attachments.routes';
import { errorMiddleware } from './middlewares/error';
import { correlation } from './middlewares/correlation';

export function createApp() {
  const app = express();
  app.use(cors({ origin: process.env.CORS_ORIGIN }));
  app.use(express.json());
  // Correlation ID middleware (for logging and tracing)
  app.use(correlation);

  app.use(healthRoutes);
  app.use('/projects', projectsRoutes);
  app.use('/tasks', tasksRoutes);
  app.use('/attachments', attachmentsRoutes);

  // Error handler
  app.use(errorMiddleware);

  return app;
}
