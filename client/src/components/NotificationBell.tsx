import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMarkRead, useNotifications, useUnreadCount } from '../hooks/queries';
import { useNow } from '../hooks/useNow';
import { timeAgo } from '../lib/format';
import { Icon } from './Icon';

/**
 * Badge count comes from ['notifications','count'], which the server pushes
 * over the WebSocket (`notification:count`) whenever it changes — no polling.
 */
export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const { data: unread = 0 } = useUnreadCount();
  const list = useNotifications(open);
  const markRead = useMarkRead();
  const now = useNow();
  const ref = useRef<HTMLDivElement>(null);
  const [bump, setBump] = useState(false);
  const prev = useRef(unread);

  useEffect(() => {
    if (unread > prev.current) {
      setBump(true);
      const t = setTimeout(() => setBump(false), 450);
      prev.current = unread;
      return () => clearTimeout(t);
    }
    prev.current = unread;
  }, [unread]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const items = list.data?.items ?? [];

  return (
    <div className="bell" ref={ref}>
      <button
        className="btn btn--icon"
        aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`}
        aria-expanded={open}
        aria-haspopup="true"
        onClick={() => setOpen((o) => !o)}
      >
        <Icon name="bell" />
      </button>
      {unread > 0 && (
        <span className={`bell-count ${bump ? 'bump' : ''}`} aria-hidden>
          {unread > 99 ? '99+' : unread}
        </span>
      )}
      {open && (
        <div className="popover" role="dialog" aria-label="Notifications">
          <div className="popover-head">
            <h2>
              Notifications {unread > 0 && <span className="pill-count">· {unread} unread</span>}
            </h2>
            <button className="link-btn" disabled={unread === 0} onClick={() => markRead.mutate('all')}>
              Mark all read
            </button>
          </div>
          {list.isLoading ? (
            <div className="empty">Loading…</div>
          ) : items.length === 0 ? (
            <div className="empty">You're all caught up.</div>
          ) : (
            <ul className="notif-list">
              {items.map((n) => (
                <li key={n.id} className={`notif ${n.readAt ? '' : 'unread'}`}>
                  <span className="notif-dot" aria-hidden />
                  <div>
                    <div className="notif-title">
                      {n.taskId ? (
                        <Link
                          to={`/tasks/${n.taskId}`}
                          onClick={() => {
                            if (!n.readAt) markRead.mutate(n.id);
                            setOpen(false);
                          }}
                        >
                          {n.title}
                        </Link>
                      ) : (
                        n.title
                      )}
                    </div>
                    <div className="notif-body">{n.body}</div>
                    <div className="notif-time">{timeAgo(n.createdAt, now)}</div>
                  </div>
                  {!n.readAt && (
                    <button className="btn btn--ghost btn--sm btn--icon" title="Mark as read" aria-label="Mark as read" onClick={() => markRead.mutate(n.id)}>
                      <Icon name="check" size={16} />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
