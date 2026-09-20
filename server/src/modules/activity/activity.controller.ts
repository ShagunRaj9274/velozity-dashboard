import type { Request, Response } from 'express';
import { currentUser } from '../../lib/http';
import { parse } from '../../lib/validate';
import { ListActivityQuery } from './activity.schemas';
import { activityService } from './activity.service';

export const activityController = {
  async list(req: Request, res: Response) {
    const query = parse(ListActivityQuery, req.query);
    res.json(await activityService.list(currentUser(req), query));
  },
  async missed(req: Request, res: Response) {
    res.json(await activityService.missedForUser(currentUser(req)));
  },
};
