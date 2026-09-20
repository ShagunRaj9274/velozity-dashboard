// Mirrors the API contract (server/src/modules/**/*.dto.ts, realtime/events.ts).

export type Role = 'ADMIN' | 'PROJECT_MANAGER' | 'DEVELOPER';
export type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'IN_REVIEW' | 'DONE';
export type Priority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type ActivityType =
  | 'PROJECT_CREATED'
  | 'TASK_CREATED'
  | 'TASK_UPDATED'
  | 'TASK_ASSIGNED'
  | 'STATUS_CHANGED'
  | 'TASK_OVERDUE';
export type NotificationType = 'TASK_ASSIGNED' | 'TASK_IN_REVIEW' | 'TASK_OVERDUE';

export const STATUSES: TaskStatus[] = ['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE'];
export const PRIORITIES: Priority[] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];

export interface User {
  id: number;
  name: string;
  email: string;
  role: Role;
}

export interface AdminUser extends User {
  isActive: boolean;
  lastSeenAt: string | null;
  createdAt: string;
  online: boolean;
}

export interface Client {
  id: number;
  name: string;
  company: string | null;
  email: string | null;
  _count?: { projects: number };
}

export interface ProjectStats {
  total: number;
  overdue: number;
  byStatus: Record<TaskStatus, number>;
}

export interface Project {
  id: number;
  name: string;
  description: string | null;
  clientId: number;
  ownerId: number;
  createdAt: string;
  updatedAt: string;
  client: { id: number; name: string; company: string | null };
  owner: { id: number; name: string };
  stats: ProjectStats;
  canManage: boolean;
}

export interface Task {
  id: number;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: Priority;
  dueDate: string | null;
  isOverdue: boolean;
  overdueSince: string | null;
  projectId: number;
  assigneeId: number | null;
  createdAt: string;
  updatedAt: string;
  assignee: { id: number; name: string; email: string } | null;
  project: { id: number; name: string; ownerId: number; client: { id: number; name: string } };
  createdBy: { id: number; name: string };
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface Activity {
  id: number;
  type: ActivityType;
  createdAt: string;
  project: { id: number; name: string };
  task: { id: number; title: string } | null;
  actor: { id: number; name: string; role: Role } | null;
  fromStatus: TaskStatus | null;
  toStatus: TaskStatus | null;
  meta: Record<string, unknown> | null;
}

export interface ActivityPage {
  items: Activity[];
  nextCursor: string | null;
}

export interface MissedPayload {
  since: string | null;
  total: number;
  events: Activity[];
}

export interface Notification {
  id: number;
  type: NotificationType;
  title: string;
  body: string;
  taskId: number | null;
  readAt: string | null;
  createdAt: string;
}

export interface AdminDashboard {
  role: 'ADMIN';
  totals: { projects: number; tasks: number; users: number };
  tasksByStatus: Record<TaskStatus, number>;
  overdueCount: number;
  onlineUsers: number;
}

export interface PmDashboard {
  role: 'PROJECT_MANAGER';
  projects: Project[];
  openTasksByPriority: Record<Priority, number>;
  dueThisWeek: Task[];
  overdueCount: number;
}

export interface DevDashboard {
  role: 'DEVELOPER';
  tasks: Task[];
  tasksByStatus: Record<TaskStatus, number>;
  overdueCount: number;
  dueThisWeekCount: number;
}

export type Dashboard = AdminDashboard | PmDashboard | DevDashboard;

export interface ApiErrorBody {
  error: { code: string; message: string; details?: { field: string; message: string }[]; requestId?: string };
}
