import { useEffect, useState } from 'react';
import { useProjects } from '../hooks/useProjects';
import { useTasks } from '../hooks/useTasks';
import { ProjectSelect } from '../components/ProjectSelect';
import { FiltersBar } from '../components/FiltersBar';
import { TaskList } from '../components/TaskList';

export default function TasksPage() {
  const [selectedProject, setSelectedProject] = useState<number | null>(null);
  const [newProjectName, setNewProjectName] = useState('');
  const [title, setTitle] = useState('');
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<'all' | 'done' | 'pending'>('all');
  const [page, setPage] = useState(1);
  const limit = 10;

  const { projectsQuery, createMut } = useProjects();

  useEffect(() => {
    if (!selectedProject && projectsQuery.data?.length) {
      setSelectedProject(projectsQuery.data[0].id);
    }
  }, [projectsQuery.data, selectedProject]);

  const {
    tasksQuery,
    createMut: createTaskMut,
    toggleMut,
    deleteMut,
  } = useTasks({ projectId: selectedProject, q, status, page, limit });

  return (
    <div className="container py-6">
      <h1 className="text-2xl font-semibold mb-4">TaskForge — V3.3</h1>

      <section className="flex flex-wrap items-center gap-3 mb-4">
        <ProjectSelect
          projects={projectsQuery.data ?? []}
          value={selectedProject}
          onChange={(id) => {
            setSelectedProject(id);
            setPage(1);
          }}
        />

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (newProjectName.trim()) {
              createMut.mutate(newProjectName.trim());
              setNewProjectName('');
            }
          }}
          className="flex items-center gap-2"
        >
          <input
            className="input"
            placeholder="Nuevo proyecto…"
            value={newProjectName}
            onChange={(e) => setNewProjectName(e.target.value)}
          />
          <button className="btn" type="submit">
            Crear
          </button>
        </form>
      </section>

      <FiltersBar
        query={q}
        setQuery={(v) => {
          setQ(v);
          setPage(1);
        }}
        status={status}
        setStatus={(v) => {
          setStatus(v);
          setPage(1);
        }}
      />

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (selectedProject && title.trim()) {
            createTaskMut.mutate(title.trim());
            setTitle('');
          }
        }}
        className="flex items-center gap-2 mb-4"
      >
        <input
          className="input flex-1"
          placeholder="Nueva tarea…"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <button
          className="btn btn-primary"
          type="submit"
          disabled={!selectedProject}
        >
          Agregar
        </button>
      </form>

      {tasksQuery.isLoading && <p>Cargando…</p>}
      {tasksQuery.isError && (
        <p className="text-red-600">Error al cargar tareas</p>
      )}

      <TaskList
        items={tasksQuery.data?.items ?? []}
        onToggle={(id) => toggleMut.mutate(id)}
        onDelete={(id) => deleteMut.mutate(id)}
      />

      {tasksQuery.data && tasksQuery.data.pages > 1 && (
        <div className="flex items-center gap-3 mt-4">
          <button
            className="btn"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            Anterior
          </button>
          <span className="text-sm text-gray-600">
            Página {tasksQuery.data.page} de {tasksQuery.data.pages}
          </span>
          <button
            className="btn"
            disabled={page >= tasksQuery.data.pages}
            onClick={() => setPage((p) => p + 1)}
          >
            Siguiente
          </button>
        </div>
      )}
    </div>
  );
}
