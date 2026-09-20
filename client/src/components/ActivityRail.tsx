import { useUser } from '../auth/AuthContext';
import { useActivity } from '../hooks/queries';
import { useRealtime } from '../realtime/SocketProvider';
import { ActivityFeed } from './ActivityFeed';
import { LiveDot } from './Badges';
import { Icon } from './Icon';
import { MissedBanner } from './MissedBanner';
import type { Role } from '../types';

const SCOPE: Record<Role, string> = {
  ADMIN: 'All projects',
  PROJECT_MANAGER: 'Projects you own',
  DEVELOPER: 'Tasks assigned to you',
};

export function ActivityRail({ open, onClose }: { open: boolean; onClose: () => void }) {
  const user = useUser();
  const { connection } = useRealtime();
  const feed = useActivity({}, 30);
  const items = feed.data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <aside className={`rail ${open ? 'open' : ''}`} aria-label="Live activity">
      <div className="rail-head">
        <div>
          <h2>Activity</h2>
          <div className="rail-scope">{SCOPE[user.role]}</div>
        </div>
        <div className="toolbar">
          <LiveDot state={connection} />
          <button className="btn btn--ghost btn--icon rail-btn" style={{ color: '#fff' }} onClick={onClose} aria-label="Close activity">
            <Icon name="close" />
          </button>
        </div>
      </div>
      <div className="rail-body">
        <MissedBanner />
        {feed.isLoading ? (
          <div style={{ padding: 20, display: 'grid', gap: 12 }}>
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="skeleton" style={{ opacity: 0.15 }} />
            ))}
          </div>
        ) : items.length === 0 ? (
          <p style={{ padding: 20 }}>No activity in your scope yet.</p>
        ) : (
          <ActivityFeed items={items} />
        )}
        {feed.hasNextPage && (
          <div style={{ padding: '8px 20px' }}>
            <button className="link-btn" onClick={() => void feed.fetchNextPage()} disabled={feed.isFetchingNextPage}>
              {feed.isFetchingNextPage ? 'Loading…' : 'Load older'}
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
