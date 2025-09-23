import { prisma } from '../lib/prisma';

export const listProjects = () =>
  prisma.project.findMany({ orderBy: { createdAt: 'desc' } });

export const createProject = (name: string) =>
  prisma.project.create({ data: { name } });

export const findProjectById = (id: number) =>
  prisma.project.findUnique({ where: { id } });
