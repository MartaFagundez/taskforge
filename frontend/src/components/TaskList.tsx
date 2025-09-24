import type { Task } from '../types';
import { TaskItem } from './TaskItem';
import { AttachmentWidget } from './AttachmentWidget';

export function TaskList({
  items,
  onToggle,
  onDelete,
}: {
  items: Task[];
  onToggle: (id: number) => void;
  onDelete: (id: number) => void;
}) {
  return (
    <ul className="space-y-2 min-h-[120px]">
      {items.map((t) => (
        <TaskItem key={t.id} task={t} onToggle={onToggle} onDelete={onDelete}>
          <AttachmentWidget taskId={t.id} />
        </TaskItem>
      ))}
    </ul>
  );
}
