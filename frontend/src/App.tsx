import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createTask, deleteTask, listTasks, toggleTask } from './api';
import type { Task } from './api';
import { useState } from 'react';

export default function App() {
  const qc = useQueryClient();
  const {
    data: tasks,
    isLoading,
    isError,
  } = useQuery({ queryKey: ['tasks'], queryFn: listTasks });
  const [title, setTitle] = useState('');

  const createMut = useMutation({
    mutationFn: (t: string) => createTask(t),
    onMutate: async (title) => {
      await qc.cancelQueries({ queryKey: ['tasks'] });
      const prev = qc.getQueryData<Task[]>(['tasks']) || [];
      const optimistic: Task = {
        id: Date.now(),
        title,
        done: false,
        createdAt: new Date().toISOString(),
      };
      qc.setQueryData(['tasks'], [optimistic, ...prev]);
      return { prev };
    },
    onError: (_e, _v, ctx) => ctx?.prev && qc.setQueryData(['tasks'], ctx.prev),
    onSettled: () => qc.invalidateQueries({ queryKey: ['tasks'] }),
  });

  const toggleMut = useMutation({
    mutationFn: (id: number) => toggleTask(id),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: ['tasks'] });
      const prev = qc.getQueryData<Task[]>(['tasks']) || [];
      qc.setQueryData<Task[]>(
        ['tasks'],
        prev.map((t) => (t.id === id ? { ...t, done: !t.done } : t)),
      );
      return { prev };
    },
    onError: (_e, _v, ctx) => ctx?.prev && qc.setQueryData(['tasks'], ctx.prev),
    onSettled: () => qc.invalidateQueries({ queryKey: ['tasks'] }),
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => deleteTask(id),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: ['tasks'] });
      const prev = qc.getQueryData<Task[]>(['tasks']) || [];
      qc.setQueryData<Task[]>(
        ['tasks'],
        prev.filter((t) => t.id !== id),
      );
      return { prev };
    },
    onError: (_e, _v, ctx) => ctx?.prev && qc.setQueryData(['tasks'], ctx.prev),
    onSettled: () => qc.invalidateQueries({ queryKey: ['tasks'] }),
  });

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (title.trim().length === 0) return;
    createMut.mutate(title.trim());
    setTitle('');
  };

  return (
    <div style={{ maxWidth: 720, margin: '2rem auto', padding: '0 1rem' }}>
      <h1>TaskForge — V1</h1>

      <form
        onSubmit={onSubmit}
        style={{ display: 'flex', gap: 8, marginBottom: 16 }}
      >
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Nueva tarea…"
          style={{ flex: 1, padding: 8 }}
        />
        <button type="submit">Agregar</button>
      </form>

      {isLoading && <p>Cargando…</p>}
      {isError && <p style={{ color: 'red' }}>Error al cargar tareas</p>}

      <ul style={{ listStyle: 'none', padding: 0, display: 'grid', gap: 8 }}>
        {(tasks || []).map((t) => (
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
              title="Marcar como hecha / deshacer"
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
    </div>
  );
}
