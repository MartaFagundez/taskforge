import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  deleteAttachment,
  listAttachments,
  presignDownload,
  presignUpload,
  registerAttachment,
} from '../api/attachments';

export function useAttachments(taskId: number) {
  const qc = useQueryClient();
  const attsQ = useQuery({
    queryKey: ['attachments', taskId],
    queryFn: () => listAttachments(taskId),
  });

  const upload = async (file: File) => {
    const presigned = await presignUpload({
      taskId,
      originalName: file.name,
      contentType: file.type || 'application/octet-stream',
      size: file.size,
    });
    await fetch(presigned.uploadUrl, {
      method: 'PUT',
      headers: presigned.headers,
      body: file,
    });
    await registerAttachment({
      taskId,
      key: presigned.key,
      originalName: file.name,
      contentType: file.type || 'application/octet-stream',
      size: file.size,
    });
    qc.invalidateQueries({ queryKey: ['attachments', taskId] });
  };

  const download = async (key: string) => {
    const url = await presignDownload(key);
    window.open(url, '_blank');
  };

  const removeMut = useMutation({
    mutationFn: (id: number) => deleteAttachment(id),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ['attachments', taskId] }),
  });

  return { attsQ, upload, download, removeMut };
}
