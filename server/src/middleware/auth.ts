import type { RequestHandler } from 'express';
import type { Role } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { verifyAccessToken } from '../lib/jwt';
import { AppError } from '../lib/errors';

/**
 * 1. Verifies the access token signature + expiry (pinned HS256).
 * 2. Re-loads the user from the DB: the role used for every authorization
 *    decision is the DB role, so a tampered `role` claim is irrelevant and a
 *    demoted / deactivated user loses access immediately.
 */
export const authenticate: RequestHandler = async (req, _res, next) => {
  const header = req.header('authorization');
  if (!header?.startsWith('Bearer ')) throw AppError.unauthorized();

  let userId: number;
  try {
    ({ userId } = verifyAccessToken(header.slice('Bearer '.length)));
  } catch {
    throw AppError.unauthorized('Access token is invalid or expired', 'TOKEN_INVALID');
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true, role: true, isActive: true },
  });
  if (!user || !user.isActive) throw AppError.unauthorized('Account not found or disabled');

  req.user = { id: user.id, name: user.name, email: user.email, role: user.role };
  next();
};

/** Route-level role gate. Always mounted AFTER `authenticate`. */
export const requireRole =
  (...allowed: Role[]): RequestHandler =>
  (req, _res, next) => {
    if (!req.user) throw AppError.unauthorized();
    if (!allowed.includes(req.user.role)) throw AppError.forbidden();
    next();
  };
