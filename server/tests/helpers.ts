import { createServer, type Server } from 'http';
import type { AddressInfo } from 'net';
import request from 'supertest';
import { io as ioClient, type Socket } from 'socket.io-client';
import { createApp } from '../src/app';
import { initRealtime } from '../src/realtime/socket';

export const PASSWORD = 'Password@123';

export async function startServer(): Promise<{ server: Server; url: string; close: () => Promise<void> }> {
  const server = createServer(createApp());
  const io = initRealtime(server);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const { port } = server.address() as AddressInfo;
  return { server, url: `http://127.0.0.1:${port}`, close: () => io.close().then(() => undefined) };
}

export async function login(server: Server, email: string) {
  const res = await request(server).post('/api/auth/login').send({ email, password: PASSWORD });
  if (res.status !== 200) throw new Error(`login failed for ${email}: ${res.status} ${JSON.stringify(res.body)}`);
  const cookie = ([] as string[]).concat(res.headers['set-cookie'] ?? []).find((c) => c.startsWith('vz_rt='));
  return { token: res.body.accessToken as string, user: res.body.user as { id: number; role: string }, cookie: cookie! };
}

export function connectSocket(url: string, token: string): Promise<Socket> {
  return new Promise((resolve, reject) => {
    const socket = ioClient(url, { auth: { token }, transports: ['websocket'], forceNew: true });
    socket.once('connect', () => resolve(socket));
    socket.once('connect_error', (err) => reject(err));
  });
}

/** Collects every payload of `event` received by `socket`. */
export function collect<T = unknown>(socket: Socket, event: string): T[] {
  const bucket: T[] = [];
  socket.on(event, (payload: T) => bucket.push(payload));
  return bucket;
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Connects and resolves with the `activity:missed` payload (listener attached before connecting). */
export function connectForMissed(url: string, token: string): Promise<{ socket: Socket; missed: { total: number } }> {
  return new Promise((resolve, reject) => {
    const socket = ioClient(url, { auth: { token }, transports: ['websocket'], forceNew: true });
    socket.once('activity:missed', (missed: { total: number }) => resolve({ socket, missed }));
    socket.once('connect_error', (err) => reject(err));
  });
}
