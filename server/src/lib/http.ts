import type { Request } from 'express';
import { z } from 'zod';
import { AppError } from './errors';
import type { AuthUser } from '../types/auth';

/** Returns the authenticated user or throws — keeps controllers free of `!` assertions. */
export function currentUser(req: Request): AuthUser {
  if (!req.user) throw AppError.unauthorized();
  return req.user;
}

const IdParam = z.coerce.number().int().positive();

/** Parses a numeric route param (e.g. /tasks/:id) — rejects `abc`, `-1`, `1.5`. */
export function idParam(req: Request, name = 'id'): number {
  const result = IdParam.safeParse(req.params[name]);
  if (!result.success) throw AppError.badRequest(`Invalid ${name} parameter`);
  return result.data;
}
