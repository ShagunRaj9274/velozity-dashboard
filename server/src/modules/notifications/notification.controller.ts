import type { Request, Response } from 'express';
import { z } from 'zod';
import { currentUser, idParam } from '../../lib/http';
import { parse } from '../../lib/validate';
import { notificationService } from './notification.service';

const ListQuery = z.object({ limit: z.coerce.number().int().min(1).max(100).default(20) });

export const notificationController = {
  async list(req: Request, res: Response) {
    const { limit } = parse(ListQuery, req.query);
    res.json(await notificationService.list(currentUser(req).id, limit));
  },
  async unreadCount(req: Request, res: Response) {
    res.json(await notificationService.unreadCount(currentUser(req).id));
  },
  async markRead(req: Request, res: Response) {
    res.json(await notificationService.markRead(currentUser(req).id, idParam(req)));
  },
  async markAllRead(req: Request, res: Response) {
    res.json(await notificationService.markAllRead(currentUser(req).id));
  },
};
