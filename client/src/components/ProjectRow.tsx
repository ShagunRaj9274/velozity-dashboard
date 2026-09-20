import { Link } from 'react-router-dom';
import { StatusStack } from './Charts';
import type { Project } from '../types';

export function ProjectRow({ p }: { p: Project }) {
  const done = p.stats.byStatus.DONE;
  const pct = p.stats.total ? Math.round((done / p.stats.total) * 100) : 0;
  return (
    <Link to={`/projects/${p.id}`} className="project-row">
      <div style={{ minWidth: 0 }}>
        <div className="project-name">{p.name}</div>
        <div className="project-meta">
          {p.client.name} · managed by {p.owner.name}
        </div>
      </div>
      <div>
        <StatusStack counts={p.stats.byStatus} legend={false} />
        <div className="project-meta" style={{ marginTop: 6 }}>
          {pct}% done · {p.stats.total} tasks
        </div>
      </div>
      <div className="project-meta">
        {p.stats.overdue > 0 ? (
          <span className="overdue-tag">{p.stats.overdue} overdue</span>
        ) : (
          <span>Nothing overdue</span>
        )}
      </div>
      <div className="project-meta" style={{ textAlign: 'right' }}>
        {p.stats.byStatus.IN_REVIEW > 0 ? `${p.stats.byStatus.IN_REVIEW} in review` : ''}
      </div>
    </Link>
  );
}
