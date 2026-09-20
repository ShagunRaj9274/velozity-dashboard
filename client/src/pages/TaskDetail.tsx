import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useUser } from '../auth/AuthContext';
import { Page } from '../components/Layout';
import { ActivityFeed } from '../components/ActivityFeed';
import { Avatar, DueDate, OverdueTag, PriorityTag } from '../components/Badges';
import { Icon } from '../components/Icon';
import { StatusControl } from '../components/StatusControl';
import { TaskForm } from '../components/TaskForm';
import { useToast } from '../components/Toasts';
import { useActivity, useDeleteTask, useTask } from '../hooks/queries';
import { errorMessage } from '../lib/api';
import { formatDate, timeAgo } from '../lib/format';
import { useRealtime } from '../realtime/SocketProvider';
import { NotFound } from './NotFound';

export function TaskDetailPage() {
  const id = Number(useParams().id);
  const user = useUser();
  const task = useTask(id);
  const history = useActivity({ taskId: id }, 50);
  const del = useDeleteTask();
  const toast = useToast();
  const navigate = useNavigate();
  const { recentTaskIds } = useRealtime();
  const [editing, setEditing] = useState(false);

  if (task.isError) return <NotFound what="task" />;
  const t = task.data;
  const canManage = !!t && (user.role === 'ADMIN' || (user.role === 'PROJECT_MANAGER' && t.project.ownerId === user.id));

  return (
    <Page
      title={t ? t.title : 'Task'}
      crumbs={
        t && (
          <>
            <Link to={`/projects/${t.project.id}`}>{t.project.name}</Link> / <span className="mono">Task #{t.id}</span>
          </>
        )
      }
      actions={
        canManage && (
          <>
            <button
              className="btn btn--danger"
              onClick={() => {
                if (!t || !confirm(`Delete task #${t.id}? This cannot be undone.`)) return;
                del.mutate(t.id, {
                  onSuccess: () => {
                    toast(`Task #${t.id} deleted`, 'success');
                    navigate(`/projects/${t.project.id}`);
                  },
                  onError: (e) => toast(errorMessage(e), 'error'),
                });
              }}
            >
              Delete
            </button>
            <button className="btn btn--primary" onClick={() => setEditing(true)}>
              <Icon name="edit" size={16} /> Edit
            </button>
          </>
        )
      }
    >
      {!t ? (
        <div className="empty">Loading…</div>
      ) : (
        <div className="detail">
          <div style={{ display: 'grid', gap: 20 }}>
            <section className={`card ${recentTaskIds.has(t.id) ? 'tcard flash' : ''}`} style={{ padding: 0 }}>
              <div className="card-body" style={{ display: 'grid', gap: 12 }}>
                {t.isOverdue && (
                  <div className="alert" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <Icon name="alert" size={16} /> Flagged overdue by the scheduled job
                    {t.overdueSince ? ` ${timeAgo(t.overdueSince)}` : ''}.
                  </div>
                )}
                <h2>Description</h2>
                <p className="description">{t.description || <span className="muted">No description.</span>}</p>
              </div>
            </section>
            <section className="card">
              <div className="card-head">
                <h2>History</h2>
                <span className="pill-count">Stored in the activity log, with actor and timestamp</span>
              </div>
              <div className="card-body">
                {history.data && <ActivityFeed items={history.data.pages.flatMap((p) => p.items)} light groupByDay={false} className="timeline" />}
              </div>
            </section>
          </div>

          <aside className="card">
            <div className="card-body">
              <dl className="props">
                <dt>Status</dt>
                <dd>
                  <StatusControl task={t} />
                </dd>
                <dt>Priority</dt>
                <dd>
                  <PriorityTag priority={t.priority} />
                </dd>
                <dt>Assignee</dt>
                <dd>
                  {t.assignee ? (
                    <span className="who">
                      <Avatar name={t.assignee.name} size="sm" /> {t.assignee.name}
                    </span>
                  ) : (
                    <span className="muted">Unassigned</span>
                  )}
                </dd>
                <dt>Due</dt>
                <dd style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  {formatDate(t.dueDate)} {t.dueDate && <DueDate iso={t.dueDate} done={t.status === 'DONE'} />}
                  {t.isOverdue && <OverdueTag />}
                </dd>
                <dt>Client</dt>
                <dd>{t.project.client.name}</dd>
                <dt>Created by</dt>
                <dd>{t.createdBy.name}</dd>
                <dt>Created</dt>
                <dd>{formatDate(t.createdAt)}</dd>
                <dt>Updated</dt>
                <dd>{timeAgo(t.updatedAt)}</dd>
              </dl>
            </div>
          </aside>
        </div>
      )}
      {editing && t && <TaskForm task={t} onClose={() => setEditing(false)} />}
    </Page>
  );
}
