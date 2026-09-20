import type { Prisma } from '@prisma/client';
import type { AuthUser } from '../types/auth';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  Row-level access policy — the single source of truth for "who sees what".
 * ─────────────────────────────────────────────────────────────────────────────
 * Every list / read query in every service is AND-ed with one of these scopes,
 * so an out-of-scope row is filtered by Postgres itself — it never reaches
 * application code. Out-of-scope reads by ID therefore return 404 (not 403),
 * which also prevents probing for the existence of other teams' records.
 *
 *   ADMIN            → everything
 *   PROJECT_MANAGER  → projects they own, and everything inside them
 *   DEVELOPER        → only tasks assigned to them (and activity on those tasks)
 */

export function projectScope(user: AuthUser): Prisma.ProjectWhereInput {
  switch (user.role) {
    case 'ADMIN':
      return {};
    case 'PROJECT_MANAGER':
      return { ownerId: user.id };
    case 'DEVELOPER':
      return { tasks: { some: { assigneeId: user.id } } };
  }
}

export function taskScope(user: AuthUser): Prisma.TaskWhereInput {
  switch (user.role) {
    case 'ADMIN':
      return {};
    case 'PROJECT_MANAGER':
      return { project: { ownerId: user.id } };
    case 'DEVELOPER':
      return { assigneeId: user.id };
  }
}

export function activityScope(user: AuthUser): Prisma.ActivityLogWhereInput {
  switch (user.role) {
    case 'ADMIN':
      return {};
    case 'PROJECT_MANAGER':
      return { project: { ownerId: user.id } };
    case 'DEVELOPER':
      return { task: { assigneeId: user.id } };
  }
}

/** Only admins and the owning PM may modify a project or its tasks. */
export function canManageProject(user: AuthUser, project: { ownerId: number }): boolean {
  return user.role === 'ADMIN' || (user.role === 'PROJECT_MANAGER' && project.ownerId === user.id);
}

// ── Realtime audiences ──────────────────────────────────────────────────────
// The same policy, expressed as Socket.io rooms. Every socket joins exactly one
// personal room (`user:<id>`), and admins also join `admins`. An event about a
// task is delivered ONLY to: all admins, the owner of the task's project, and
// the task's current assignee. Nothing is broadcast globally.

export const rooms = {
  admins: 'admins',
  user: (id: number) => `user:${id}`,
} as const;

export function activityAudience(target: { projectOwnerId: number; assigneeId: number | null }): string[] {
  const audience = new Set<string>([rooms.admins, rooms.user(target.projectOwnerId)]);
  if (target.assigneeId !== null) audience.add(rooms.user(target.assigneeId));
  return [...audience];
}
