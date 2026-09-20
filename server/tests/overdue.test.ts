import { afterAll, describe, expect, it } from 'vitest';
import { prisma } from '../src/lib/prisma';
import { runOverdueSweep } from '../src/jobs/overdue.job';

describe('overdue scheduler', () => {
  const created: number[] = [];
  afterAll(async () => {
    await prisma.task.deleteMany({ where: { id: { in: created } } });
  });

  it('seed contains at least two tasks already overdue', async () => {
    expect(await prisma.task.count({ where: { isOverdue: true } })).toBeGreaterThanOrEqual(2);
  });

  it('flags past-due tasks, logs TASK_OVERDUE, notifies the assignee — exactly once', async () => {
    const task = await prisma.task.create({
      data: { title: 'Past due job test', projectId: 1, createdById: 2, assigneeId: 4, dueDate: new Date(Date.now() - 60_000) },
    });
    created.push(task.id);
    expect(task.isOverdue).toBe(false); // nothing is flagged on write / page load

    const first = await runOverdueSweep();
    expect(first.flagged).toBeGreaterThanOrEqual(1);
    const flagged = await prisma.task.findUniqueOrThrow({ where: { id: task.id } });
    expect(flagged.isOverdue).toBe(true);
    expect(await prisma.activityLog.count({ where: { taskId: task.id, type: 'TASK_OVERDUE' } })).toBe(1);
    expect(await prisma.notification.count({ where: { taskId: task.id, type: 'TASK_OVERDUE', userId: 4 } })).toBe(1);

    await runOverdueSweep(); // idempotent
    expect(await prisma.activityLog.count({ where: { taskId: task.id, type: 'TASK_OVERDUE' } })).toBe(1);
  });

  it('does not flag completed tasks and clears the flag when a task is done', async () => {
    const done = await prisma.task.create({
      data: { title: 'Done job test', projectId: 1, createdById: 2, status: 'DONE', dueDate: new Date(Date.now() - 60_000), isOverdue: true },
    });
    created.push(done.id);
    await runOverdueSweep();
    expect((await prisma.task.findUniqueOrThrow({ where: { id: done.id } })).isOverdue).toBe(false);
  });
});
