import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { AppError } from '../../lib/errors';

export const ClientBody = z
  .object({
    name: z.string().trim().min(2).max(160),
    company: z.string().trim().max(160).nullable().optional(),
    email: z.string().trim().email().max(254).nullable().optional(),
  })
  .strict();
export const UpdateClientBody = ClientBody.partial().refine((d) => Object.keys(d).length > 0, {
  message: 'Provide at least one field to update',
});

export const clientService = {
  list() {
    return prisma.client.findMany({ orderBy: { name: 'asc' }, include: { _count: { select: { projects: true } } } });
  },
  create(input: z.infer<typeof ClientBody>) {
    return prisma.client.create({ data: input });
  },
  async update(id: number, input: z.infer<typeof UpdateClientBody>) {
    const exists = await prisma.client.count({ where: { id } });
    if (!exists) throw AppError.notFound('Client');
    return prisma.client.update({ where: { id }, data: input });
  },
  async remove(id: number) {
    const client = await prisma.client.findUnique({ where: { id }, include: { _count: { select: { projects: true } } } });
    if (!client) throw AppError.notFound('Client');
    if (client._count.projects > 0) throw AppError.conflict('This client still has projects. Move or delete them first.');
    await prisma.client.delete({ where: { id } });
  },
};
