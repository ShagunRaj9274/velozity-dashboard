import { Link } from 'react-router-dom';
import { useUser } from '../auth/AuthContext';
import { Page } from '../components/Layout';
import { PriorityBars, StatusStack } from '../components/Charts';
import { ProjectRow } from '../components/ProjectRow';
import { TaskTable } from '../components/TaskTable';
import { useDashboard, usePresence, useProjects, useTasks } from '../hooks/queries';
import { useRealtime } from '../realtime/SocketProvider';
import { firstName } from '../lib/format';
import { STATUSES, type AdminDashboard, type DevDashboard, type PmDashboard, type TaskStatus } from '../types';

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

export function DashboardPage() {
  const user = useUser();
  const { data, isLoading, error } = useDashboard();

  return (
    <Page title={`${greeting()}, ${firstName(user.name)}`} crumbs="Dashboard">
      {isLoading || !data ? (
        error ? <div className="alert">Could not load the dashboard.</div> : <DashboardSkeleton />
      ) : data.role === 'ADMIN' ? (
        <AdminView d={data} />
      ) : data.role === 'PROJECT_MANAGER' ? (
        <PmView d={data} />
      ) : (
        <DevView d={data} />
      )}
    </Page>
  );
}

function DashboardSkeleton() {
  return (
    <div className="stats">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="stat">
          <div className="skeleton" style={{ width: '50%' }} />
          <div className="skeleton" style={{ height: 28, width: '30%', marginTop: 6 }} />
        </div>
      ))}
    </div>
  );
}

function Stat({ label, value, hint, to, tone }: { label: React.ReactNode; value: React.ReactNode; hint?: React.ReactNode; to?: string; tone?: 'alert' | 'live' }) {
  const body = (
    <>
      <span className="stat-label">{label}</span>
      <span className="stat-value">{value}</span>
      {hint && <span className="stat-hint">{hint}</span>}
    </>
  );
  const cls = `stat ${tone ? `stat--${tone}` : ''}`;
  return to ? (
    <Link to={to} className={cls}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

// ─── Admin ───────────────────────────────────────────────────────────────────

function AdminView({ d }: { d: AdminDashboard }) {
  const online = usePresence() ?? d.onlineUsers;
  const { connection } = useRealtime();
  const projects = useProjects();
  const overdue = useTasks('overdue=true&sort=dueDate&pageSize=6');
  const open = d.totals.tasks - d.tasksByStatus.DONE;

  return (
    <>
      <div className="stats">
        <Stat label="Projects" value={d.totals.projects} hint={`${d.totals.users} active users`} to="/projects" />
        <Stat label="Tasks" value={d.totals.tasks} hint={`${open} open`} to="/tasks" />
        <Stat label="Overdue" value={d.overdueCount} hint="Flagged by the scheduler" to="/tasks?overdue=true" tone={d.overdueCount ? 'alert' : undefined} />
        <Stat
          label={
            <>
              <span className={`live live--${connection}`} style={{ padding: 0, border: 0, background: 'none' }}>
                <span className="live-dot" />
              </span>
              Online right now
            </>
          }
          value={<span aria-live="polite">{online}</span>}
          hint="Live via WebSocket presence"
          to="/users"
          tone="live"
        />
      </div>

      <div className="grid-2">
        <section className="card">
          <div className="card-head">
            <h2>Tasks by status</h2>
            <span className="pill-count">{d.totals.tasks} total</span>
          </div>
          <div className="card-body">
            <StatusStack counts={d.tasksByStatus} linkBase="" />
          </div>
        </section>
        <section className="card">
          <div className="card-head">
            <h2>Overdue</h2>
            <Link to="/tasks?overdue=true" className="link-btn">
              View all
            </Link>
          </div>
          <OverdueList tasks={overdue.data?.items} />
        </section>
      </div>

      <section className="card">
        <div className="card-head">
          <h2>Project health</h2>
          <Link to="/projects" className="link-btn">
            All projects
          </Link>
        </div>
        <div className="project-list">{projects.data?.map((p) => <ProjectRow key={p.id} p={p} />)}</div>
      </section>
    </>
  );
}

function OverdueList({ tasks }: { tasks?: import('../types').Task[] }) {
  if (!tasks) return <div className="empty">Loading…</div>;
  if (tasks.length === 0) return <div className="empty">Nothing overdue.</div>;
  return (
    <ul className="feed feed--light">
      {tasks.map((t) => (
        <li key={t.id} className="feed-item" style={{ gridTemplateColumns: '1fr auto', padding: '10px 18px' }}>
          <Link to={`/tasks/${t.id}`} style={{ textDecoration: 'none', minWidth: 0 }}>
            <div className="feed-text">
              <span className="mono task-id">#{t.id}</span> <b>{t.title}</b>
            </div>
            <div className="feed-meta">
              {t.assignee?.name ?? 'Unassigned'} · {t.project.name}
            </div>
          </Link>
          <span className="due due--late">{t.dueDate ? `${Math.max(1, Math.ceil((Date.now() - new Date(t.dueDate).getTime()) / 86_400_000))}d late` : ''}</span>
        </li>
      ))}
    </ul>
  );
}

// ─── Project manager ─────────────────────────────────────────────────────────

function PmView({ d }: { d: PmDashboard }) {
  const open = Object.values(d.openTasksByPriority).reduce((a, b) => a + b, 0);
  const inReview = d.projects.reduce((n, p) => n + p.stats.byStatus.IN_REVIEW, 0);
  const statusTotals = d.projects.reduce(
    (acc, p) => {
      for (const s of STATUSES) acc[s] += p.stats.byStatus[s];
      return acc;
    },
    { TODO: 0, IN_PROGRESS: 0, IN_REVIEW: 0, DONE: 0 } as Record<TaskStatus, number>,
  );
  return (
    <>
      <div className="stats">
        <Stat label="Your projects" value={d.projects.length} to="/projects" />
        <Stat label="Open tasks" value={open} to="/tasks?status=TODO,IN_PROGRESS,IN_REVIEW" />
        <Stat label="Waiting for review" value={inReview} hint="You're notified on each" to="/tasks?status=IN_REVIEW" />
        <Stat label="Overdue" value={d.overdueCount} to="/tasks?overdue=true" tone={d.overdueCount ? 'alert' : undefined} />
      </div>

      <div className="grid-2">
        <section className="card">
          <div className="card-head">
            <h2>Open tasks by priority</h2>
            <span className="pill-count">{open} open</span>
          </div>
          <div className="card-body">
            <PriorityBars counts={d.openTasksByPriority} link />
          </div>
        </section>
        <section className="card">
          <div className="card-head">
            <h2>Status across your projects</h2>
          </div>
          <div className="card-body">
            <StatusStack counts={statusTotals} linkBase="" />
          </div>
        </section>
      </div>

      <section className="card">
        <div className="card-head">
          <h2>Due this week</h2>
          <span className="pill-count">{d.dueThisWeek.length} tasks</span>
        </div>
        <TaskTable tasks={d.dueThisWeek} empty={<div className="empty">Nothing due in the next 7 days.</div>} />
      </section>

      <section className="card">
        <div className="card-head">
          <h2>Your projects</h2>
          <Link to="/projects" className="link-btn">
            Manage
          </Link>
        </div>
        {d.projects.length === 0 ? (
          <div className="empty">
            <h3>No projects yet</h3>
            Create one from the Projects page.
          </div>
        ) : (
          <div className="project-list">{d.projects.map((p) => <ProjectRow key={p.id} p={p} />)}</div>
        )}
      </section>
    </>
  );
}

// ─── Developer ───────────────────────────────────────────────────────────────

function DevView({ d }: { d: DevDashboard }) {
  const open = d.tasks.filter((t) => t.status !== 'DONE');
  const done = d.tasks.filter((t) => t.status === 'DONE');
  return (
    <>
      <div className="stats">
        <Stat label="Open tasks" value={open.length} to="/tasks?status=TODO,IN_PROGRESS,IN_REVIEW" />
        <Stat label="In progress" value={d.tasksByStatus.IN_PROGRESS} to="/tasks?status=IN_PROGRESS" />
        <Stat label="Due this week" value={d.dueThisWeekCount} />
        <Stat label="Overdue" value={d.overdueCount} to="/tasks?overdue=true" tone={d.overdueCount ? 'alert' : undefined} />
      </div>
      <section className="card">
        <div className="card-head">
          <div>
            <h2>Your tasks</h2>
            <div className="pill-count">Sorted by priority, then due date</div>
          </div>
          <Link to="/tasks?sort=priority" className="link-btn">
            Filter
          </Link>
        </div>
        <TaskTable tasks={open} showAssignee={false} empty={<div className="empty">No open tasks. Nice.</div>} />
      </section>
      {done.length > 0 && (
        <section className="card">
          <div className="card-head">
            <h2>Done</h2>
            <span className="pill-count">{done.length}</span>
          </div>
          <TaskTable tasks={done} showAssignee={false} />
        </section>
      )}
    </>
  );
}
