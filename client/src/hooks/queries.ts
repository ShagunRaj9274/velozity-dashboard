import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import type {
  ActivityPage,
  AdminUser,
  Client,
  Dashboard,
  Notification,
  Paginated,
  Priority,
  Project,
  Task,
  TaskStatus,
} from '../types';

/**
 * Every server read lives here, keyed consistently so the SocketProvider can
 * invalidate / patch exactly the right caches when an event arrives.
 */

export function useDashboard() {
  const qc = useQueryClient();
  return useQuery({
    queryKey: ['dashboard'],
    queryFn: async () => {
      const d = (await api.get<Dashboard>('/dashboard')).data;
      if (d.role === 'ADMIN') qc.setQueryData(['presence'], d.onlineUsers);
      return d;
    },
  });
}

export const useProjects = () =>
  useQuery({ queryKey: ['projects'], queryFn: async () => (await api.get<Project[]>('/projects')).data });

export const useProject = (id: number) =>
  useQuery({
    queryKey: ['projects', id],
    queryFn: async () => (await api.get<Project>(`/projects/${id}`)).data,
    enabled: Number.isFinite(id),
  });

/** Query string straight from the URL — the same string the API receives. */
export const useTasks = (search: string) =>
  useQuery({
    queryKey: ['tasks', search],
    queryFn: async () => (await api.get<Paginated<Task>>(`/tasks${search ? `?${search}` : ''}`)).data,
    placeholderData: (prev) => prev,
  });

export const useTask = (id: number) =>
  useQuery({
    queryKey: ['task', id],
    queryFn: async () => (await api.get<Task>(`/tasks/${id}`)).data,
    enabled: Number.isFinite(id),
  });

export interface ActivityFilter {
  projectId?: number;
  taskId?: number;
}

export const useActivity = (filter: ActivityFilter = {}, limit = 25) =>
  useInfiniteQuery({
    queryKey: ['activity', filter],
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam }) =>
      (
        await api.get<ActivityPage>('/activity', {
          params: { ...filter, limit, cursor: pageParam },
        })
      ).data,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });

export const useNotifications = (enabled: boolean) =>
  useQuery({
    queryKey: ['notifications', 'list'],
    queryFn: async () => (await api.get<{ items: Notification[]; unread: number }>('/notifications?limit=30')).data,
    enabled,
  });

/** Fetched once; afterwards the WebSocket `notification:count` event overwrites it. */
export const useUnreadCount = () =>
  useQuery({
    queryKey: ['notifications', 'count'],
    queryFn: async () => (await api.get<{ unread: number }>('/notifications/unread-count')).data.unread,
    staleTime: Infinity,
  });

/**
 * Live "online now" count. Seeded from the admin dashboard payload, then
 * overwritten by every `presence:update` WebSocket event. Never fetched on its own.
 */
export const usePresence = () =>
  useQuery<number>({ queryKey: ['presence'], queryFn: () => 0, enabled: false, staleTime: Infinity }).data;

export const useClients = (enabled = true) =>
  useQuery({ queryKey: ['clients'], queryFn: async () => (await api.get<Client[]>('/clients')).data, enabled });

export const useAssignable = (enabled = true) =>
  useQuery({
    queryKey: ['assignable'],
    queryFn: async () => (await api.get<{ id: number; name: string; email: string }[]>('/users/assignable')).data,
    enabled,
  });

export const useUsers = () =>
  useQuery({ queryKey: ['users'], queryFn: async () => (await api.get<AdminUser[]>('/users')).data });

export const useProjectManagers = (enabled: boolean) =>
  useQuery({
    queryKey: ['users', 'pms'],
    queryFn: async () => (await api.get<AdminUser[]>('/users?role=PROJECT_MANAGER')).data,
    enabled,
  });

// ─── Mutations ───────────────────────────────────────────────────────────────

export function useUpdateStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { id: number; status: TaskStatus; expectedStatus: TaskStatus }) =>
      (await api.patch<Task>(`/tasks/${v.id}/status`, { status: v.status, expectedStatus: v.expectedStatus })).data,
    onSuccess: (task) => {
      qc.setQueryData(['task', task.id], task);
      void qc.invalidateQueries({ queryKey: ['tasks'] });
      void qc.invalidateQueries({ queryKey: ['dashboard'] });
    },
    onError: () => void qc.invalidateQueries({ queryKey: ['tasks'] }), // 409 → show the real state
  });
}

export interface TaskInput {
  projectId: number;
  title: string;
  description: string | null;
  assigneeId: number | null;
  priority: Priority;
  status: TaskStatus;
  dueDate: string | null;
}

export function useSaveTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, input }: { id?: number; input: TaskInput }) => {
      if (id) {
        const { projectId: _ignored, ...patch } = input;
        void _ignored;
        return (await api.patch<Task>(`/tasks/${id}`, patch)).data;
      }
      return (await api.post<Task>('/tasks', input)).data;
    },
    onSuccess: (task) => {
      qc.setQueryData(['task', task.id], task);
      void qc.invalidateQueries({ queryKey: ['tasks'] });
      void qc.invalidateQueries({ queryKey: ['projects'] });
      void qc.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export function useDeleteTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => api.delete(`/tasks/${id}`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['tasks'] });
      void qc.invalidateQueries({ queryKey: ['projects'] });
      void qc.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export interface ProjectInput {
  name: string;
  description: string | null;
  clientId: number;
  ownerId?: number;
}

export function useSaveProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, input }: { id?: number; input: ProjectInput }) =>
      id ? (await api.patch<Project>(`/projects/${id}`, input)).data : (await api.post<Project>('/projects', input)).data,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['projects'] });
      void qc.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export function useMarkRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number | 'all') =>
      id === 'all' ? api.patch('/notifications/read-all') : api.patch(`/notifications/${id}/read`),
    onMutate: (id) => {
      const now = new Date().toISOString();
      qc.setQueryData<{ items: Notification[]; unread: number }>(['notifications', 'list'], (d) =>
        d
          ? { ...d, items: d.items.map((n) => (id === 'all' || n.id === id ? { ...n, readAt: n.readAt ?? now } : n)) }
          : d,
      );
      // The authoritative count arrives over the socket (notification:count).
    },
  });
}
