import cron from 'node-cron';
import type { Notification } from '@prisma/client';
import { env } from '../config/env';
import { prisma } from '../lib/prisma';
import { logger } from '../lib/logger';
import { publisher } from '../realtime/publisher';
import { notificationService } from '../modules/notifications/notification.service';

/** Arbitrary constant key for a Postgres transaction-scoped advisory lock. */
const OVERDUE_LOCK_KEY = 72_410_001;

export interface SweepResult {
  flagged: number;
  cleared: number;
  skipped: boolean;
}

/**
 * Flags tasks whose due date has passed (and that aren't Done) as overdue,
 * writes one TASK_OVERDUE activity per task, notifies the assignee, and pushes
 * the events over WebSockets. Idempotent: a task is only flagged once
 * (`isOverdue = false` in the WHERE clause).
 *
 * The whole sweep runs in one transaction holding a Postgres advisory lock, so
 * if the API is ever scaled to several instances only one of them sweeps.
 */
export async function runOverdueSweep(now = new Date()): Promise<SweepResult> {
  const result = await prisma.$transaction(async (tx) => {
    const [lock] = await tx.$queryRaw<{ locked: boolean }[]>`SELECT pg_try_advisory_xact_lock(${OVERDUE_LOCK_KEY}) AS locked`;
    if (!lock?.locked) return { flagged: 0, cleared: 0, skipped: true, activityIds: [] as number[], notifications: [] as Notification[] };

    const due = await tx.task.findMany({
      where: { isOverdue: false, status: { not: 'DONE' }, dueDate: { lt: now } },
      select: { id: true, title: true, projectId: true, assigneeId: true, dueDate: true },
    });

    let activityIds: number[] = [];
    let notifications: Notification[] = [];
    if (due.length > 0) {
      await tx.task.updateMany({
        where: { id: { in: due.map((t) => t.id) }, isOverdue: false },
        data: { isOverdue: true, overdueSince: now },
      });
      const activities = await tx.activityLog.createManyAndReturn({
        data: due.map((t) => ({
          type: 'TASK_OVERDUE' as const,
          projectId: t.projectId,
          taskId: t.id,
          actorId: null, // system
          meta: { dueDate: t.dueDate?.toISOString() ?? null },
        })),
        select: { id: true },
      });
      activityIds = activities.map((a) => a.id);
      notifications = await notificationService.createMany(
        tx,
        due
          .filter((t): t is typeof t & { assigneeId: number } => t.assigneeId !== null)
          .map((t) => ({
            userId: t.assigneeId,
            type: 'TASK_OVERDUE' as const,
            title: `Overdue: #${t.id} ${t.title}`,
            body: `"${t.title}" passed its due date and is now flagged overdue.`,
            taskId: t.id,
          })),
      );
    }

    // Safety net: clear flags on tasks completed/rescheduled through any path.
    const cleared = await tx.task.updateMany({
      where: { isOverdue: true, OR: [{ status: 'DONE' }, { dueDate: null }, { dueDate: { gte: now } }] },
      data: { isOverdue: false, overdueSince: null },
    });

    return { flagged: due.length, cleared: cleared.count, skipped: false, activityIds, notifications };
  });

  await publisher.activities(result.activityIds);
  await publisher.notifications(result.notifications);
  return { flagged: result.flagged, cleared: result.cleared, skipped: result.skipped };
}

let running = false;

export function startOverdueJob() {
  if (!cron.validate(env.OVERDUE_CRON)) throw new Error(`Invalid OVERDUE_CRON expression: ${env.OVERDUE_CRON}`);

  const tick = async () => {
    if (running) return; // never overlap runs within this process
    running = true;
    try {
      const r = await runOverdueSweep();
      if (r.flagged || r.cleared) logger.info('Overdue sweep', { ...r });
    } catch (err) {
      logger.error('Overdue sweep failed', { err: String(err) });
    } finally {
      running = false;
    }
  };

  const task = cron.schedule(env.OVERDUE_CRON, () => void tick());
  void tick(); // run once at boot so a restart doesn't leave stale flags
  logger.info(`Overdue job scheduled (${env.OVERDUE_CRON})`);
  return task;
}
