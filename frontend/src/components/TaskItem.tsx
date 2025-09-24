import type { Task } from '../types';

export function TaskItem({
  task,
  onToggle,
  onDelete,
  children,
}: {
  task: Task;
  onToggle: (id: number) => void;
  onDelete: (id: number) => void;
  children?: React.ReactNode;
}) {
  return (
    <li
      className={`card p-3 flex items-center gap-5 ${task.done ? 'bg-green-50' : ''}`}
    >
      <input
        type="checkbox"
        checked={task.done}
        onChange={() => onToggle(task.id)}
        aria-label="Marcar como hecha / deshacer"
      />
      <span
        className={`flex-1 ${task.done ? 'line-through text-gray-500' : ''}`}
      >
        {task.title}
      </span>
      <button
        className="btn"
        onClick={() => onDelete(task.id)}
        aria-label="Eliminar"
      >
        🗑️
      </button>
      {children}
    </li>
  );
}
