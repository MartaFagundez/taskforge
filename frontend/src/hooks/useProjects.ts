import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createProject, listProjects } from '../api/projects';
import type { Project } from '../types';

export function useProjects() {
  const queryClient = useQueryClient();
  const projectsQuery = useQuery<Project[]>({
    queryKey: ['projects'],
    queryFn: listProjects,
  });
  const createMut = useMutation<Project, Error, string>({
    mutationFn: (name: string) => createProject(name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
  });
  return { projectsQuery, createMut };
}
