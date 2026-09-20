import jwt from 'jsonwebtoken';
import type { Role } from '@prisma/client';
import { env } from '../config/env';

// Algorithm is pinned on both sign and verify: a token re-signed with
// `alg: none` or a different algorithm is rejected outright.
const ALG = 'HS256' as const;

export interface AccessClaims {
  userId: number;
  role: Role;
}

export interface RefreshClaims {
  userId: number;
  jti: string;
  familyId: string;
}

export function signAccessToken(user: { id: number; role: Role }): string {
  return jwt.sign({ role: user.role }, env.JWT_ACCESS_SECRET, {
    subject: String(user.id),
    expiresIn: env.ACCESS_TOKEN_TTL_SECONDS,
    algorithm: ALG,
  });
}

export function verifyAccessToken(token: string): AccessClaims {
  const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET, { algorithms: [ALG] });
  if (typeof decoded === 'string' || !decoded.sub) throw new Error('Malformed access token');
  const userId = Number(decoded.sub);
  if (!Number.isInteger(userId)) throw new Error('Malformed access token');
  return { userId, role: decoded.role as Role };
}

export function signRefreshToken(userId: number, jti: string, familyId: string): string {
  return jwt.sign({ fam: familyId }, env.JWT_REFRESH_SECRET, {
    subject: String(userId),
    jwtid: jti,
    expiresIn: env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60,
    algorithm: ALG,
  });
}

export function verifyRefreshToken(token: string): RefreshClaims {
  const decoded = jwt.verify(token, env.JWT_REFRESH_SECRET, { algorithms: [ALG] });
  if (typeof decoded === 'string' || !decoded.sub || !decoded.jti || typeof decoded.fam !== 'string') {
    throw new Error('Malformed refresh token');
  }
  return { userId: Number(decoded.sub), jti: decoded.jti, familyId: decoded.fam };
}
