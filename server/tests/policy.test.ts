import { describe, expect, it } from 'vitest';
import { activityAudience, activityScope, canManageProject, projectScope, rooms, taskScope } from '../src/policies/access';
import type { AuthUser } from '../src/types/auth';

const admin: AuthUser = { id: 1, name: 'A', email: 'a@x', role: 'ADMIN' };
const pm: AuthUser = { id: 2, name: 'P', email: 'p@x', role: 'PROJECT_MANAGER' };
const dev: AuthUser = { id: 4, name: 'D', email: 'd@x', role: 'DEVELOPER' };

describe('access policy (unit)', () => {
  it('admins are unscoped', () => {
    expect(taskScope(admin)).toEqual({});
    expect(projectScope(admin)).toEqual({});
    expect(activityScope(admin)).toEqual({});
  });

  it('PMs are scoped to projects they own', () => {
    expect(projectScope(pm)).toEqual({ ownerId: 2 });
    expect(taskScope(pm)).toEqual({ project: { ownerId: 2 } });
    expect(activityScope(pm)).toEqual({ project: { ownerId: 2 } });
  });

  it('developers are scoped to tasks assigned to them', () => {
    expect(taskScope(dev)).toEqual({ assigneeId: 4 });
    expect(activityScope(dev)).toEqual({ task: { assigneeId: 4 } });
  });

  it('only admins and the owning PM can manage a project', () => {
    expect(canManageProject(admin, { ownerId: 99 })).toBe(true);
    expect(canManageProject(pm, { ownerId: 2 })).toBe(true);
    expect(canManageProject(pm, { ownerId: 3 })).toBe(false);
    expect(canManageProject(dev, { ownerId: 4 })).toBe(false);
  });

  it('realtime audience = admins + project owner + assignee, deduplicated', () => {
    expect(activityAudience({ projectOwnerId: 2, assigneeId: 4 }).sort()).toEqual([rooms.admins, 'user:2', 'user:4'].sort());
    expect(activityAudience({ projectOwnerId: 2, assigneeId: null }).sort()).toEqual([rooms.admins, 'user:2'].sort());
    expect(activityAudience({ projectOwnerId: 2, assigneeId: 2 })).toHaveLength(2);
  });
});
