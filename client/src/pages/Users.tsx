import { useState, type FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useUser } from '../auth/AuthContext';
import { Avatar } from '../components/Badges';
import { Icon } from '../components/Icon';
import { Page } from '../components/Layout';
import { Modal } from '../components/Modal';
import { useToast } from '../components/Toasts';
import { usePresence, useUsers } from '../hooks/queries';
import { useNow } from '../hooks/useNow';
import { api, errorMessage } from '../lib/api';
import { ROLE_LABEL, timeAgo } from '../lib/format';
import type { AdminUser, Role } from '../types';

const ROLES: Role[] = ['ADMIN', 'PROJECT_MANAGER', 'DEVELOPER'];

function useUpdateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { id: number; patch: Partial<Pick<AdminUser, 'name' | 'role' | 'isActive'>> }) =>
      (await api.patch<AdminUser>(`/users/${v.id}`, v.patch)).data,
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['users'] }),
  });
}

export function UsersPage() {
  const me = useUser();
  const users = useUsers();
  const online = usePresence();
  const update = useUpdateUser();
  const toast = useToast();
  const now = useNow();
  const [creating, setCreating] = useState(false);

  const change = (u: AdminUser, patch: Partial<Pick<AdminUser, 'role' | 'isActive'>>) =>
    update.mutate(
      { id: u.id, patch },
      {
        onSuccess: () => toast(`${u.name} updated — their sessions were revoked`, 'success'),
        onError: (e) => toast(errorMessage(e), 'error'),
      },
    );

  return (
    <Page
      title="Users"
      crumbs={online !== undefined ? `${online} online now` : 'Team directory'}
      actions={
        <button className="btn btn--primary" onClick={() => setCreating(true)}>
          <Icon name="plus" size={16} /> New user
        </button>
      }
    >
      <section className="card">
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Role</th>
                <th>Status</th>
                <th>Last seen</th>
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {users.isLoading && (
                <tr>
                  <td colSpan={5}>
                    <div className="skeleton" />
                  </td>
                </tr>
              )}
              {users.data?.map((u) => {
                const self = u.id === me.id;
                return (
                  <tr key={u.id} style={u.isActive ? undefined : { opacity: 0.55 }}>
                    <td>
                      <div className="who">
                        <Avatar name={u.name} size="sm" />
                        <div>
                          <div className="task-title">{u.name}{self && <span className="muted"> (you)</span>}</div>
                          <div className="task-sub">{u.email}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <select
                        className="select"
                        aria-label={`Role for ${u.name}`}
                        value={u.role}
                        disabled={self || update.isPending}
                        onChange={(e) => change(u, { role: e.target.value as Role })}
                      >
                        {ROLES.map((r) => (
                          <option key={r} value={r}>
                            {ROLE_LABEL[r]}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      {!u.isActive ? (
                        <span className="badge">Deactivated</span>
                      ) : u.online ? (
                        <span className="live live--live"><span className="live-dot" /><span className="live-label">Online</span></span>
                      ) : (
                        <span className="muted">Offline</span>
                      )}
                    </td>
                    <td className="muted">{u.lastSeenAt ? timeAgo(u.lastSeenAt, now) : 'Never'}</td>
                    <td style={{ textAlign: 'right' }}>
                      {!self && (
                        <button
                          className={`btn btn--sm ${u.isActive ? 'btn--danger' : ''}`}
                          disabled={update.isPending}
                          onClick={() => change(u, { isActive: !u.isActive })}
                        >
                          {u.isActive ? 'Deactivate' : 'Reactivate'}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
      <p className="muted" style={{ marginTop: 12, fontSize: 13 }}>
        Changing a role or deactivating a user revokes every refresh token they hold. Their access token is re-checked
        against the database on each request, so the change applies immediately.
      </p>
      {creating && <UserForm onClose={() => setCreating(false)} />}
    </Page>
  );
}

function UserForm({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'DEVELOPER' as Role });
  const [error, setError] = useState<string | null>(null);
  const create = useMutation({
    mutationFn: async () => (await api.post<AdminUser>('/users', form)).data,
    onSuccess: (u) => {
      void qc.invalidateQueries({ queryKey: ['users'] });
      void qc.invalidateQueries({ queryKey: ['assignable'] });
      toast(`${u.name} can now sign in`, 'success');
      onClose();
    },
    onError: (e) => setError(errorMessage(e)),
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    create.mutate();
  };

  return (
    <Modal title="New user" onClose={onClose}>
      <form onSubmit={submit}>
        <div className="modal-body">
          {error && <div className="alert" role="alert">{error}</div>}
          <div className="field">
            <label htmlFor="u-name">Full name</label>
            <input id="u-name" className="input" required minLength={2} maxLength={120} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="field">
            <label htmlFor="u-email">Email</label>
            <input id="u-email" type="email" className="input" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          <div className="form-grid">
            <div className="field">
              <label htmlFor="u-pass">Temporary password</label>
              <input id="u-pass" type="password" className="input" required minLength={8} maxLength={72} autoComplete="new-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
            </div>
            <div className="field">
              <label htmlFor="u-role">Role</label>
              <select id="u-role" className="select" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as Role })}>
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABEL[r]}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
        <div className="modal-foot">
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn--primary" disabled={create.isPending}>
            {create.isPending ? 'Creating…' : 'Create user'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
