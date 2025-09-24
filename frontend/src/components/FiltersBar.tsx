export function FiltersBar({
  query,
  setQuery,
  status,
  setStatus,
}: {
  query: string;
  setQuery: (value: string) => void;
  status: 'all' | 'done' | 'pending';
  setStatus: (value: 'all' | 'done' | 'pending') => void;
}) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <input
        className="input flex-1"
        placeholder="Buscar por título…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <select
        className="select"
        value={status}
        onChange={(e) => setStatus(e.target.value as any)}
      >
        <option value="all">Todas</option>
        <option value="pending">Pendientes</option>
        <option value="done">Hechas</option>
      </select>
    </div>
  );
}
