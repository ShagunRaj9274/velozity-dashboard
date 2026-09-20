import { useState, type FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Icon } from '../components/Icon';
import { Page } from '../components/Layout';
import { Modal } from '../components/Modal';
import { useToast } from '../components/Toasts';
import { useClients } from '../hooks/queries';
import { api, errorMessage } from '../lib/api';
import type { Client } from '../types';

export function ClientsPage() {
  const clients = useClients();
  const qc = useQueryClient();
  const toast = useToast();
  const [editing, setEditing] = useState<Client | 'new' | null>(null);

  const remove = useMutation({
    mutationFn: (id: number) => api.delete(`/clients/${id}`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['clients'] });
      toast('Client removed', 'success');
    },
    onError: (e) => toast(errorMessage(e), 'error'),
  });

  return (
    <Page
      title="Clients"
      crumbs="Organisations projects are delivered for"
      actions={
        <button className="btn btn--primary" onClick={() => setEditing('new')}>
          <Icon name="plus" size={16} /> New client
        </button>
      }
    >
      <section className="card">
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Client</th>
                <th>Contact</th>
                <th>Projects</th>
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {clients.isLoading && (
                <tr>
                  <td colSpan={4}>
                    <div className="skeleton" />
                  </td>
                </tr>
              )}
              {clients.data?.map((c) => {
                const count = c._count?.projects ?? 0;
                return (
                  <tr key={c.id}>
                    <td>
                      <div className="task-title">{c.name}</div>
                      {c.company && <div className="task-sub">{c.company}</div>}
                    </td>
                    <td className="muted">{c.email ?? '—'}</td>
                    <td className="mono">{count}</td>
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <button className="btn btn--sm btn--ghost" onClick={() => setEditing(c)}>
                        Edit
                      </button>
                      <button
                        className="btn btn--sm btn--ghost"
                        disabled={count > 0 || remove.isPending}
                        title={count > 0 ? 'Clients with projects cannot be deleted' : undefined}
                        onClick={() => window.confirm(`Delete ${c.name}?`) && remove.mutate(c.id)}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
      {editing && <ClientForm client={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} />}
    </Page>
  );
}

function ClientForm({ client, onClose }: { client?: Client; onClose: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [form, setForm] = useState({ name: client?.name ?? '', company: client?.company ?? '', email: client?.email ?? '' });
  const [error, setError] = useState<string | null>(null);
  const save = useMutation({
    mutationFn: async () => {
      const body = { name: form.name, company: form.company.trim() || null, email: form.email.trim() || null };
      return client ? api.patch(`/clients/${client.id}`, body) : api.post('/clients', body);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['clients'] });
      toast(client ? 'Client updated' : 'Client added', 'success');
      onClose();
    },
    onError: (e) => setError(errorMessage(e)),
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    save.mutate();
  };

  return (
    <Modal title={client ? 'Edit client' : 'New client'} onClose={onClose}>
      <form onSubmit={submit}>
        <div className="modal-body">
          {error && <div className="alert" role="alert">{error}</div>}
          <div className="field">
            <label htmlFor="c-name">Name</label>
            <input id="c-name" className="input" required minLength={2} maxLength={160} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="form-grid">
            <div className="field">
              <label htmlFor="c-company">Company</label>
              <input id="c-company" className="input" maxLength={160} value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} />
            </div>
            <div className="field">
              <label htmlFor="c-email">Contact email</label>
              <input id="c-email" type="email" className="input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
          </div>
        </div>
        <div className="modal-foot">
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn--primary" disabled={save.isPending}>
            {save.isPending ? 'Saving…' : 'Save'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
