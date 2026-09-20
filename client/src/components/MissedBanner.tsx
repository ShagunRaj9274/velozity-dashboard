import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useRealtime } from '../realtime/SocketProvider';
import { useNow } from '../hooks/useNow';
import { timeAgo } from '../lib/format';
import { ActivityLine, activityHref } from './ActivityFeed';
import { Avatar } from './Badges';

/**
 * The catch-up digest. On every socket connect the server queries Postgres
 * for up to 20 in-scope events created since this user's `lastSeenAt`
 * (written when their last socket closed) and emits `activity:missed`.
 */
export function MissedBanner() {
  const { missed, dismissMissed } = useRealtime();
  const [open, setOpen] = useState(true);
  const now = useNow();
  if (!missed || missed.total === 0) return null;

  const shown = missed.events.length;
  return (
    <section className="missed" aria-label="Updates you missed">
      <div className="missed-head">
        <div>
          <strong>While you were away</strong>
          <div style={{ fontSize: 12, opacity: 0.8 }}>
            {missed.total > shown ? `Latest ${shown} of ${missed.total}` : `${shown} update${shown === 1 ? '' : 's'}`}
            {missed.since && <> since you left {timeAgo(missed.since, now)}</>}
          </div>
        </div>
        <div className="toolbar">
          <button className="link-btn" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
            {open ? 'Collapse' : 'Show'}
          </button>
          <button className="link-btn" onClick={dismissMissed}>
            Dismiss
          </button>
        </div>
      </div>
      {open && (
        <ol className="missed-list">
          {missed.events.map((a) => (
            <li key={a.id} style={{ display: 'grid', gridTemplateColumns: '22px 1fr', gap: 8 }}>
              <Avatar name={a.actor?.name ?? null} size="sm" />
              <Link to={activityHref(a)} style={{ textDecoration: 'none' }}>
                <ActivityLine a={a} now={now} />
              </Link>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
