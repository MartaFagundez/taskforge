import {
  useMutation,
  useQuery,
  useQueryClient,
  keepPreviousData,
} from '@tanstack/react-query';
import {
  createTask,
  deleteTask,
  listTasksByProject,
  toggleTask,
} from '../api/tasks';
import type { Task } from '../types';

export function useTasks(params: {
  projectId: number | null;
  q: string;
  status: 'all' | 'done' | 'pending';
  page: number;
  limit: number;
}) {
  const { projectId, q, status, page, limit } = params;
  const queryClient = useQueryClient();

  const tasksQuery = useQuery({
    enabled: !!projectId,
    queryKey: ['tasks', projectId, { q, status, page, limit }],
    queryFn: () => listTasksByProject(projectId!, { q, status, page, limit }),
    placeholderData: keepPreviousData,
  });

  const createMut = useMutation({
    mutationFn: (title: string) => createTask(projectId!, title),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: ['tasks', projectId, { q, status, page, limit }],
      }),
  });

  const toggleMut = useMutation({
    mutationFn: (id: number) => toggleTask(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({
        queryKey: ['tasks', projectId, { q, status, page, limit }],
      });
      const prev = queryClient.getQueryData<any>([
        'tasks',
        projectId,
        { q, status, page, limit },
      ]);
      if (prev)
        queryClient.setQueryData(
          ['tasks', projectId, { q, status, page, limit }],
          {
            ...prev,
            items: prev.items.map((t: Task) =>
              t.id === id ? { ...t, done: !t.done } : t,
            ),
          },
        );
      return { prev };
    },
    onError: (_e, _v, ctx) =>
      ctx?.prev &&
      queryClient.setQueryData(
        ['tasks', projectId, { q, status, page, limit }],
        ctx.prev,
      ),
    onSettled: () =>
      queryClient.invalidateQueries({
        queryKey: ['tasks', projectId, { q, status, page, limit }],
      }),
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => deleteTask(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({
        queryKey: ['tasks', projectId, { q, status, page, limit }],
      });
      const prev = queryClient.getQueryData<any>([
        'tasks',
        projectId,
        { q, status, page, limit },
      ]);
      if (prev)
        queryClient.setQueryData(
          ['tasks', projectId, { q, status, page, limit }],
          {
            ...prev,
            items: prev.items.filter((t: Task) => t.id !== id),
            total: prev.total - 1,
          },
        );
      return { prev };
    },
    onError: (_e, _v, ctx) =>
      ctx?.prev &&
      queryClient.setQueryData(
        ['tasks', projectId, { q, status, page, limit }],
        ctx.prev,
      ),
    onSettled: () =>
      queryClient.invalidateQueries({
        queryKey: ['tasks', projectId, { q, status, page, limit }],
      }),
  });

  return { tasksQuery, createMut, toggleMut, deleteMut };
}
