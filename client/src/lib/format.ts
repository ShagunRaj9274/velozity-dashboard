import type { Activity, Priority, Role, TaskStatus } from '../types';

export const STATUS_LABEL: Record<TaskStatus, string> = {
  TODO: 'To Do',
  IN_PROGRESS: 'In Progress',
  IN_REVIEW: 'In Review',
  DONE: 'Done',
};

export const PRIORITY_LABEL: Record<Priority, string> = {
  LOW: 'Low',
  MEDIUM: 'Medium',
  HIGH: 'High',
  CRITICAL: 'Critical',
};

export const ROLE_LABEL: Record<Role, string> = {
  ADMIN: 'Admin',
  PROJECT_MANAGER: 'Project Manager',
  DEVELOPER: 'Developer',
};

/** "just now", "2 mins ago", "3 hours ago", "yesterday", "12 Sep" */
export function timeAgo(iso: string, now = Date.now()): string {
  const diff = Math.max(0, now - new Date(iso).getTime());
  const s = Math.floor(diff / 1000);
  if (s < 45) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${Math.max(1, m)} min${m === 1 ? '' : 's'} ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} hour${h === 1 ? '' : 's'} ago`;
  const d = Math.floor(h / 24);
  if (d === 1) return 'yesterday';
  if (d < 7) return `${d} days ago`;
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

export function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

/** Days until due: negative = past. */
export function daysUntil(iso: string, now = Date.now()): number {
  return Math.ceil((new Date(iso).getTime() - now) / 86_400_000);
}

export function dueLabel(iso: string | null): string {
  if (!iso) return 'No due date';
  const d = daysUntil(iso);
  if (d < 0) return `${Math.abs(d)}d late`;
  if (d === 0) return 'Due today';
  if (d === 1) return 'Due tomorrow';
  return `Due in ${d}d`;
}

export const firstName = (name: string) => name.split(' ')[0] ?? name;

/** The sentence for a feed item, e.g. "Ravi moved Task #12 from In Progress → In Review". */
export function describeActivity(a: Activity): { actor: string; text: string } {
  const actor = a.actor ? firstName(a.actor.name) : 'System';
  const task = a.task ? `Task #${a.task.id}` : 'a task';
  switch (a.type) {
    case 'STATUS_CHANGED':
      return {
        actor,
        text: `moved ${task} from ${a.fromStatus ? STATUS_LABEL[a.fromStatus] : '?'} → ${a.toStatus ? STATUS_LABEL[a.toStatus] : '?'}`,
      };
    case 'TASK_CREATED': {
      const who = typeof a.meta?.assigneeName === 'string' ? ` for ${firstName(a.meta.assigneeName)}` : '';
      return { actor, text: `created ${task}${who}` };
    }
    case 'TASK_ASSIGNED': {
      const to = typeof a.meta?.to === 'string' ? firstName(a.meta.to) : 'nobody';
      return { actor, text: `assigned ${task} to ${to}` };
    }
    case 'TASK_UPDATED': {
      const fields = Array.isArray(a.meta?.fields) ? (a.meta.fields as string[]).join(', ') : 'details';
      return { actor, text: `updated the ${fields} of ${task}` };
    }
    case 'TASK_OVERDUE':
      return { actor, text: `flagged ${task} as overdue` };
    case 'PROJECT_CREATED':
      return { actor, text: `created project ${a.project.name}` };
  }
}

export const initials = (name: string) =>
  name
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
