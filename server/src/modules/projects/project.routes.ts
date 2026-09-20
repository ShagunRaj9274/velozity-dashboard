import { Router } from 'express';
import { authenticate, requireRole } from '../../middleware/auth';
import { projectController } from './project.controller';

export const projectRouter = Router();
projectRouter.use(authenticate);

projectRouter.get('/', projectController.list); // all roles, row-scoped
projectRouter.get('/:id', projectController.get); // all roles, row-scoped
projectRouter.post('/', requireRole('ADMIN', 'PROJECT_MANAGER'), projectController.create);
projectRouter.patch('/:id', requireRole('ADMIN', 'PROJECT_MANAGER'), projectController.update);
projectRouter.delete('/:id', requireRole('ADMIN', 'PROJECT_MANAGER'), projectController.remove);
