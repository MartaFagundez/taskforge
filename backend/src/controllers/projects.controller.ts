import { Request, Response } from 'express';
import { z } from 'zod';
import { CreateProject } from '../schemas/projects.schema';
import * as svc from '../services/projects.service';

export const getProjects = async (_req: Request, res: Response) => {
  const projects = await svc.listProjects();
  res.json(projects);
};

export const postProject = async (req: Request, res: Response) => {
  const parsed = CreateProject.safeParse(req.body);
  if (!parsed.success) {
    const { formErrors, fieldErrors } = z.flattenError(parsed.error);
    return res.status(400).json({ formErrors, fieldErrors });
  }
  const project = await svc.createProject(parsed.data.name);
  res.status(201).json(project);
};
