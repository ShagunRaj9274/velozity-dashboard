import request from 'supertest';
import type { Socket } from 'socket.io-client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { collect, connectForMissed, connectSocket, login, sleep, startServer } from './helpers';

interface Activity {
  type: string;
  task: { id: number } | null;
  project: { id: number };
  actor: { name: string } | null;
  fromStatus: string | null;
  toStatus: string | null;
}

let ctx: Awaited<ReturnType<typeof startServer>>;
const sockets: Socket[] = [];
const tokens: Record<string, string> = {};

beforeAll(async () => {
  ctx = await startServer();
  for (const name of ['admin', 'priya', 'karan', 'ravi', 'sneha']) {
    tokens[name] = (await login(ctx.server, `${name}@velozity.dev`)).token;
  }
});
afterAll(async () => {
  sockets.forEach((s) => s.disconnect());
  await ctx.close();
});

async function connect(name: string) {
  const s = await connectSocket(ctx.url, tokens[name]!);
  sockets.push(s);
  return s;
}

describe('socket authentication', () => {
  it('refuses connections without a valid access token', async () => {
    await expect(connectSocket(ctx.url, 'garbage')).rejects.toThrow('UNAUTHORIZED');
  });
});

describe('missed-event catch-up (from the database)', () => {
  it("sends a PM only the events from their own projects since they were last online", async () => {
    const s = await connectSocket(ctx.url, tokens.karan!);
    const payload = await new Promise<{ total: number; events: Activity[] }>((resolve) => s.once('activity:missed', resolve));
    s.disconnect();
    expect(payload.total).toBeGreaterThan(0);
    expect(payload.events.length).toBeLessThanOrEqual(20);
    // Karan owns projects 3 and 4 only
    expect(payload.events.every((e) => [3, 4].includes(e.project.id))).toBe(true);
  });
});

describe('role-filtered live feed', () => {
  it("delivers a status change to admin, the owning PM and the assignee — and nobody else", async () => {
    const [admin, priya, karan, ravi, sneha] = await Promise.all(['admin', 'priya', 'karan', 'ravi', 'sneha'].map(connect));
    const got = {
      admin: collect<Activity>(admin!, 'activity:new'),
      priya: collect<Activity>(priya!, 'activity:new'),
      karan: collect<Activity>(karan!, 'activity:new'),
      ravi: collect<Activity>(ravi!, 'activity:new'),
      sneha: collect<Activity>(sneha!, 'activity:new'),
    };
    const priyaCounts = collect<{ unread: number }>(priya!, 'notification:count');

    // Ravi moves his task #3 (Priya's project) In Progress → In Review
    await request(ctx.server)
      .patch('/api/tasks/3/status')
      .set('Authorization', `Bearer ${tokens.ravi}`)
      .send({ status: 'IN_REVIEW' })
      .expect(200);
    await sleep(400);

    for (const who of ['admin', 'priya', 'ravi'] as const) {
      expect(got[who]).toHaveLength(1);
      expect(got[who][0]).toMatchObject({
        type: 'STATUS_CHANGED',
        task: { id: 3 },
        actor: { name: 'Ravi Kumar' },
        fromStatus: 'IN_PROGRESS',
        toStatus: 'IN_REVIEW',
      });
    }
    expect(got.karan).toHaveLength(0); // other PM
    expect(got.sneha).toHaveLength(0); // other developer

    // The owning PM's unread badge is pushed over the socket (no polling)
    expect(priyaCounts.length).toBeGreaterThan(0);
    expect(priyaCounts.at(-1)!.unread).toBeGreaterThan(0);
  });

  it('pushes live presence counts to admins', async () => {
    const admin = await connect('admin');
    const updates = collect<{ online: number }>(admin, 'presence:update');
    const extra = await connect('sneha');
    await sleep(200);
    extra.disconnect();
    await sleep(200);
    expect(updates.length).toBeGreaterThanOrEqual(2);
  });
});

describe('catch-up edge cases', () => {
  let token = '';
  let first: Socket;
  let second: Socket;

  it('a second tab gets no digest — the user was never away', async () => {
    token = (await login(ctx.server, 'meera@velozity.dev')).token;
    const a = await connectForMissed(ctx.url, token);
    first = a.socket;
    expect(a.missed.total).toBeGreaterThan(0); // seed: last seen 5h ago
    const b = await connectForMissed(ctx.url, token);
    second = b.socket;
    expect(b.missed.total).toBe(0);
  });

  it('a fast reload does not replay events (no race with the lastSeenAt write)', async () => {
    first.disconnect();
    second.disconnect();
    await sleep(30); // server has seen the close; the DB write may still be in flight
    const r = await connectForMissed(ctx.url, token);
    sockets.push(r.socket);
    expect(r.missed.total).toBe(0);
  });
});
