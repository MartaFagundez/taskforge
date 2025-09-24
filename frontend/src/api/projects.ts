import { api } from './client';
import type { Project } from '../types';

export const listProjects = async (): Promise<Project[]> =>
  (await api.get('/projects')).data;
export const createProject = async (name: string): Promise<Project> =>
  (await api.post('/projects', { name })).data;
