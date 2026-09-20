import { randomUUID } from 'crypto';
import bcrypt from 'bcryptjs';
import type { Role } from '@prisma/client';
import { z } from 'zod';
import { env } from '../../config/env';
import { prisma } from '../../lib/prisma';
import { AppError } from '../../lib/errors';
import { logger } from '../../lib/logger';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../../lib/jwt';

export const LoginBody = z
  .object({
    email: z.string().trim().toLowerCase().email().max(254),
    password: z.string().min(1).max(72),
  })
  .strict();

/**
 * Two tabs opening at the same moment will both try to rotate the same refresh
 * token. Within this window a second use is treated as a benign race (a fresh
 * token in the same family is issued) instead of a theft signal.
 */
const ROTATION_GRACE_MS = 10_000;

// Constant-time-ish login: compare against a dummy hash when the email is unknown
// so response timing doesn't reveal which emails exist.
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 12);

interface SessionUser {
  id: number;
  name: string;
  email: string;
  role: Role;
}

export interface Session {
  user: SessionUser;
  accessToken: string;
  refreshToken: string;
  refreshExpiresAt: Date;
}

async function issueSession(user: SessionUser, familyId: string): Promise<Session> {
  const jti = randomUUID();
  const refreshExpiresAt = new Date(Date.now() + env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);
  await prisma.refreshToken.create({ data: { id: jti, userId: user.id, familyId, expiresAt: refreshExpiresAt } });
  return {
    user: { id: user.id, name: user.name, email: user.email, role: user.role },
    accessToken: signAccessToken(user),
    refreshToken: signRefreshToken(user.id, jti, familyId),
    refreshExpiresAt,
  };
}

const invalidRefresh = () => AppError.unauthorized('Your session has expired. Please sign in again.', 'REFRESH_INVALID');

export const authService = {
  async login(input: z.infer<typeof LoginBody>): Promise<Session> {
    const user = await prisma.user.findUnique({ where: { email: input.email } });
    const ok = await bcrypt.compare(input.password, user?.passwordHash ?? DUMMY_HASH);
    if (!user || !ok) throw AppError.unauthorized('Incorrect email or password', 'INVALID_CREDENTIALS');
    if (!user.isActive) throw AppError.unauthorized('This account has been deactivated', 'ACCOUNT_DISABLED');
    return issueSession(user, randomUUID());
  },

  /** Rotation: every refresh revokes the presented token and issues a new one. */
  async refresh(token: string | undefined): Promise<Session> {
    if (!token) throw invalidRefresh();

    let claims;
    try {
      claims = verifyRefreshToken(token);
    } catch {
      throw invalidRefresh();
    }

    const stored = await prisma.refreshToken.findUnique({ where: { id: claims.jti }, include: { user: true } });
    if (!stored || stored.userId !== claims.userId || stored.familyId !== claims.familyId) throw invalidRefresh();
    if (stored.expiresAt.getTime() < Date.now() || !stored.user.isActive) throw invalidRefresh();

    if (stored.revokedAt) {
      // Grace applies only to a token that was just ROTATED inside a session that is
      // still alive. After logout or reuse detection the whole family is revoked,
      // so no active sibling exists and the token is dead immediately.
      const withinGrace = Date.now() - stored.revokedAt.getTime() < ROTATION_GRACE_MS;
      const familyAlive =
        withinGrace &&
        (await prisma.refreshToken.count({
          where: { familyId: stored.familyId, revokedAt: null, expiresAt: { gt: new Date() } },
        })) > 0;
      if (familyAlive) return issueSession(stored.user, stored.familyId); // concurrent-tab race
      // A revoked token came back → assume it was stolen. Kill the whole login family.
      await prisma.refreshToken.updateMany({
        where: { familyId: stored.familyId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      logger.warn('Refresh token reuse detected — session family revoked', { userId: stored.userId });
      throw AppError.unauthorized('Session invalidated for security reasons. Please sign in again.', 'REFRESH_REUSED');
    }

    // Conditional update = atomic "revoke if not already revoked". If a parallel
    // request won by milliseconds, that is the same benign race handled above.
    await prisma.refreshToken.updateMany({
      where: { id: stored.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return issueSession(stored.user, stored.familyId);
  },

  async logout(token: string | undefined): Promise<void> {
    if (!token) return;
    try {
      const { familyId } = verifyRefreshToken(token);
      await prisma.refreshToken.updateMany({ where: { familyId, revokedAt: null }, data: { revokedAt: new Date() } });
    } catch {
      // Invalid/expired token: nothing to revoke; the cookie is cleared regardless.
    }
  },
};
