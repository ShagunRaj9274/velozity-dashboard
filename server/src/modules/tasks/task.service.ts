import type { Notification, Prisma, Role, TaskStatus } from '@prisma/client';
import { prisma, type Tx } from '../../lib/prisma';
import { AppError } from '../../lib/errors';
import { canManageProject, projectScope, taskScope } from '../../policies/access';
import { publisher } from '../../realtime/publisher';
import type { AuthUser } from '../../types/auth';
import { notificationService, type NewNotification } from '../notifications/notification.service';
import type { CreateTaskBody, ListTasksQuery, UpdateStatusBody, UpdateTaskBody } from './task.schemas';

export const taskInclude = {
  assignee: { select: { id: true, name: true, email: true } },
  project: { select: { id: true, name: true, ownerId: true, client: { select: { id: true, name: true } } } },
  createdBy: { select: { id: true, name: true } },
} satisfies Prisma.TaskInclude;

export type TaskWithRelations = Prisma.TaskGetPayload<{ include: typeof taskInclude }>;

export const STATUS_LABEL: Record<TaskStatus, string> = {
  TODO: 'To Do',
  IN_PROGRESS: 'In Progress',
  IN_REVIEW: 'In Review',
  DONE: 'Done',
};

const END_OF_DAY_MS = 24 * 60 * 60 * 1000 - 1;

function orderBy(sort: ListTasksQuery['sort'], role: Role): Prisma.TaskOrderByWithRelationInput[] {
  // Developers default to "priority, then due date" as required by the brief.
  switch (sort ?? (role === 'DEVELOPER' ? 'priority' : 'updated')) {
    case 'priority':
      return [{ priority: 'desc' }, { dueDate: { sort: 'asc', nulls: 'last' } }, { id: 'asc' }];
    case 'dueDate':
      return [{ dueDate: { sort: 'asc', nulls: 'last' } }, { priority: 'desc' }, { id: 'asc' }];
    case 'created':
      return [{ createdAt: 'desc' }, { id: 'desc' }];
    default:
      return [{ updatedAt: 'desc' }, { id: 'desc' }];
  }
}

/** Fetch a task through the caller's scope — out-of-scope looks exactly like non-existent. */
async function getScopedTask(user: AuthUser, id: number): Promise<TaskWithRelations> {
  const task = await prisma.task.findFirst({ where: { AND: [{ id }, taskScope(user)] }, include: taskInclude });
  if (!task) throw AppError.notFound('Task');
  return task;
}

async function assertAssignableDeveloper(assigneeId: number) {
  const dev = await prisma.user.findUnique({
    where: { id: assigneeId },
    select: { id: true, name: true, role: true, isActive: true },
  });
  if (!dev || dev.role !== 'DEVELOPER' || !dev.isActive) {
    throw AppError.badRequest('Tasks can only be assigned to an active developer', [
      { field: 'assigneeId', message: 'Not an active developer' },
    ]);
  }
  return dev;
}

/** A task stops being overdue the moment it is completed or rescheduled. Only the job SETS the flag. */
function shouldClearOverdue(isOverdue: boolean, status: TaskStatus, due: Date | null, now = new Date()) {
  return isOverdue && (status === 'DONE' || due === null || due.getTime() >= now.getTime());
}

function inReviewNotification(user: AuthUser, task: { id: number; title: string; project: { ownerId: number; name: string } }): NewNotification[] {
  if (task.project.ownerId === user.id) return []; // don't notify yourself
  return [
    {
      userId: task.project.ownerId,
      type: 'TASK_IN_REVIEW',
      title: `Ready for review: #${task.id} ${task.title}`,
      body: `${user.name} moved "${task.title}" to In Review in ${task.project.name}.`,
      taskId: task.id,
    },
  ];
}

async function logActivity(tx: Tx, data: Prisma.ActivityLogUncheckedCreateInput): Promise<number> {
  const row = await tx.activityLog.create({ data, select: { id: true } });
  return row.id;
}

/** Runs after commit: realtime fan-out never announces a rolled-back change. */
async function publish(activityIds: number[], notifications: Notification[]) {
  await publisher.activities(activityIds);
  await publisher.notifications(notifications);
}

export const taskService = {
  async list(user: AuthUser, q: ListTasksQuery) {
    const and: Prisma.TaskWhereInput[] = [taskScope(user)];
    if (q.status?.length) and.push({ status: { in: q.status } });
    if (q.priority?.length) and.push({ priority: { in: q.priority } });
    if (q.projectId) and.push({ projectId: q.projectId });
    if (q.assigneeId) and.push({ assigneeId: q.assigneeId });
    if (q.overdue !== undefined) and.push({ isOverdue: q.overdue });
    if (q.q) and.push({ title: { contains: q.q, mode: 'insensitive' } });
    if (q.dueFrom || q.dueTo) {
      and.push({
        dueDate: {
          ...(q.dueFrom ? { gte: q.dueFrom } : {}),
          // `dueTo=2026-09-30` includes the whole of that day
          ...(q.dueTo ? { lte: new Date(q.dueTo.getTime() + END_OF_DAY_MS) } : {}),
        },
      });
    }

    const where: Prisma.TaskWhereInput = { AND: and };
    const [items, total] = await Promise.all([
      prisma.task.findMany({
        where,
        include: taskInclude,
        orderBy: orderBy(q.sort, user.role),
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
      }),
      prisma.task.count({ where }),
    ]);
    return { items, total, page: q.page, pageSize: q.pageSize };
  },

  get: getScopedTask,

  async create(user: AuthUser, input: CreateTaskBody) {
    const project = await prisma.project.findFirst({
      where: { AND: [{ id: input.projectId }, projectScope(user)] },
      select: { id: true, name: true, ownerId: true },
    });
    if (!project) throw AppError.notFound('Project');
    if (!canManageProject(user, project)) throw AppError.forbidden('Only the project owner or an admin can add tasks');

    const assignee = input.assigneeId ? await assertAssignableDeveloper(input.assigneeId) : null;

    const result = await prisma.$transaction(async (tx) => {
      const task = await tx.task.create({
        data: {
          projectId: project.id,
          title: input.title,
          description: input.description ?? null,
          assigneeId: assignee?.id ?? null,
          priority: input.priority,
          status: input.status,
          dueDate: input.dueDate ?? null,
          createdById: user.id,
        },
        include: taskInclude,
      });
      const activityId = await logActivity(tx, {
        type: 'TASK_CREATED',
        projectId: project.id,
        taskId: task.id,
        actorId: user.id,
        toStatus: task.status,
        meta: { assigneeName: assignee?.name ?? null },
      });
      const notifications = assignee
        ? await notificationService.createMany(tx, [
            {
              userId: assignee.id,
              type: 'TASK_ASSIGNED',
              title: `New task: #${task.id} ${task.title}`,
              body: `${user.name} assigned you "${task.title}" in ${project.name}.`,
              taskId: task.id,
            },
          ])
        : [];
      return { task, activityIds: [activityId], notifications };
    });

    await publish(result.activityIds, result.notifications);
    return result.task;
  },

  /** Full edit — admins and the owning PM only (enforced by route AND here). */
  async update(user: AuthUser, id: number, input: UpdateTaskBody) {
    const current = await getScopedTask(user, id);
    if (!canManageProject(user, current.project)) throw AppError.forbidden();

    const assigneeChanged = input.assigneeId !== undefined && input.assigneeId !== current.assigneeId;
    const newAssignee = assigneeChanged && input.assigneeId ? await assertAssignableDeveloper(input.assigneeId) : null;
    const statusChanged = input.status !== undefined && input.status !== current.status;

    const data: Prisma.TaskUncheckedUpdateInput = {};
    const changedFields: string[] = [];
    if (input.title !== undefined && input.title !== current.title) {
      data.title = input.title;
      changedFields.push('title');
    }
    if (input.description !== undefined && input.description !== current.description) {
      data.description = input.description;
      changedFields.push('description');
    }
    if (input.priority !== undefined && input.priority !== current.priority) {
      data.priority = input.priority;
      changedFields.push('priority');
    }
    if (input.dueDate !== undefined && input.dueDate?.getTime() !== current.dueDate?.getTime()) {
      data.dueDate = input.dueDate;
      changedFields.push('due date');
    }
    if (statusChanged) data.status = input.status;
    if (assigneeChanged) data.assigneeId = input.assigneeId ?? null;

    if (!statusChanged && !assigneeChanged && changedFields.length === 0) return current;

    const finalStatus = input.status ?? current.status;
    const finalDue = input.dueDate !== undefined ? input.dueDate : current.dueDate;
    if (shouldClearOverdue(current.isOverdue, finalStatus, finalDue)) {
      data.isOverdue = false;
      data.overdueSince = null;
    }

    const result = await prisma.$transaction(async (tx) => {
      // Optimistic concurrency: refuse to overwrite an edit we haven't seen.
      const { count } = await tx.task.updateMany({ where: { id, updatedAt: current.updatedAt }, data });
      if (count === 0) throw AppError.conflict('This task was changed by someone else. Refresh and try again.');

      const activityIds: number[] = [];
      const pending: NewNotification[] = [];
      const base = { projectId: current.projectId, taskId: id, actorId: user.id };

      if (statusChanged) {
        activityIds.push(
          await logActivity(tx, { ...base, type: 'STATUS_CHANGED', fromStatus: current.status, toStatus: input.status }),
        );
        if (input.status === 'IN_REVIEW') pending.push(...inReviewNotification(user, current));
      }
      if (assigneeChanged) {
        activityIds.push(
          await logActivity(tx, {
            ...base,
            type: 'TASK_ASSIGNED',
            meta: { from: current.assignee?.name ?? null, to: newAssignee?.name ?? null },
          }),
        );
        if (newAssignee) {
          pending.push({
            userId: newAssignee.id,
            type: 'TASK_ASSIGNED',
            title: `New task: #${id} ${input.title ?? current.title}`,
            body: `${user.name} assigned you "${input.title ?? current.title}" in ${current.project.name}.`,
            taskId: id,
          });
        }
      }
      if (changedFields.length > 0) {
        activityIds.push(await logActivity(tx, { ...base, type: 'TASK_UPDATED', meta: { fields: changedFields } }));
      }

      const notifications = await notificationService.createMany(tx, pending);
      const task = await tx.task.findUniqueOrThrow({ where: { id }, include: taskInclude });
      return { task, activityIds, notifications };
    });

    if (assigneeChanged && current.assigneeId) publisher.taskRevoked(current.assigneeId, id);
    await publish(result.activityIds, result.notifications);
    return result.task;
  },

  /** Status-only update — the one write a developer is allowed (on their own tasks). */
  async updateStatus(user: AuthUser, id: number, input: UpdateStatusBody) {
    const current = await getScopedTask(user, id); // developer scope = assigneeId === me
    if (input.expectedStatus && input.expectedStatus !== current.status) {
      throw AppError.conflict(`This task is already ${STATUS_LABEL[current.status]}. Refresh to see the latest.`);
    }
    if (input.status === current.status) return current; // idempotent: no duplicate log entry

    const clear = shouldClearOverdue(current.isOverdue, input.status, current.dueDate);

    const result = await prisma.$transaction(async (tx) => {
      // Compare-and-set on the status we read: two people moving the same card
      // at once can't both "win" and write contradictory history.
      const { count } = await tx.task.updateMany({
        where: { id, status: current.status },
        data: { status: input.status, ...(clear ? { isOverdue: false, overdueSince: null } : {}) },
      });
      if (count === 0) throw AppError.conflict('Task status was changed by someone else. Refresh and try again.');

      const activityId = await logActivity(tx, {
        type: 'STATUS_CHANGED',
        projectId: current.projectId,
        taskId: id,
        actorId: user.id,
        fromStatus: current.status,
        toStatus: input.status,
      });
      const notifications =
        input.status === 'IN_REVIEW' ? await notificationService.createMany(tx, inReviewNotification(user, current)) : [];
      const task = await tx.task.findUniqueOrThrow({ where: { id }, include: taskInclude });
      return { task, activityIds: [activityId], notifications };
    });

    await publish(result.activityIds, result.notifications);
    return result.task;
  },

  async remove(user: AuthUser, id: number) {
    const current = await getScopedTask(user, id);
    if (!canManageProject(user, current.project)) throw AppError.forbidden();
    await prisma.task.delete({ where: { id } });
    if (current.assigneeId) publisher.taskRevoked(current.assigneeId, id);
  },
};
