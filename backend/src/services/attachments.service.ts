import { prisma } from '../lib/prisma';

export const listAttachmentsByTask = (taskId: number) =>
  prisma.attachment.findMany({
    where: { taskId },
    orderBy: { createdAt: 'desc' },
  });

export const registerAttachment = (data: {
  taskId: number;
  key: string;
  originalName: string;
  contentType: string;
  size: number;
}) => prisma.attachment.create({ data });

export const findAttachmentById = (id: number) =>
  prisma.attachment.findUnique({ where: { id } });

export const deleteAttachmentById = (id: number) =>
  prisma.attachment.delete({ where: { id } });
