import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { notificationController } from './notification.controller';

export const notificationRouter = Router();
notificationRouter.use(authenticate);
notificationRouter.get('/', notificationController.list);
notificationRouter.get('/unread-count', notificationController.unreadCount);
notificationRouter.patch('/read-all', notificationController.markAllRead);
notificationRouter.patch('/:id/read', notificationController.markRead);
