import type { Server as HttpServer } from 'http';
import { Server } from 'socket.io';
import { env } from '../config/env';
import { prisma } from '../lib/prisma';
import { logger } from '../lib/logger';
import { verifyAccessToken } from '../lib/jwt';
import { rooms } from '../policies/access';
import { activityService } from '../modules/activity/activity.service';
import type { ClientToServerEvents, ServerToClientEvents, SocketData } from './events';
import { presence } from './presence';
import { publisher, setIO } from './publisher';

/**
 * Socket.io server (WebSocket transport only).
 *
 * Auth: the client sends its (in-memory) access token in the handshake. The
 * same verification as the REST API is applied, and the role is loaded from the DB.
 *
 * Rooms: each socket joins only `user:<id>` (+ `admins` for admins). Clients
 * cannot join or leave rooms themselves — there are no client→server events —
 * so there is no way to subscribe to another team's stream.
 */
export function initRealtime(httpServer: HttpServer) {
  const io = new Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>(httpServer, {
    cors: { origin: env.CLIENT_ORIGINS, credentials: true },
    // WebSocket only. Socket.io would otherwise start on HTTP long-polling and
    // upgrade; the brief rules out long-polling, so that fallback is disabled.
    transports: ['websocket'],
    pingInterval: 20_000,
    pingTimeout: 20_000,
  });
  setIO(io);

  io.use(async (socket, next) => {
    try {
      const token: unknown = socket.handshake.auth?.token;
      if (typeof token !== 'string' || token.length === 0) return next(new Error('UNAUTHORIZED'));
      const { userId } = verifyAccessToken(token);
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, name: true, email: true, role: true, isActive: true, lastSeenAt: true },
      });
      if (!user || !user.isActive) return next(new Error('UNAUTHORIZED'));
      socket.data.user = { id: user.id, name: user.name, email: user.email, role: user.role };
      socket.data.lastSeenAt = user.lastSeenAt;
      return next();
    } catch {
      return next(new Error('UNAUTHORIZED'));
    }
  });

  io.on('connection', (socket) => {
    const { user, lastSeenAt } = socket.data;
    void socket.join(rooms.user(user.id));
    if (user.role === 'ADMIN') void socket.join(rooms.admins);

    // Decide the catch-up window BEFORE registering this socket.
    const since = presence.catchUpSince(user.id, lastSeenAt);
    presence.connect(user.id);
    publisher.presence();

    // Missed-event catch-up: up to 20 in-scope events since the user was last
    // fully offline, read from Postgres (not from any in-memory buffer).
    activityService
      .missedSince(user, since)
      .then((payload) => socket.emit('activity:missed', payload))
      .catch((err) => logger.error('Failed to load missed events', { err: String(err), userId: user.id }));

    socket.on('disconnect', () => {
      if (presence.disconnect(user.id)) {
        prisma.user
          .update({ where: { id: user.id }, data: { lastSeenAt: new Date() } })
          .catch((err) => logger.error('Failed to record lastSeenAt', { err: String(err), userId: user.id }));
      }
      publisher.presence();
    });
  });

  return io;
}
