import type { Priority, TaskStatus } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { taskScope } from '../../policies/access';
import { presence } from '../../realtime/presence';
import type { AuthUser } from '../../types/auth';
import { projectService } from '../projects/project.service';
import { taskInclude } from '../tasks/task.service';

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

const zeroStatus = (): Record<TaskStatus, number> => ({ TODO: 0, IN_PROGRESS: 0, IN_REVIEW: 0, DONE: 0 });
const zeroPriority = (): Record<Priority, number> => ({ LOW: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 0 });

async function adminDashboard() {
  const [projects, statusGroups, overdueCount, users] = await Promise.all([
    prisma.project.count(),
    prisma.task.groupBy({ by: ['status'], _count: { _all: true } }),
    prisma.task.count({ where: { isOverdue: true } }),
    prisma.user.count({ where: { isActive: true } }),
  ]);
  const tasksByStatus = zeroStatus();
  for (const g of statusGroups) tasksByStatus[g.status] = g._count._all;
  const totalTasks = Object.values(tasksByStatus).reduce((a, b) => a + b, 0);

  return {
    role: 'ADMIN' as const,
    totals: { projects, tasks: totalTasks, users },
    tasksByStatus,
    overdueCount,
    onlineUsers: presence.onlineCount(), // then kept live via `presence:update`
  };
}

async function pmDashboard(user: AuthUser) {
  const scope = taskScope(user);
  const now = new Date();
  const [projects, priorityGroups, dueThisWeek, overdueCount] = await Promise.all([
    projectService.list(user),
    prisma.task.groupBy({
      by: ['priority'],
      where: { AND: [scope, { status: { not: 'DONE' } }] },
      _count: { _all: true },
    }),
    prisma.task.findMany({
      where: { AND: [scope, { status: { not: 'DONE' } }, { dueDate: { gte: now, lte: new Date(now.getTime() + WEEK_MS) } }] },
      include: taskInclude,
      orderBy: [{ dueDate: 'asc' }, { priority: 'desc' }],
      take: 25,
    }),
    prisma.task.count({ where: { AND: [scope, { isOverdue: true }] } }),
  ]);
  const openTasksByPriority = zeroPriority();
  for (const g of priorityGroups) openTasksByPriority[g.priority] = g._count._all;

  return { role: 'PROJECT_MANAGER' as const, projects, openTasksByPriority, dueThisWeek, overdueCount };
}

async function developerDashboard(user: AuthUser) {
  const tasks = await prisma.task.findMany({
    where: taskScope(user),
    include: taskInclude,
    // Required sort: priority (Critical first), then nearest due date.
    orderBy: [{ priority: 'desc' }, { dueDate: { sort: 'asc', nulls: 'last' } }, { id: 'asc' }],
  });
  const tasksByStatus = zeroStatus();
  for (const t of tasks) tasksByStatus[t.status] += 1;
  const weekEnd = Date.now() + WEEK_MS;
  return {
    role: 'DEVELOPER' as const,
    tasks,
    tasksByStatus,
    overdueCount: tasks.filter((t) => t.isOverdue).length,
    dueThisWeekCount: tasks.filter((t) => t.status !== 'DONE' && t.dueDate && t.dueDate.getTime() <= weekEnd && !t.isOverdue).length,
  };
}

export const dashboardService = {
  get(user: AuthUser) {
    switch (user.role) {
      case 'ADMIN':
        return adminDashboard();
      case 'PROJECT_MANAGER':
        return pmDashboard(user);
      case 'DEVELOPER':
        return developerDashboard(user);
    }
  },
};
