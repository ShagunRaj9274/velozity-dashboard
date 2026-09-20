import type { Prisma, TaskStatus } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { AppError } from '../../lib/errors';
import { canManageProject, projectScope, taskScope } from '../../policies/access';
import { publisher } from '../../realtime/publisher';
import type { AuthUser } from '../../types/auth';
import type { CreateProjectBody, UpdateProjectBody } from './project.schemas';

const projectInclude = {
  client: { select: { id: true, name: true, company: true } },
  owner: { select: { id: true, name: true } },
} satisfies Prisma.ProjectInclude;

type ProjectStats = { total: number; overdue: number; byStatus: Record<TaskStatus, number> };
const emptyStats = (): ProjectStats => ({ total: 0, overdue: 0, byStatus: { TODO: 0, IN_PROGRESS: 0, IN_REVIEW: 0, DONE: 0 } });

/**
 * Task counts per project in two aggregate queries (not N+1), restricted by the
 * caller's TASK scope — a developer's project card only counts their own tasks.
 */
async function statsFor(user: AuthUser, projectIds: number[]): Promise<Map<number, ProjectStats>> {
  const stats = new Map<number, ProjectStats>(projectIds.map((id) => [id, emptyStats()]));
  if (projectIds.length === 0) return stats;
  const where: Prisma.TaskWhereInput = { AND: [taskScope(user), { projectId: { in: projectIds } }] };
  const [byStatus, overdue] = await Promise.all([
    prisma.task.groupBy({ by: ['projectId', 'status'], where, _count: { _all: true } }),
    prisma.task.groupBy({ by: ['projectId'], where: { AND: [where, { isOverdue: true }] }, _count: { _all: true } }),
  ]);
  for (const row of byStatus) {
    const s = stats.get(row.projectId);
    if (!s) continue;
    s.byStatus[row.status] = row._count._all;
    s.total += row._count._all;
  }
  for (const row of overdue) {
    const s = stats.get(row.projectId);
    if (s) s.overdue = row._count._all;
  }
  return stats;
}

async function assertOwnerCandidate(ownerId: number) {
  const owner = await prisma.user.findUnique({ where: { id: ownerId }, select: { role: true, isActive: true } });
  if (!owner || !owner.isActive || owner.role === 'DEVELOPER') {
    throw AppError.badRequest('Project owner must be an active admin or project manager', [
      { field: 'ownerId', message: 'Invalid owner' },
    ]);
  }
}

async function assertClientExists(clientId: number) {
  const exists = await prisma.client.count({ where: { id: clientId } });
  if (!exists) throw AppError.badRequest('Client does not exist', [{ field: 'clientId', message: 'Unknown client' }]);
}

export const projectService = {
  async list(user: AuthUser) {
    const projects = await prisma.project.findMany({
      where: projectScope(user),
      include: projectInclude,
      orderBy: { updatedAt: 'desc' },
    });
    const stats = await statsFor(user, projects.map((p) => p.id));
    return projects.map((p) => ({ ...p, stats: stats.get(p.id) ?? emptyStats(), canManage: canManageProject(user, p) }));
  },

  async get(user: AuthUser, id: number) {
    const project = await prisma.project.findFirst({ where: { AND: [{ id }, projectScope(user)] }, include: projectInclude });
    if (!project) throw AppError.notFound('Project');
    const stats = await statsFor(user, [id]);
    return { ...project, stats: stats.get(id) ?? emptyStats(), canManage: canManageProject(user, project) };
  },

  async create(user: AuthUser, input: CreateProjectBody) {
    let ownerId = user.id;
    if (input.ownerId !== undefined && input.ownerId !== user.id) {
      if (user.role !== 'ADMIN') throw AppError.forbidden('Only admins can create projects for another manager');
      await assertOwnerCandidate(input.ownerId);
      ownerId = input.ownerId;
    }
    await assertClientExists(input.clientId);

    const { project, activityId } = await prisma.$transaction(async (tx) => {
      const project = await tx.project.create({
        data: { name: input.name, description: input.description ?? null, clientId: input.clientId, ownerId },
        include: projectInclude,
      });
      const activity = await tx.activityLog.create({
        data: { type: 'PROJECT_CREATED', projectId: project.id, actorId: user.id },
        select: { id: true },
      });
      return { project, activityId: activity.id };
    });
    await publisher.activities([activityId]);
    return { ...project, stats: emptyStats(), canManage: true };
  },

  async update(user: AuthUser, id: number, input: UpdateProjectBody) {
    const project = await prisma.project.findFirst({ where: { AND: [{ id }, projectScope(user)] } });
    if (!project) throw AppError.notFound('Project');
    if (!canManageProject(user, project)) throw AppError.forbidden();
    if (input.ownerId !== undefined && input.ownerId !== project.ownerId) {
      if (user.role !== 'ADMIN') throw AppError.forbidden('Only admins can transfer project ownership');
      await assertOwnerCandidate(input.ownerId);
    }
    if (input.clientId !== undefined) await assertClientExists(input.clientId);

    const updated = await prisma.project.update({ where: { id }, data: input, include: projectInclude });
    return { ...updated, canManage: canManageProject(user, updated) };
  },

  async remove(user: AuthUser, id: number) {
    const project = await prisma.project.findFirst({ where: { AND: [{ id }, projectScope(user)] } });
    if (!project) throw AppError.notFound('Project');
    if (!canManageProject(user, project)) throw AppError.forbidden();
    await prisma.project.delete({ where: { id } });
  },
};
