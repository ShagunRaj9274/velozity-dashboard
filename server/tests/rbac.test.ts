import jwt from 'jsonwebtoken';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '../src/lib/prisma';
import { login, startServer } from './helpers';

// Seeded ids: 1 admin · 2 Priya (PM) · 3 Karan (PM) · 4 Ravi · 5 Sneha (devs)
// Projects 1–2 belong to Priya, 3–4 to Karan. Task #3 = Ravi, #1 = Sneha (project 1).
let ctx: Awaited<ReturnType<typeof startServer>>;
let admin: string, priya: string, ravi: string;

beforeAll(async () => {
  ctx = await startServer();
  [admin, priya, ravi] = await Promise.all([
    login(ctx.server, 'admin@velozity.dev').then((s) => s.token),
    login(ctx.server, 'priya@velozity.dev').then((s) => s.token),
    login(ctx.server, 'ravi@velozity.dev').then((s) => s.token),
  ]);
});
afterAll(() => ctx.close());

const api = () => request(ctx.server);
const as = (token: string) => ({ Authorization: `Bearer ${token}` });

describe('authentication is enforced at the API', () => {
  it('rejects requests without a token with a structured error', async () => {
    const res = await api().get('/api/tasks');
    expect(res.status).toBe(401);
    expect(res.body.error).toMatchObject({ code: 'UNAUTHORIZED' });
    expect(res.body.error.requestId).toBeTypeOf('string');
    expect(JSON.stringify(res.body)).not.toMatch(/at .*\.ts/); // no stack traces
  });

  it('rejects a developer token whose role claim was edited to ADMIN', async () => {
    const [h, , s] = ravi.split('.');
    const payload = JSON.parse(Buffer.from(ravi.split('.')[1]!, 'base64url').toString());
    const forged = `${h}.${Buffer.from(JSON.stringify({ ...payload, role: 'ADMIN' })).toString('base64url')}.${s}`;
    const res = await api().get('/api/users').set(as(forged));
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('TOKEN_INVALID');
  });

  it('rejects an unsigned alg:none token', async () => {
    const none = jwt.sign({ role: 'ADMIN' }, '', { algorithm: 'none', subject: '1' });
    const res = await api().get('/api/users').set(as(none));
    expect(res.status).toBe(401);
  });
});

describe('developer isolation', () => {
  it('cannot call admin / PM endpoints (403)', async () => {
    expect((await api().get('/api/users').set(as(ravi))).status).toBe(403);
    expect((await api().get('/api/clients').set(as(ravi))).status).toBe(403);
    expect((await api().post('/api/projects').set(as(ravi)).send({ name: 'Nope', clientId: 1 })).status).toBe(403);
    expect((await api().patch('/api/tasks/3').set(as(ravi)).send({ title: 'Hijacked' })).status).toBe(403);
  });

  it('only ever lists their own tasks, whatever filters are sent', async () => {
    const me = await prisma.user.findUniqueOrThrow({ where: { email: 'ravi@velozity.dev' } });
    const res = await api().get('/api/tasks?pageSize=100&projectId=1').set(as(ravi));
    expect(res.status).toBe(200);
    expect(res.body.items.length).toBeGreaterThan(0);
    expect(res.body.items.every((t: { assigneeId: number }) => t.assigneeId === me.id)).toBe(true);
  });

  it("gets 404 for another developer's task — by id, status update and activity", async () => {
    expect((await api().get('/api/tasks/1').set(as(ravi))).status).toBe(404);
    expect((await api().patch('/api/tasks/1/status').set(as(ravi)).send({ status: 'DONE' })).status).toBe(404);
    const feed = await api().get('/api/activity?taskId=1').set(as(ravi));
    expect(feed.body.items).toHaveLength(0);
  });

  it('cannot smuggle extra fields into a status update', async () => {
    const res = await api().patch('/api/tasks/21/status').set(as(ravi)).send({ status: 'IN_PROGRESS', assigneeId: 5 });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('cannot see project-manager dashboards or other teams via the dashboard endpoint', async () => {
    const res = await api().get('/api/dashboard').set(as(ravi));
    expect(res.body.role).toBe('DEVELOPER');
    expect(res.body).not.toHaveProperty('projects');
  });
});

describe('project-manager isolation', () => {
  it("lists only their own projects and 404s on another PM's project", async () => {
    const list = await api().get('/api/projects').set(as(priya));
    expect(list.body.map((p: { id: number }) => p.id).sort()).toEqual([1, 2]);
    expect((await api().get('/api/projects/3').set(as(priya))).status).toBe(404);
    expect((await api().patch('/api/projects/3').set(as(priya)).send({ name: 'Taken over' })).status).toBe(404);
  });

  it("cannot create tasks in, or read activity from, another PM's project", async () => {
    const create = await api().post('/api/tasks').set(as(priya)).send({ projectId: 3, title: 'Sneaky task' });
    expect(create.status).toBe(404);
    const feed = await api().get('/api/activity?projectId=3').set(as(priya));
    expect(feed.body.items).toHaveLength(0);
  });

  it('cannot assign a task to a non-developer', async () => {
    const res = await api().post('/api/tasks').set(as(priya)).send({ projectId: 1, title: 'Bad assignee', assigneeId: 3 });
    expect(res.status).toBe(400);
  });
});

describe('admin', () => {
  it('sees every project and the global dashboard', async () => {
    const list = await api().get('/api/projects').set(as(admin));
    expect(list.body).toHaveLength(4);
    const dash = await api().get('/api/dashboard').set(as(admin));
    expect(dash.body.role).toBe('ADMIN');
    expect(dash.body.overdueCount).toBeGreaterThanOrEqual(2);
  });
});

describe('validation, filters and error shape', () => {
  it('returns field-level validation errors for bad query params', async () => {
    const res = await api().get('/api/tasks?status=NOPE').set(as(admin));
    expect(res.status).toBe(400);
    expect(res.body.error.details[0].field).toBe('status.0');
  });

  it('applies shareable URL filters (status + priority)', async () => {
    const res = await api().get('/api/tasks?status=IN_PROGRESS,IN_REVIEW&priority=HIGH,CRITICAL').set(as(admin));
    expect(res.body.items.length).toBeGreaterThan(0);
    for (const t of res.body.items) {
      expect(['IN_PROGRESS', 'IN_REVIEW']).toContain(t.status);
      expect(['HIGH', 'CRITICAL']).toContain(t.priority);
    }
  });

  it('handles malformed JSON and unknown routes consistently', async () => {
    const bad = await api().post('/api/auth/login').set('content-type', 'application/json').send('{"email":');
    expect(bad.body.error.code).toBe('INVALID_JSON');
    const missing = await api().get('/api/nope').set(as(admin));
    expect(missing.body.error.code).toBe('ROUTE_NOT_FOUND');
  });
});

describe('task status changes are recorded in the database', () => {
  it('writes an activity row with actor, from/to status and timestamp', async () => {
    const res = await api().patch('/api/tasks/21/status').set(as(ravi)).send({ status: 'IN_PROGRESS' });
    expect(res.status).toBe(200);
    const log = await prisma.activityLog.findFirstOrThrow({ where: { taskId: 21, type: 'STATUS_CHANGED' }, orderBy: { id: 'desc' } });
    expect(log).toMatchObject({ fromStatus: 'TODO', toStatus: 'IN_PROGRESS', actorId: 4 });
    expect(log.createdAt).toBeInstanceOf(Date);
  });

  it('rejects a stale update with 409 instead of writing contradictory history', async () => {
    const res = await api().patch('/api/tasks/21/status').set(as(ravi)).send({ status: 'IN_REVIEW', expectedStatus: 'TODO' });
    expect(res.status).toBe(409);
  });
});
