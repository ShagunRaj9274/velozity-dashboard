import type { Notification, NotificationType } from '@prisma/client';

export interface NotificationDto {
  id: number;
  type: NotificationType;
  title: string;
  body: string;
  taskId: number | null;
  readAt: string | null;
  createdAt: string;
}

export const toNotificationDto = (n: Notification): NotificationDto => ({
  id: n.id,
  type: n.type,
  title: n.title,
  body: n.body,
  taskId: n.taskId,
  readAt: n.readAt?.toISOString() ?? null,
  createdAt: n.createdAt.toISOString(),
});
