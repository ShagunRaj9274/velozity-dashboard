import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { verifyRefreshToken } from '../src/lib/jwt';
import { prisma } from '../src/lib/prisma';
import { login, startServer } from './helpers';

let ctx: Awaited<ReturnType<typeof startServer>>;
beforeAll(async () => {
  ctx = await startServer();
});
afterAll(() => ctx.close());

const cookieValue = (c: string) => c.split(';')[0]!.slice('vz_rt='.length);

describe('refresh token', () => {
  it('is set as an HttpOnly cookie scoped to /api/auth and never returned in the body', async () => {
    const res = await request(ctx.server).post('/api/auth/login').send({ email: 'sneha@velozity.dev', password: 'Password@123' });
    const cookie = ([] as string[]).concat(res.headers['set-cookie'] ?? []).find((c) => c.startsWith('vz_rt='))!;
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/Path=\/api\/auth/);
    expect(res.body).not.toHaveProperty('refreshToken');
  });

  it('rotates on every refresh', async () => {
    const s = await login(ctx.server, 'sneha@velozity.dev');
    const res = await request(ctx.server).post('/api/auth/refresh').set('Cookie', s.cookie);
    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeTypeOf('string');
    const next = ([] as string[]).concat(res.headers['set-cookie'] ?? []).find((c) => c.startsWith('vz_rt='))!;
    expect(cookieValue(next)).not.toBe(cookieValue(s.cookie));
    const old = await prisma.refreshToken.findUniqueOrThrow({ where: { id: verifyRefreshToken(cookieValue(s.cookie)).jti } });
    expect(old.revokedAt).not.toBeNull();
  });

  it('detects reuse of a rotated token and revokes the whole session family', async () => {
    const s = await login(ctx.server, 'meera@velozity.dev');
    const rotated = await request(ctx.server).post('/api/auth/refresh').set('Cookie', s.cookie);
    const newCookie = ([] as string[]).concat(rotated.headers['set-cookie'] ?? []).find((c) => c.startsWith('vz_rt='))!;

    // Pretend the old token was rotated a minute ago (outside the multi-tab grace window)…
    const { jti, familyId } = verifyRefreshToken(cookieValue(s.cookie));
    await prisma.refreshToken.update({ where: { id: jti }, data: { revokedAt: new Date(Date.now() - 60_000) } });

    // …then an attacker replays it.
    const replay = await request(ctx.server).post('/api/auth/refresh').set('Cookie', s.cookie);
    expect(replay.status).toBe(401);
    expect(replay.body.error.code).toBe('REFRESH_REUSED');

    // The legitimate user's current token is now dead too.
    const legit = await request(ctx.server).post('/api/auth/refresh').set('Cookie', newCookie);
    expect(legit.status).toBe(401);
    expect(await prisma.refreshToken.count({ where: { familyId, revokedAt: null } })).toBe(0);
  });

  it('tolerates two tabs refreshing with the same token at the same moment', async () => {
    const s = await login(ctx.server, 'ravi@velozity.dev');
    const [a, b] = await Promise.all([
      request(ctx.server).post('/api/auth/refresh').set('Cookie', s.cookie),
      request(ctx.server).post('/api/auth/refresh').set('Cookie', s.cookie),
    ]);
    expect([a.status, b.status]).toEqual([200, 200]);
  });

  it('logout revokes the session immediately (no grace window after logout)', async () => {
    const s = await login(ctx.server, 'arjun@velozity.dev');
    await request(ctx.server).post('/api/auth/logout').set('Cookie', s.cookie).expect(204);
    const res = await request(ctx.server).post('/api/auth/refresh').set('Cookie', s.cookie);
    expect(res.status).toBe(401);
  });

  it('rejects wrong passwords without revealing whether the email exists', async () => {
    const a = await request(ctx.server).post('/api/auth/login').send({ email: 'ravi@velozity.dev', password: 'wrong' });
    const b = await request(ctx.server).post('/api/auth/login').send({ email: 'nobody@velozity.dev', password: 'wrong' });
    expect(a.status).toBe(401);
    expect(b.body.error).toEqual(a.body.error.requestId ? { ...a.body.error, requestId: b.body.error.requestId } : a.body.error);
  });
});
