import { Link } from 'react-router-dom';
import { useRealtime } from '../realtime/SocketProvider';
import { Avatar, DueDate, OverdueTag, PriorityTag } from './Badges';
import { StatusControl } from './StatusControl';
import type { Task } from '../types';

interface Props {
  tasks: Task[];
  showProject?: boolean;
  showAssignee?: boolean;
  empty?: React.ReactNode;
}

export function TaskTable({ tasks, showProject = true, showAssignee = true, empty }: Props) {
  const { recentTaskIds } = useRealtime();
  if (tasks.length === 0) return <>{empty ?? <div className="empty">No tasks match.</div>}</>;

  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            <th style={{ width: '44%' }}>Task</th>
            <th>Status</th>
            <th>Priority</th>
            {showAssignee && <th>Assignee</th>}
            <th>Due</th>
          </tr>
        </thead>
        <tbody>
          {tasks.map((t) => (
            <tr key={t.id} className={recentTaskIds.has(t.id) ? 'flash' : ''}>
              <td>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <span className="mono task-id">#{t.id}</span>
                  <Link className="task-title" to={`/tasks/${t.id}`}>
                    {t.title}
                  </Link>
                  {t.isOverdue && <OverdueTag />}
                </div>
                {showProject && (
                  <div className="task-sub">
                    {t.project.name} · {t.project.client.name}
                  </div>
                )}
              </td>
              <td>
                <StatusControl task={t} />
              </td>
              <td>
                <PriorityTag priority={t.priority} />
              </td>
              {showAssignee && (
                <td>
                  {t.assignee ? (
                    <span className="who">
                      <Avatar name={t.assignee.name} size="sm" />
                      {t.assignee.name}
                    </span>
                  ) : (
                    <span className="muted">Unassigned</span>
                  )}
                </td>
              )}
              <td>
                <DueDate iso={t.dueDate} done={t.status === 'DONE'} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
