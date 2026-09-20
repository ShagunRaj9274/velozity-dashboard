import type { ActivityDto } from '../modules/activity/activity.dto';
import type { NotificationDto } from '../modules/notifications/notification.dto';
import type { AuthUser } from '../types/auth';

/** Server → client events. Mirrored in client/src/types.ts. */
export interface ServerToClientEvents {
  'activity:new': (event: ActivityDto) => void;
  'activity:missed': (payload: { since: string | null; total: number; events: ActivityDto[] }) => void;
  'task:revoked': (payload: { taskId: number }) => void;
  'notification:new': (notification: NotificationDto) => void;
  'notification:count': (payload: { unread: number }) => void;
  'presence:update': (payload: { online: number }) => void;
}

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface ClientToServerEvents {}

export interface SocketData {
  user: AuthUser;
  lastSeenAt: Date | null;
}
