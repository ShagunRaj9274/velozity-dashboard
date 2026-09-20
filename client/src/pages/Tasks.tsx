import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useUser } from '../auth/AuthContext';
import { Page } from '../components/Layout';
import { Icon } from '../components/Icon';
import { TaskFilters, useFilterParams } from '../components/TaskFilters';
import { TaskForm } from '../components/TaskForm';
import { TaskTable } from '../components/TaskTable';
import { useTasks } from '../hooks/queries';

export function TasksPage() {
  const user = useUser();
  const [params] = useSearchParams();
  const { update } = useFilterParams();
  const { data, isLoading, isFetching, error } = useTasks(params.toString());
  const [creating, setCreating] = useState(false);
  const isDev = user.role === 'DEVELOPER';

  const page = data?.page ?? 1;
  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <Page
      title={isDev ? 'My tasks' : 'Tasks'}
      crumbs={isDev ? 'Only tasks assigned to you' : user.role === 'PROJECT_MANAGER' ? 'Tasks in projects you manage' : 'All tasks'}
      actions={
        !isDev && (
          <button className="btn btn--primary" onClick={() => setCreating(true)}>
            <Icon name="plus" size={16} /> New task
          </button>
        )
      }
    >
      <section className="card" aria-busy={isFetching}>
        <TaskFilters />
        {error ? (
          <div className="card-body">
            <div className="alert">Those filters were rejected by the server. Try clearing them.</div>
          </div>
        ) : isLoading ? (
          <div className="empty">Loading…</div>
        ) : (
          <TaskTable
            tasks={data?.items ?? []}
            showAssignee={!isDev}
            empty={
              <div className="empty">
                <h3>No tasks match these filters</h3>
                Adjust or clear the filters above.
              </div>
            }
          />
        )}
        {data && data.total > 0 && (
          <div className="pager">
            <span>
              {(page - 1) * data.pageSize + 1}–{Math.min(page * data.pageSize, data.total)} of {data.total}
            </span>
            <span className="toolbar">
              <button className="btn btn--sm" disabled={page <= 1} onClick={() => update({ page: String(page - 1) })}>
                Previous
              </button>
              <button className="btn btn--sm" disabled={page >= pages} onClick={() => update({ page: String(page + 1) })}>
                Next
              </button>
            </span>
          </div>
        )}
      </section>
      {creating && <TaskForm onClose={() => setCreating(false)} />}
    </Page>
  );
}
