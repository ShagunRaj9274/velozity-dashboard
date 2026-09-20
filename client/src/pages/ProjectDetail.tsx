import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Page } from '../components/Layout';
import { ActivityFeed } from '../components/ActivityFeed';
import { Avatar, DueDate, OverdueTag, PriorityTag } from '../components/Badges';
import { StatusStack } from '../components/Charts';
import { Icon } from '../components/Icon';
import { ProjectForm } from '../components/ProjectForm';
import { StatusControl } from '../components/StatusControl';
import { TaskFilters, useFilterParams } from '../components/TaskFilters';
import { TaskForm } from '../components/TaskForm';
import { TaskTable } from '../components/TaskTable';
import { useActivity, useProject, useTasks } from '../hooks/queries';
import { useRealtime } from '../realtime/SocketProvider';
import { STATUS_LABEL } from '../lib/format';
import { STATUSES, type Task } from '../types';
import { NotFound } from './NotFound';

export function ProjectDetailPage() {
  const id = Number(useParams().id);
  const project = useProject(id);
  const { params, update } = useFilterParams();
  const view = params.get('view') === 'list' ? 'list' : 'board';

  const query = useMemo(() => {
    const q = new URLSearchParams(params);
    q.delete('view');
    q.set('projectId', String(id));
    q.set('pageSize', '100');
    return q.toString();
  }, [params, id]);

  const tasks = useTasks(query);
  const feed = useActivity({ projectId: id }, 20);
  const [editing, setEditing] = useState(false);
  const [newTask, setNewTask] = useState(false);

  if (project.isError) return <NotFound what="project" />;
  const p = project.data;

  return (
    <Page
      title={p?.name ?? 'Project'}
      crumbs={
        <>
          <Link to="/projects">Projects</Link> / {p?.client.name}
        </>
      }
      actions={
        p?.canManage && (
          <>
            <button className="btn" onClick={() => setEditing(true)}>
              <Icon name="edit" size={16} /> Edit
            </button>
            <button className="btn btn--primary" onClick={() => setNewTask(true)}>
              <Icon name="plus" size={16} /> New task
            </button>
          </>
        )
      }
    >
      {p && (
        <section className="card">
          <div className="card-body" style={{ display: 'grid', gap: 14 }}>
            <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', fontSize: 13 }}>
              <span>
                <span className="muted">Client</span> {p.client.name}
                {p.client.company ? ` · ${p.client.company}` : ''}
              </span>
              <span className="who">
                <span className="muted">Manager</span> <Avatar name={p.owner.name} size="sm" /> {p.owner.name}
              </span>
              <span>
                <span className="muted">Tasks</span> {p.stats.total}
              </span>
              {p.stats.overdue > 0 && <span className="overdue-tag">{p.stats.overdue} overdue</span>}
            </div>
            {p.description && <p className="description">{p.description}</p>}
            <StatusStack counts={p.stats.byStatus} />
          </div>
        </section>
      )}

      <div className="section-title">
        <h2>Tasks</h2>
        <div className="segmented" role="group" aria-label="View">
          <button aria-pressed={view === 'board'} onClick={() => update({ view: null, page: params.get('page') })}>
            <Icon name="board" size={14} /> Board
          </button>
          <button aria-pressed={view === 'list'} onClick={() => update({ view: 'list', page: params.get('page') })}>
            <Icon name="list" size={14} /> List
          </button>
        </div>
      </div>

      <section className="card">
        <TaskFilters hideProject />
        {view === 'list' ? (
          <TaskTable tasks={tasks.data?.items ?? []} showProject={false} />
        ) : (
          <div className="card-body">
            <Board tasks={tasks.data?.items ?? []} />
          </div>
        )}
      </section>

      <section className="card">
        <div className="card-head">
          <h2>Project activity</h2>
          <span className="pill-count">Updates in real time</span>
        </div>
        {feed.data && <ActivityFeed items={feed.data.pages.flatMap((pg) => pg.items)} light />}
        {feed.hasNextPage && (
          <div style={{ padding: '10px 18px' }}>
            <button className="link-btn" onClick={() => void feed.fetchNextPage()}>
              Load older
            </button>
          </div>
        )}
      </section>

      {editing && p && <ProjectForm project={p} onClose={() => setEditing(false)} />}
      {newTask && <TaskForm projectId={id} onClose={() => setNewTask(false)} />}
    </Page>
  );
}

function Board({ tasks }: { tasks: Task[] }) {
  const { recentTaskIds } = useRealtime();
  return (
    <div className="board">
      {STATUSES.map((s) => {
        const col = tasks.filter((t) => t.status === s);
        return (
          <div key={s} className="col">
            <div className="col-head">
              <span>{STATUS_LABEL[s]}</span>
              <span className="count">{col.length}</span>
            </div>
            {col.map((t) => (
              <article key={t.id} className={`tcard ${t.isOverdue ? 'is-overdue' : ''} ${recentTaskIds.has(t.id) ? 'flash' : ''}`}>
                <div className="tcard-top">
                  <Link className="task-title" to={`/tasks/${t.id}`}>
                    <span className="mono task-id">#{t.id}</span> {t.title}
                  </Link>
                </div>
                <div className="tcard-foot">
                  <PriorityTag priority={t.priority} />
                  {t.isOverdue ? <OverdueTag /> : <DueDate iso={t.dueDate} done={t.status === 'DONE'} />}
                </div>
                <div className="tcard-foot">
                  <span className="who" style={{ fontSize: 13 }}>
                    {t.assignee ? (
                      <>
                        <Avatar name={t.assignee.name} size="sm" /> {t.assignee.name.split(' ')[0]}
                      </>
                    ) : (
                      <span className="muted">Unassigned</span>
                    )}
                  </span>
                  <StatusControl task={t} />
                </div>
              </article>
            ))}
          </div>
        );
      })}
    </div>
  );
}
