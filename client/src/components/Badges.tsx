import { Logo } from './Icon';
import { PRIORITY_LABEL, STATUS_LABEL, daysUntil, dueLabel, formatDate, initials } from '../lib/format';
import type { Priority, TaskStatus } from '../types';

export const StatusBadge = ({ status }: { status: TaskStatus }) => (
  <span className={`badge status--${status}`}>{STATUS_LABEL[status]}</span>
);

export const PriorityTag = ({ priority }: { priority: Priority }) => (
  <span className={`prio prio--${priority}`} title={`${PRIORITY_LABEL[priority]} priority`}>
    <span className="prio-bars" aria-hidden>
      {priority === 'CRITICAL' ? (
        <svg width="12" height="12" viewBox="0 0 12 12">
          <rect x="0" y="0" width="12" height="12" rx="3" fill="currentColor" />
          <path d="M6 2.8v4M6 9h.01" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      ) : (
        <>
          <i />
          <i />
          <i />
        </>
      )}
    </span>
    <span>{PRIORITY_LABEL[priority]}</span>
  </span>
);

export const OverdueTag = () => (
  <span className="overdue-tag" title="Flagged by the scheduled overdue job">
    Overdue
  </span>
);

export function DueDate({ iso, done }: { iso: string | null; done?: boolean }) {
  if (!iso) return <span className="due muted">—</span>;
  const d = daysUntil(iso);
  const cls = done ? '' : d < 0 ? 'due--late' : d <= 2 ? 'due--soon' : '';
  return (
    <span className={`due ${cls}`} title={formatDate(iso)}>
      {done ? formatDate(iso) : dueLabel(iso)}
    </span>
  );
}

export const Avatar = ({ name, size }: { name: string | null; size?: 'sm' }) => (
  <span className={`avatar ${size ? 'avatar--sm' : ''} ${name ? '' : 'avatar--system'}`} aria-hidden>
    {name ? initials(name) : <Logo size={13} />}
  </span>
);

export function LiveDot({ state }: { state: 'live' | 'connecting' | 'offline' }) {
  const label = state === 'live' ? 'Live' : state === 'connecting' ? 'Connecting' : 'Offline';
  return (
    <span className={`live live--${state}`} title={`WebSocket: ${label}`}>
      <span className="live-dot" />
      <span className="live-label">{label}</span>
    </span>
  );
}
