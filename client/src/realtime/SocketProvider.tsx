import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { io, type Socket } from 'socket.io-client';
import { useQueryClient, type InfiniteData } from '@tanstack/react-query';
import { getAccessToken, refreshSession } from '../lib/api';
import { useAuth } from '../auth/AuthContext';
import { useToast } from '../components/Toasts';
import type { Activity, ActivityPage, MissedPayload, Notification } from '../types';

interface ServerToClientEvents {
  'activity:new': (a: Activity) => void;
  'activity:missed': (p: MissedPayload) => void;
  'task:revoked': (p: { taskId: number }) => void;
  'notification:new': (n: Notification) => void;
  'notification:count': (p: { unread: number }) => void;
  'presence:update': (p: { online: number }) => void;
}

type ConnectionState = 'connecting' | 'live' | 'offline';

interface SocketContextValue {
  connection: ConnectionState;
  missed: MissedPayload | null;
  dismissMissed: () => void;
  /** task ids changed in the last few seconds — used to flash rows */
  recentTaskIds: ReadonlySet<number>;
}

const SocketContext = createContext<SocketContextValue>({
  connection: 'offline',
  missed: null,
  dismissMissed: () => undefined,
  recentTaskIds: new Set(),
});

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || undefined; // undefined = same origin

/**
 * Owns the single WebSocket connection and turns server events into cache
 * updates. Components never talk to the socket directly — they read React
 * Query caches, which this provider keeps current.
 */
export function SocketProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [connection, setConnection] = useState<ConnectionState>('offline');
  const [missed, setMissed] = useState<MissedPayload | null>(null);
  const [recentTaskIds, setRecent] = useState<Set<number>>(new Set());
  const socketRef = useRef<Socket<ServerToClientEvents> | null>(null);

  useEffect(() => {
    if (!user) return;
    setConnection('connecting');

    const socket: Socket<ServerToClientEvents> = io(SOCKET_URL, {
      transports: ['websocket'], // WebSocket only — no long-polling fallback
      auth: (cb) => cb({ token: getAccessToken() }), // re-read on every (re)connect
      reconnectionDelayMax: 10_000,
    });
    socketRef.current = socket;

    const flash = (taskId: number) => {
      setRecent((s) => new Set(s).add(taskId));
      setTimeout(() => setRecent((s) => {
        const next = new Set(s);
        next.delete(taskId);
        return next;
      }), 2500);
    };

    let connectedBefore = false;
    socket.on('connect', () => {
      setConnection('live');
      // After a drop, anything may have changed while we weren't listening:
      // refetch active views once (the server also re-sends the missed digest).
      if (connectedBefore) void queryClient.invalidateQueries();
      connectedBefore = true;
    });
    socket.on('disconnect', () => setConnection('offline'));
    socket.on('connect_error', async (err) => {
      setConnection('offline');
      if (err.message === 'UNAUTHORIZED') {
        // Access token expired while disconnected: refresh, then reconnect.
        try {
          await refreshSession();
          socket.connect();
        } catch {
          /* session expired — AuthProvider handles sign-out on next API call */
        }
      }
    });

    socket.on('activity:new', (activity) => {
      // 1. Prepend to every cached feed whose filter matches this event.
      for (const query of queryClient.getQueryCache().findAll({ queryKey: ['activity'] })) {
        const filter = (query.queryKey[1] ?? {}) as { projectId?: number };
        if (filter.projectId && filter.projectId !== activity.project.id) continue;
        queryClient.setQueryData<InfiniteData<ActivityPage>>(query.queryKey, (data) => {
          if (!data?.pages[0] || data.pages[0].items.some((x) => x.id === activity.id)) return data;
          const [first, ...rest] = data.pages;
          return { ...data, pages: [{ ...first, items: [activity, ...first.items] }, ...rest] };
        });
      }
      // 2. Refetch the (server-scoped) views this event can affect.
      void queryClient.invalidateQueries({ queryKey: ['tasks'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      void queryClient.invalidateQueries({ queryKey: ['projects'] });
      if (activity.task) {
        void queryClient.invalidateQueries({ queryKey: ['task', activity.task.id] });
        flash(activity.task.id);
      }
    });

    socket.on('activity:missed', (payload) => {
      if (payload.total > 0) setMissed(payload);
    });

    socket.on('task:revoked', ({ taskId }) => {
      queryClient.removeQueries({ queryKey: ['task', taskId] });
      void queryClient.invalidateQueries({ queryKey: ['tasks'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    });

    socket.on('notification:new', (n) => {
      queryClient.setQueryData<{ items: Notification[]; unread: number }>(['notifications', 'list'], (data) =>
        data ? { ...data, items: [n, ...data.items.filter((x) => x.id !== n.id)] } : data,
      );
      toast(n.title);
    });

    socket.on('notification:count', ({ unread }) => {
      queryClient.setQueryData(['notifications', 'count'], unread);
    });

    socket.on('presence:update', ({ online }) => {
      queryClient.setQueryData(['presence'], online);
    });

    return () => {
      socket.removeAllListeners();
      socket.disconnect();
      socketRef.current = null;
      setConnection('offline');
    };
  }, [user, queryClient, toast]);

  const value = useMemo(
    () => ({ connection, missed, dismissMissed: () => setMissed(null), recentTaskIds }),
    [connection, missed, recentTaskIds],
  );
  return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>;
}

export const useRealtime = () => useContext(SocketContext);
