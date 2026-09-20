import type { Notification, NotificationType } from '@prisma/client';
import { prisma, type Tx } from '../../lib/prisma';
import { AppError } from '../../lib/errors';
import { publisher } from '../../realtime/publisher';
import { toNotificationDto } from './notification.dto';

export interface NewNotification {
  userId: number;
  type: NotificationType;
  title: string;
  body: string;
  taskId?: number | null;
}

export const notificationService = {
  /** Creates notifications inside the caller's transaction. Publish after commit. */
  async createMany(tx: Tx, items: NewNotification[]): Promise<Notification[]> {
    if (items.length === 0) return [];
    return tx.notification.createManyAndReturn({ data: items });
  },

  async list(userId: number, limit: number) {
    const [items, unread] = await Promise.all([
      prisma.notification.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: limit }),
      prisma.notification.count({ where: { userId, readAt: null } }),
    ]);
    return { items: items.map(toNotificationDto), unread };
  },

  async unreadCount(userId: number) {
    return { unread: await prisma.notification.count({ where: { userId, readAt: null } }) };
  },

  async markRead(userId: number, id: number) {
    // userId in the WHERE clause: you can only mark your own notifications.
    const n = await prisma.notification.findFirst({ where: { id, userId } });
    if (!n) throw AppError.notFound('Notification');
    const updated = n.readAt ? n : await prisma.notification.update({ where: { id }, data: { readAt: new Date() } });
    await publisher.unreadCount(userId); // sync badge across the user's other tabs
    return toNotificationDto(updated);
  },

  async markAllRead(userId: number) {
    const { count } = await prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });
    await publisher.unreadCount(userId);
    return { updated: count };
  },
};
