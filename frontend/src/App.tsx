import { useEffect, useState } from 'react';
import {
  useMutation,
  useQuery,
  useQueryClient,
  keepPreviousData,
} from '@tanstack/react-query';
import type { Task, FilteredTasksResponse } from './api';
import {
  listProjects,
  createProject,
  listTasksByProject,
  createTask,
  toggleTask,
  deleteTask,
} from './api';

export default function App() {
  const qc = useQueryClient();

  // estado de UI
  const [selectedProject, setSelectedProject] = useState<number | null>(null);
  const [newProjectName, setNewProjectName] = useState('');
  const [title, setTitle] = useState('');
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<'all' | 'done' | 'pending'>('all');
  const [page, setPage] = useState(1);
  const limit = 10;

  // proyectos
  const projectsQ = useQuery({ queryKey: ['projects'], queryFn: listProjects });
  useEffect(() => {
    if (!selectedProject && projectsQ.data?.length) {
      setSelectedProject(projectsQ.data[0].id);
    }
  }, [projectsQ.data, selectedProject]);

  const createProjectMut = useMutation({
    mutationFn: (name: string) => createProject(name),
    onSuccess: (p) => {
      qc.invalidateQueries({ queryKey: ['projects'] });
      setSelectedProject(p.id);
      setNewProjectName('');
    },
  });

  // tasks (dependen de proyecto y filtros)
  const tasksQ = useQuery({
    enabled: !!selectedProject,
    queryKey: ['tasks', selectedProject, { q, status, page, limit }],
    queryFn: () =>
      listTasksByProject(selectedProject!, { q, status, page, limit }),
    placeholderData: keepPreviousData,
  });

  // mutations de tareas (usan el proyecto seleccionado)
  const createTaskMut = useMutation({
    mutationFn: (title: string) => createTask(selectedProject!, title),
    onSuccess: () =>
      qc.invalidateQueries({
        queryKey: ['tasks', selectedProject, { q, status, page, limit }],
      }),
  });

  const toggleMut = useMutation({
    mutationFn: (id: number) => toggleTask(id),
    onMutate: async (id) => {
      await qc.cancelQueries({
        queryKey: ['tasks', selectedProject, { q, status, page, limit }],
      });
      const prev = qc.getQueryData<FilteredTasksResponse>([
        'tasks',
        selectedProject,
        { q, status, page, limit },
      ]);
      if (prev) {
        qc.setQueryData(
          ['tasks', selectedProject, { q, status, page, limit }],
          {
            ...prev,
            items: prev.items.map((t: Task) =>
              t.id === id ? { ...t, done: !t.done } : t,
            ),
          },
        );
      }
      return { prev };
    },
    onError: (_e, _v, ctx) =>
      ctx?.prev &&
      qc.setQueryData(
        ['tasks', selectedProject, { q, status, page, limit }],
        ctx.prev,
      ),
    onSettled: () =>
      qc.invalidateQueries({
        queryKey: ['tasks', selectedProject, { q, status, page, limit }],
      }),
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => deleteTask(id),
    onMutate: async (id) => {
      await qc.cancelQueries({
        queryKey: ['tasks', selectedProject, { q, status, page, limit }],
      });
      const prev = qc.getQueryData<FilteredTasksResponse>([
        'tasks',
        selectedProject,
        { q, status, page, limit },
      ]);
      if (prev) {
        qc.setQueryData(
          ['tasks', selectedProject, { q, status, page, limit }],
          {
            ...prev,
            items: prev.items.filter((t: Task) => t.id !== id),
            total: prev.total - 1,
          },
        );
      }
      return { prev };
    },
    onError: (_e, _v, ctx) =>
      ctx?.prev &&
      qc.setQueryData(
        ['tasks', selectedProject, { q, status, page, limit }],
        ctx.prev,
      ),
    onSettled: () =>
      qc.invalidateQueries({
        queryKey: ['tasks', selectedProject, { q, status, page, limit }],
      }),
  });

  const onCreateTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProject || !title.trim()) return;
    createTaskMut.mutate(title.trim());
    setTitle('');
  };

  // UI
  return (
    <div style={{ maxWidth: 860, margin: '2rem auto', padding: '0 1rem' }}>
      <h1>TaskForge — V2</h1>

      {/* Proyectos */}
      <section
        style={{
          display: 'flex',
          gap: 12,
          alignItems: 'center',
          marginBottom: 16,
        }}
      >
        <label>
          Proyecto:{' '}
          <select
            value={selectedProject ?? ''}
            onChange={(e) => {
              setSelectedProject(Number(e.target.value));
              setPage(1);
            }}
          >
            {(projectsQ.data ?? []).map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (newProjectName.trim())
              createProjectMut.mutate(newProjectName.trim());
          }}
          style={{ display: 'flex', gap: 8 }}
        >
          <input
            placeholder="Nuevo proyecto…"
            value={newProjectName}
            onChange={(e) => setNewProjectName(e.target.value)}
          />
          <button type="submit">Crear</button>
        </form>
      </section>

      {/* Filtros */}
      <section
        style={{
          display: 'flex',
          gap: 12,
          alignItems: 'center',
          marginBottom: 16,
        }}
      >
        <input
          placeholder="Buscar por título…"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setPage(1);
          }}
          style={{ flex: 1, padding: 8 }}
        />
        <select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value as 'all' | 'done' | 'pending');
            setPage(1);
          }}
        >
          <option value="all">Todas</option>
          <option value="pending">Pendientes</option>
          <option value="done">Hechas</option>
        </select>
      </section>

      {/* Crear tarea */}
      <form
        onSubmit={onCreateTask}
        style={{ display: 'flex', gap: 8, marginBottom: 16 }}
      >
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Nueva tarea…"
          style={{ flex: 1, padding: 8 }}
        />
        <button type="submit" disabled={!selectedProject}>
          Agregar
        </button>
      </form>

      {/* Lista */}
      {tasksQ.isLoading && <p>Cargando…</p>}
      {tasksQ.isError && <p style={{ color: 'red' }}>Error al cargar tareas</p>}

      <ul
        style={{
          listStyle: 'none',
          padding: 0,
          display: 'grid',
          gap: 8,
          minHeight: 120,
        }}
      >
        {(tasksQ.data?.items ?? []).map((t) => (
          <li
            key={t.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: 8,
              border: '1px solid #ddd',
              borderRadius: 8,
              background: t.done ? '#f6fff6' : 'white',
            }}
          >
            <input
              type="checkbox"
              checked={t.done}
              onChange={() => toggleMut.mutate(t.id)}
            />
            <span
              style={{
                flex: 1,
                textDecoration: t.done ? 'line-through' : 'none',
              }}
            >
              {t.title}
            </span>
            <button
              onClick={() => deleteMut.mutate(t.id)}
              aria-label="Eliminar"
            >
              🗑️
            </button>
          </li>
        ))}
      </ul>

      {/* Paginación */}
      {tasksQ.data && tasksQ.data.pages > 1 && (
        <div
          style={{
            display: 'flex',
            gap: 8,
            marginTop: 16,
            alignItems: 'center',
          }}
        >
          <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            Anterior
          </button>
          <span>
            Página {tasksQ.data.page} de {tasksQ.data.pages}
          </span>
          <button
            disabled={page >= tasksQ.data.pages}
            onClick={() => setPage((p) => p + 1)}
          >
            Siguiente
          </button>
        </div>
      )}
    </div>
  );
}
