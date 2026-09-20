import type { Request, Response } from 'express';
import { currentUser, idParam } from '../../lib/http';
import { parse } from '../../lib/validate';
import { CreateTaskBody, ListTasksQuery, UpdateStatusBody, UpdateTaskBody } from './task.schemas';
import { taskService } from './task.service';

// Controllers only translate HTTP ⇄ service calls. No business rules, no queries.
export const taskController = {
  async list(req: Request, res: Response) {
    res.json(await taskService.list(currentUser(req), parse(ListTasksQuery, req.query)));
  },
  async get(req: Request, res: Response) {
    res.json(await taskService.get(currentUser(req), idParam(req)));
  },
  async create(req: Request, res: Response) {
    res.status(201).json(await taskService.create(currentUser(req), parse(CreateTaskBody, req.body)));
  },
  async update(req: Request, res: Response) {
    res.json(await taskService.update(currentUser(req), idParam(req), parse(UpdateTaskBody, req.body)));
  },
  async updateStatus(req: Request, res: Response) {
    res.json(await taskService.updateStatus(currentUser(req), idParam(req), parse(UpdateStatusBody, req.body)));
  },
  async remove(req: Request, res: Response) {
    await taskService.remove(currentUser(req), idParam(req));
    res.status(204).end();
  },
};
