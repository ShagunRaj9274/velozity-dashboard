import type { Server } from 'socket.io';
import type { Notification } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { logger } from '../lib/logger';
import { activityAudience, rooms } from '../policies/access';
import { activityInclude, toActivityDto } from '../modules/activity/activity.dto';
import { toNotificationDto } from '../modules/notifications/notification.dto';
import type { ClientToServerEvents, ServerToClientEvents, SocketData } from './events';
import { presence } from './presence';

type IO = Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;

let io: IO | null = null;
export const setIO = (instance: IO) => {
  io = instance;
};

/**
 * Publishers are called by services AFTER their DB transaction commits,
 * so clients are never told about a change that was rolled back.
 * They are no-ops when the socket server isn't running (seed script, tests).
 */
export const publisher = {
  async activities(activityIds: number[]): Promise<void> {
    if (!io || activityIds.length === 0) return;
    try {
      const rows = await prisma.activityLog.findMany({
        where: { id: { in: activityIds } },
        include: activityInclude,
        orderBy: { id: 'asc' },
      });
      for (const row of rows) {
        const audience = activityAudience({
          projectOwnerId: row.project.ownerId,
          assigneeId: row.task?.assigneeId ?? null,
        });
        // Socket.io de-duplicates across rooms: an admin who also owns the project gets it once.
        io.to(audience).emit('activity:new', toActivityDto(row));
      }
    } catch (err) {
      logger.error('Failed to publish activity', { err: String(err) });
    }
  },

  /** A developer who was un-assigned must drop the task from their UI. */
  taskRevoked(userId: number, taskId: number): void {
    io?.to(rooms.user(userId)).emit('task:revoked', { taskId });
  },

  async notifications(notifications: Notification[]): Promise<void> {
    if (!io || notifications.length === 0) return;
    try {
      for (const n of notifications) io.to(rooms.user(n.userId)).emit('notification:new', toNotificationDto(n));
      const userIds = [...new Set(notifications.map((n) => n.userId))];
      await Promise.all(userIds.map((id) => publisher.unreadCount(id)));
    } catch (err) {
      logger.error('Failed to publish notifications', { err: String(err) });
    }
  },

  /** Pushes the authoritative unread count (from DB) to every tab the user has open. */
  async unreadCount(userId: number): Promise<void> {
    if (!io) return;
    const unread = await prisma.notification.count({ where: { userId, readAt: null } });
    io.to(rooms.user(userId)).emit('notification:count', { unread });
  },

  presence(): void {
    io?.to(rooms.admins).emit('presence:update', { online: presence.onlineCount() });
  },
};
