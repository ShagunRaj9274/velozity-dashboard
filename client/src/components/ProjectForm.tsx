import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../auth/AuthContext';
import { useClients, useProjectManagers, useSaveProject, type ProjectInput } from '../hooks/queries';
import { errorMessage } from '../lib/api';
import type { Project } from '../types';
import { Modal } from './Modal';
import { useToast } from './Toasts';

export function ProjectForm({ project, onClose }: { project?: Project; onClose: () => void }) {
  const user = useUser();
  const isAdmin = user.role === 'ADMIN';
  const clients = useClients();
  const pms = useProjectManagers(isAdmin);
  const save = useSaveProject();
  const toast = useToast();
  const navigate = useNavigate();

  const [form, setForm] = useState<ProjectInput>({
    name: project?.name ?? '',
    description: project?.description ?? '',
    clientId: project?.clientId ?? 0,
    ownerId: project?.ownerId,
  });
  const [error, setError] = useState<string | null>(null);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    const input: ProjectInput = {
      name: form.name,
      description: form.description?.trim() || null,
      clientId: form.clientId || clients.data?.[0]?.id || 0,
      ...(isAdmin && form.ownerId ? { ownerId: form.ownerId } : {}),
    };
    save.mutate(
      { id: project?.id, input },
      {
        onSuccess: (p) => {
          toast(project ? 'Project updated' : `Project "${p.name}" created`, 'success');
          onClose();
          if (!project) navigate(`/projects/${p.id}`);
        },
        onError: (err) => setError(errorMessage(err)),
      },
    );
  };

  return (
    <Modal title={project ? 'Edit project' : 'New project'} onClose={onClose}>
      <form onSubmit={submit}>
        <div className="modal-body">
          {error && <div className="alert" role="alert">{error}</div>}
          <div className="field">
            <label htmlFor="p-name">Name</label>
            <input id="p-name" className="input" value={form.name} minLength={3} maxLength={160} required onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="field">
            <label htmlFor="p-client">Client</label>
            <select id="p-client" className="select" value={form.clientId || clients.data?.[0]?.id || ''} onChange={(e) => setForm({ ...form, clientId: Number(e.target.value) })}>
              {clients.data?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                  {c.company ? ` (${c.company})` : ''}
                </option>
              ))}
            </select>
          </div>
          {isAdmin && (
            <div className="field">
              <label htmlFor="p-owner">Project manager</label>
              <select id="p-owner" className="select" value={form.ownerId ?? ''} onChange={(e) => setForm({ ...form, ownerId: e.target.value ? Number(e.target.value) : undefined })}>
                <option value="">{project ? 'Keep current owner' : 'Me (admin)'}</option>
                {pms.data?.filter((u) => u.isActive).map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="field">
            <label htmlFor="p-desc">Description</label>
            <textarea id="p-desc" className="textarea" value={form.description ?? ''} maxLength={5000} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
        </div>
        <div className="modal-foot">
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn--primary" disabled={save.isPending}>
            {save.isPending ? 'Saving…' : project ? 'Save changes' : 'Create project'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
