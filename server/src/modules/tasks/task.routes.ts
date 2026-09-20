import { Router } from 'express';
import { authenticate, requireRole } from '../../middleware/auth';
import { taskController } from './task.controller';

/**
 * Two layers on every route:
 *  1. requireRole  — can this ROLE call this endpoint at all?
 *  2. service scope — can this USER touch this ROW? (see policies/access.ts)
 */
export const taskRouter = Router();
taskRouter.use(authenticate);

taskRouter.get('/', taskController.list); // all roles, row-scoped
taskRouter.get('/:id', taskController.get); // all roles, row-scoped
taskRouter.patch('/:id/status', taskController.updateStatus); // all roles, row-scoped

taskRouter.post('/', requireRole('ADMIN', 'PROJECT_MANAGER'), taskController.create);
taskRouter.patch('/:id', requireRole('ADMIN', 'PROJECT_MANAGER'), taskController.update);
taskRouter.delete('/:id', requireRole('ADMIN', 'PROJECT_MANAGER'), taskController.remove);
