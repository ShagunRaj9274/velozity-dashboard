import { Router, type Request, type Response } from 'express';
import { authenticate, requireRole } from '../../middleware/auth';
import { currentUser, idParam } from '../../lib/http';
import { parse } from '../../lib/validate';
import { CreateUserBody, ListUsersQuery, UpdateUserBody, userService } from './user.service';

const userController = {
  async list(req: Request, res: Response) {
    const { role } = parse(ListUsersQuery, req.query);
    res.json(await userService.list(role));
  },
  async assignable(_req: Request, res: Response) {
    res.json(await userService.assignableDevelopers());
  },
  async create(req: Request, res: Response) {
    res.status(201).json(await userService.create(parse(CreateUserBody, req.body)));
  },
  async update(req: Request, res: Response) {
    res.json(await userService.update(currentUser(req), idParam(req), parse(UpdateUserBody, req.body)));
  },
};

export const userRouter = Router();
userRouter.use(authenticate);
userRouter.get('/assignable', requireRole('ADMIN', 'PROJECT_MANAGER'), userController.assignable);
userRouter.get('/', requireRole('ADMIN'), userController.list);
userRouter.post('/', requireRole('ADMIN'), userController.create);
userRouter.patch('/:id', requireRole('ADMIN'), userController.update);
