import { Router, type Request, type Response } from 'express';
import { authenticate, requireRole } from '../../middleware/auth';
import { idParam } from '../../lib/http';
import { parse } from '../../lib/validate';
import { ClientBody, UpdateClientBody, clientService } from './client.service';

const clientController = {
  async list(_req: Request, res: Response) {
    res.json(await clientService.list());
  },
  async create(req: Request, res: Response) {
    res.status(201).json(await clientService.create(parse(ClientBody, req.body)));
  },
  async update(req: Request, res: Response) {
    res.json(await clientService.update(idParam(req), parse(UpdateClientBody, req.body)));
  },
  async remove(req: Request, res: Response) {
    await clientService.remove(idParam(req));
    res.status(204).end();
  },
};

export const clientRouter = Router();
clientRouter.use(authenticate);
// PMs need the client list to create projects; only admins manage clients.
clientRouter.get('/', requireRole('ADMIN', 'PROJECT_MANAGER'), clientController.list);
clientRouter.post('/', requireRole('ADMIN'), clientController.create);
clientRouter.patch('/:id', requireRole('ADMIN'), clientController.update);
clientRouter.delete('/:id', requireRole('ADMIN'), clientController.remove);
