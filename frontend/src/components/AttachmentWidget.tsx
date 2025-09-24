import { useAttachments } from '../hooks/useAttachments';

export function AttachmentWidget({ taskId }: { taskId: number }) {
  const { attsQuery, upload, download, removeMut } = useAttachments(taskId);

  return (
    <div className="mt-2 w-full">
      <label className="btn cursor-pointer">
        ➕ Adjuntar
        <input
          type="file"
          hidden
          onChange={async (e) => {
            const file = e.target.files?.[0];
            const target = e.currentTarget;
            if (file) await upload(file);
            target.value = '';
          }}
        />
      </label>

      <ul className="mt-2 space-y-1">
        {(attsQuery.data ?? []).map((att) => (
          <li key={att.id} className="flex items-center gap-2 text-sm">
            <span className="flex-1 truncate">{att.originalName}</span>
            <button className="btn" onClick={() => download(att.key)}>
              ⬇️
            </button>
            <button className="btn" onClick={() => removeMut.mutate(att.id)}>
              🗑️
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
