import type { ActivityType, Prisma, Role, TaskStatus } from '@prisma/client';

export const activityInclude = {
  actor: { select: { id: true, name: true, role: true } },
  task: { select: { id: true, title: true, assigneeId: true } },
  project: { select: { id: true, name: true, ownerId: true } },
} satisfies Prisma.ActivityLogInclude;

export type ActivityWithRelations = Prisma.ActivityLogGetPayload<{ include: typeof activityInclude }>;

export interface ActivityDto {
  id: number;
  type: ActivityType;
  createdAt: string;
  project: { id: number; name: string };
  task: { id: number; title: string } | null;
  /** null = system (e.g. the overdue scheduler) */
  actor: { id: number; name: string; role: Role } | null;
  fromStatus: TaskStatus | null;
  toStatus: TaskStatus | null;
  meta: Record<string, unknown> | null;
}

export function toActivityDto(a: ActivityWithRelations): ActivityDto {
  return {
    id: a.id,
    type: a.type,
    createdAt: a.createdAt.toISOString(),
    project: { id: a.project.id, name: a.project.name },
    task: a.task ? { id: a.task.id, title: a.task.title } : null,
    actor: a.actor,
    fromStatus: a.fromStatus,
    toStatus: a.toStatus,
    meta: (a.meta as Record<string, unknown> | null) ?? null,
  };
}
