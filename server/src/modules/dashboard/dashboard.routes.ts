import { Router, type Request, type Response } from 'express';
import { authenticate } from '../../middleware/auth';
import { currentUser } from '../../lib/http';
import { dashboardService } from './dashboard.service';

export const dashboardRouter = Router();
dashboardRouter.use(authenticate);
// One endpoint, three shapes: the payload is chosen from the DB role, not from a query param.
dashboardRouter.get('/', async (req: Request, res: Response) => {
  res.json(await dashboardService.get(currentUser(req)));
});
