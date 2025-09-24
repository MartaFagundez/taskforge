import type { Project } from '../types';

export function ProjectSelect({
  projects,
  value,
  onChange,
}: {
  projects: Project[];
  value: number | null;
  onChange: (id: number) => void;
}) {
  return (
    <label className="flex items-center gap-2">
      <span className="text-sm text-gray-600">Proyecto:</span>
      <select
        className="select"
        value={value ?? ''}
        onChange={(e) => onChange(Number(e.target.value))}
      >
        {projects.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
    </label>
  );
}
