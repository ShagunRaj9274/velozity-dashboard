import { useState, type FormEvent } from 'react';
import axios from 'axios';
import { useAssignable, useProjects, useSaveTask, type TaskInput } from '../hooks/queries';
import { errorMessage } from '../lib/api';
import { PRIORITY_LABEL, STATUS_LABEL } from '../lib/format';
import { PRIORITIES, STATUSES, type ApiErrorBody, type Task } from '../types';
import { Modal } from './Modal';
import { useToast } from './Toasts';

const toDateInput = (iso: string | null) => (iso ? iso.slice(0, 10) : '');

/** Create / edit a task. The server re-validates everything (zod, strict bodies). */
export function TaskForm({ task, projectId, onClose }: { task?: Task; projectId?: number; onClose: () => void }) {
  const projects = useProjects();
  const devs = useAssignable();
  const save = useSaveTask();
  const toast = useToast();
  const manageable = projects.data?.filter((p) => p.canManage) ?? [];

  const [form, setForm] = useState<TaskInput>({
    projectId: task?.projectId ?? projectId ?? 0,
    title: task?.title ?? '',
    description: task?.description ?? '',
    assigneeId: task?.assigneeId ?? null,
    priority: task?.priority ?? 'MEDIUM',
    status: task?.status ?? 'TODO',
    dueDate: toDateInput(task?.dueDate ?? null),
  });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  const set = <K extends keyof TaskInput>(k: K, v: TaskInput[K]) => setForm((f) => ({ ...f, [k]: v }));

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setFieldErrors({});
    const input: TaskInput = {
      ...form,
      projectId: form.projectId || manageable[0]?.id || 0,
      description: form.description?.trim() || null,
      dueDate: form.dueDate ? new Date(`${form.dueDate}T23:59:59`).toISOString() : null,
    };
    save.mutate(
      { id: task?.id, input },
      {
        onSuccess: (t) => {
          toast(task ? `Task #${t.id} updated` : `Task #${t.id} created`, 'success');
          onClose();
        },
        onError: (err) => {
          if (axios.isAxiosError<ApiErrorBody>(err) && err.response?.data?.error?.details) {
            setFieldErrors(Object.fromEntries(err.response.data.error.details.map((d) => [d.field, d.message])));
          }
          setError(errorMessage(err));
        },
      },
    );
  };

  return (
    <Modal
      title={task ? `Edit task #${task.id}` : 'New task'}
      onClose={onClose}
    >
      <form onSubmit={submit}>
        <div className="modal-body">
          {error && <div className="alert" role="alert">{error}</div>}
          <div className="form-grid">
            {!task && (
              <div className="field span-2">
                <label htmlFor="t-project">Project</label>
                <select id="t-project" className="select" value={form.projectId || manageable[0]?.id || ''} onChange={(e) => set('projectId', Number(e.target.value))} required>
                  {manageable.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} — {p.client.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div className="field span-2">
              <label htmlFor="t-title">Title</label>
              <input id="t-title" className="input" value={form.title} onChange={(e) => set('title', e.target.value)} minLength={3} maxLength={200} required />
              {fieldErrors.title && <span className="field-error">{fieldErrors.title}</span>}
            </div>
            <div className="field span-2">
              <label htmlFor="t-desc">Description</label>
              <textarea id="t-desc" className="textarea" value={form.description ?? ''} onChange={(e) => set('description', e.target.value)} maxLength={5000} />
            </div>
            <div className="field">
              <label htmlFor="t-assignee">Assignee</label>
              <select id="t-assignee" className="select" value={form.assigneeId ?? ''} onChange={(e) => set('assigneeId', e.target.value ? Number(e.target.value) : null)}>
                <option value="">Unassigned</option>
                {devs.data?.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
              {fieldErrors.assigneeId && <span className="field-error">{fieldErrors.assigneeId}</span>}
            </div>
            <div className="field">
              <label htmlFor="t-due">Due date</label>
              <input id="t-due" type="date" className="input" value={form.dueDate ?? ''} onChange={(e) => set('dueDate', e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="t-priority">Priority</label>
              <select id="t-priority" className="select" value={form.priority} onChange={(e) => set('priority', e.target.value as TaskInput['priority'])}>
                {PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {PRIORITY_LABEL[p]}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="t-status">Status</label>
              <select id="t-status" className="select" value={form.status} onChange={(e) => set('status', e.target.value as TaskInput['status'])}>
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {STATUS_LABEL[s]}
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
          <button type="submit" className="btn btn--primary" disabled={save.isPending || (!task && manageable.length === 0)}>
            {save.isPending ? 'Saving…' : task ? 'Save changes' : 'Create task'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
