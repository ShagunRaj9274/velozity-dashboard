import { Link } from 'react-router-dom';
import { PRIORITY_LABEL, STATUS_LABEL } from '../lib/format';
import { PRIORITIES, STATUSES, type Priority, type TaskStatus } from '../types';

const STATUS_COLOR: Record<TaskStatus, string> = {
  TODO: '#a3abbe',
  IN_PROGRESS: 'var(--progress)',
  IN_REVIEW: '#e0a526',
  DONE: '#22a06b',
};

export const PRIORITY_COLOR: Record<Priority, string> = {
  CRITICAL: 'var(--p-critical)',
  HIGH: 'var(--p-high)',
  MEDIUM: 'var(--p-medium)',
  LOW: 'var(--p-low)',
};

/** Stacked status bar; each legend entry links to the matching filtered task list. */
export function StatusStack({ counts, legend = true, linkBase }: { counts: Record<TaskStatus, number>; legend?: boolean; linkBase?: string }) {
  const total = STATUSES.reduce((n, s) => n + counts[s], 0);
  return (
    <div>
      <div className="stack" role="img" aria-label={STATUSES.map((s) => `${STATUS_LABEL[s]} ${counts[s]}`).join(', ')}>
        {total > 0 && STATUSES.map((s) => <i key={s} className={`s-${s}`} style={{ width: `${(counts[s] / total) * 100}%` }} />)}
      </div>
      {legend && (
        <div className="legend">
          {STATUSES.map((s) => {
            const inner = (
              <>
                <span className="swatch" style={{ background: STATUS_COLOR[s] }} />
                {STATUS_LABEL[s]} <b>{counts[s]}</b>
              </>
            );
            return linkBase !== undefined ? (
              <Link key={s} className="legend-item" to={`/tasks?${linkBase}${linkBase ? '&' : ''}status=${s}`}>
                {inner}
              </Link>
            ) : (
              <span key={s} className="legend-item">
                {inner}
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function PriorityBars({ counts, link }: { counts: Record<Priority, number>; link?: boolean }) {
  const max = Math.max(1, ...PRIORITIES.map((p) => counts[p]));
  return (
    <div className="hbars">
      {PRIORITIES.map((p) => {
        const row = (
          <>
            <span className={`prio prio--${p}`}>
              <span>{PRIORITY_LABEL[p]}</span>
            </span>
            <span className="hbar-track">
              <span className="hbar-fill" style={{ display: 'block', width: `${(counts[p] / max) * 100}%`, background: PRIORITY_COLOR[p] }} />
            </span>
            <span className="hbar-n">{counts[p]}</span>
          </>
        );
        return link ? (
          <Link key={p} className="hbar" to={`/tasks?priority=${p}&status=TODO,IN_PROGRESS,IN_REVIEW`} aria-label={`${counts[p]} open ${PRIORITY_LABEL[p]} tasks`}>
            {row}
          </Link>
        ) : (
          <div key={p} className="hbar">
            {row}
          </div>
        );
      })}
    </div>
  );
}
