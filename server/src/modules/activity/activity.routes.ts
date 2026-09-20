import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { activityController } from './activity.controller';

// All roles may call these; the service applies the role scope to every query.
export const activityRouter = Router();
activityRouter.use(authenticate);
activityRouter.get('/', activityController.list);
activityRouter.get('/missed', activityController.missed);
