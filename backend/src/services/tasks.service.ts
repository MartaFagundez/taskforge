import { prisma } from '../lib/prisma';

export const listAllTasks = () =>
  prisma.task.findMany({ orderBy: { createdAt: 'desc' } });

export const createTask = (title: string, projectId: number) =>
  prisma.task.create({ data: { title, projectId } });

export const findTaskById = (id: number) =>
  prisma.task.findUnique({ where: { id } });

export const toggleTask = async (id: number) => {
  const current = await prisma.task.findUnique({ where: { id } });
  if (!current) return null;
  return prisma.task.update({ where: { id }, data: { done: !current.done } });
};

export const deleteTask = (id: number) => prisma.task.delete({ where: { id } });

export const countTasks = (where: any) => prisma.task.count({ where });

export const listTasks = (args: { where: any; skip: number; take: number }) =>
  prisma.task.findMany({
    where: args.where,
    orderBy: { createdAt: 'desc' },
    skip: args.skip,
    take: args.take,
  });

// attachments relation for cleanup
export const listAttachmentKeysByTask = async (taskId: number) => {
  const attachments = await prisma.attachment.findMany({
    where: { taskId },
    select: { key: true },
  });
  return attachments.map((a) => a.key);
};
