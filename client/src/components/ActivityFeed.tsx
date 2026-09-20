import { Fragment, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { describeActivity, timeAgo } from '../lib/format';
import { useNow } from '../hooks/useNow';
import { Avatar } from './Badges';
import type { Activity } from '../types';

/** "Ravi moved Task #12 from In Progress → In Review · 2 mins ago" */
export function ActivityLine({ a, now }: { a: Activity; now: number }) {
  const { actor, text } = describeActivity(a);
  const [before, after] = text.split('→');
  return (
    <>
      <div className="feed-text">
        <b>{actor}</b> {before}
        {after !== undefined && (
          <>
            <span className="arrow">→</span>
            {after}
          </>
        )}
      </div>
      <div className="feed-meta">
        {a.project.name} · <time dateTime={a.createdAt} title={new Date(a.createdAt).toLocaleString()}>{timeAgo(a.createdAt, now)}</time>
      </div>
    </>
  );
}

export const activityHref = (a: Activity) => (a.task ? `/tasks/${a.task.id}` : `/projects/${a.project.id}`);

function dayLabel(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const yest = new Date();
  yest.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === yest.toDateString()) return 'Yesterday';
  return d.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'short' });
}

interface Props {
  items: Activity[];
  light?: boolean;
  groupByDay?: boolean;
  className?: string;
}

/**
 * Pure presentational list. Items that were not present on first render
 * (i.e. pushed over the WebSocket) get an arrival highlight.
 */
export function ActivityFeed({ items, light, groupByDay = true, className = '' }: Props) {
  const now = useNow();
  const seen = useRef<Set<number> | null>(null);
  if (seen.current === null && items.length) seen.current = new Set(items.map((i) => i.id));
  useEffect(() => {
    // after the arrival animation has had its moment, treat them as seen
    const t = setTimeout(() => items.forEach((i) => seen.current?.add(i.id)), 2600);
    return () => clearTimeout(t);
  }, [items]);

  let lastDay = '';
  return (
    <ul className={`feed ${light ? 'feed--light' : ''} ${className}`} aria-live="polite" aria-relevant="additions">
      {items.map((a) => {
        const day = dayLabel(a.createdAt);
        const header = groupByDay && day !== lastDay ? day : null;
        lastDay = day;
        const isNew = seen.current !== null && !seen.current.has(a.id);
        return (
          <Fragment key={a.id}>
            {header && <li className="feed-day">{header}</li>}
            <li className={`feed-item ${isNew ? 'is-new' : ''}`}>
              <Avatar name={a.actor?.name ?? null} />
              <Link to={activityHref(a)}>
                <ActivityLine a={a} now={now} />
              </Link>
            </li>
          </Fragment>
        );
      })}
    </ul>
  );
}
