import type { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { AppError } from '../../lib/errors';
import { activityScope } from '../../policies/access';
import type { AuthUser } from '../../types/auth';
import { activityInclude, toActivityDto, type ActivityDto } from './activity.dto';
import type { ListActivityQuery } from './activity.schemas';

export const MISSED_EVENTS_LIMIT = 20;

// Keyset cursor "<createdAt ISO>_<id>": stable under concurrent inserts, unlike OFFSET.
const encodeCursor = (a: { createdAt: Date; id: number }) => `${a.createdAt.toISOString()}_${a.id}`;
function decodeCursor(cursor: string): { createdAt: Date; id: number } {
  const [iso, id] = cursor.split('_');
  const createdAt = new Date(iso ?? '');
  const numericId = Number(id);
  if (Number.isNaN(createdAt.getTime()) || !Number.isInteger(numericId)) {
    throw AppError.badRequest('Invalid cursor');
  }
  return { createdAt, id: numericId };
}

export const activityService = {
  async list(user: AuthUser, q: ListActivityQuery): Promise<{ items: ActivityDto[]; nextCursor: string | null }> {
    const and: Prisma.ActivityLogWhereInput[] = [activityScope(user)];
    if (q.projectId) and.push({ projectId: q.projectId });
    if (q.taskId) and.push({ taskId: q.taskId });
    if (q.cursor) {
      const c = decodeCursor(q.cursor);
      and.push({ OR: [{ createdAt: { lt: c.createdAt } }, { createdAt: c.createdAt, id: { lt: c.id } }] });
    }

    const rows = await prisma.activityLog.findMany({
      where: { AND: and },
      include: activityInclude,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: q.limit + 1,
    });

    const hasMore = rows.length > q.limit;
    const page = hasMore ? rows.slice(0, q.limit) : rows;
    const last = page[page.length - 1];
    return { items: page.map(toActivityDto), nextCursor: hasMore && last ? encodeCursor(last) : null };
  },

  /**
   * Events the user missed while fully offline — read from Postgres (never an
   * in-memory buffer), so it survives restarts and works across instances.
   * Uses the same role scope as the live feed; the user's own actions are excluded.
   */
  async missedSince(
    user: AuthUser,
    since: Date | null,
    limit = MISSED_EVENTS_LIMIT,
  ): Promise<{ since: string | null; total: number; events: ActivityDto[] }> {
    if (!since) return { since: null, total: 0, events: [] };

    const where: Prisma.ActivityLogWhereInput = {
      AND: [
        activityScope(user),
        { createdAt: { gt: since } },
        // `actorId <> x` alone would also drop system events (NULL actor) in SQL.
        { OR: [{ actorId: null }, { actorId: { not: user.id } }] },
      ],
    };

    const [total, rows] = await Promise.all([
      prisma.activityLog.count({ where }),
      prisma.activityLog.findMany({
        where,
        include: activityInclude,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: limit,
      }),
    ]);
    return { since: since.toISOString(), total, events: rows.map(toActivityDto) };
  },

  async missedForUser(user: AuthUser) {
    const row = await prisma.user.findUniqueOrThrow({ where: { id: user.id }, select: { lastSeenAt: true } });
    return activityService.missedSince(user, row.lastSeenAt);
  },
};
