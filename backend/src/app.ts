import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import healthRoutes from './routes/health.routes';
import projectsRoutes from './routes/projects.routes';
import tasksRoutes from './routes/tasks.routes';
import attachmentsRoutes from './routes/attachments.routes';
import { errorMiddleware } from './middlewares/error';

export function createApp() {
  const app = express();
  app.use(cors({ origin: process.env.CORS_ORIGIN }));
  app.use(express.json());

  app.use(healthRoutes);
  app.use('/projects', projectsRoutes);
  app.use('/tasks', tasksRoutes);
  app.use('/attachments', attachmentsRoutes);

  // Error handler
  app.use(errorMiddleware);

  return app;
}
