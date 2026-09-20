import type { Request, Response } from 'express';
import { currentUser, idParam } from '../../lib/http';
import { parse } from '../../lib/validate';
import { CreateProjectBody, UpdateProjectBody } from './project.schemas';
import { projectService } from './project.service';

export const projectController = {
  async list(req: Request, res: Response) {
    res.json(await projectService.list(currentUser(req)));
  },
  async get(req: Request, res: Response) {
    res.json(await projectService.get(currentUser(req), idParam(req)));
  },
  async create(req: Request, res: Response) {
    res.status(201).json(await projectService.create(currentUser(req), parse(CreateProjectBody, req.body)));
  },
  async update(req: Request, res: Response) {
    res.json(await projectService.update(currentUser(req), idParam(req), parse(UpdateProjectBody, req.body)));
  },
  async remove(req: Request, res: Response) {
    await projectService.remove(currentUser(req), idParam(req));
    res.status(204).end();
  },
};
