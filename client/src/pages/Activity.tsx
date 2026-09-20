import { useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useUser } from '../auth/AuthContext';
import { ActivityFeed } from '../components/ActivityFeed';
import { Page } from '../components/Layout';
import { useActivity, useProjects } from '../hooks/queries';
import type { Role } from '../types';

const SCOPE: Record<Role, string> = {
  ADMIN: 'Global feed — every project',
  PROJECT_MANAGER: 'Events on projects you own',
  DEVELOPER: 'Events on tasks assigned to you',
};

/**
 * Full activity history. The server applies the role scope; the optional
 * ?projectId filter is also in the URL so a filtered feed can be shared.
 * Older pages load via keyset cursor as the sentinel scrolls into view.
 */
export function ActivityPage() {
  const user = useUser();
  const [params, setParams] = useSearchParams();
  const projectId = Number(params.get('projectId')) || undefined;
  const projects = useProjects();
  const feed = useActivity(projectId ? { projectId } : {}, 30);
  const items = feed.data?.pages.flatMap((p) => p.items) ?? [];

  const sentinel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const io = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting && feed.hasNextPage && !feed.isFetchingNextPage) void feed.fetchNextPage();
    });
    io.observe(el);
    return () => io.disconnect();
  }, [feed]);

  return (
    <Page
      title="Activity"
      crumbs={SCOPE[user.role]}
      actions={
        <select
          className="select"
          aria-label="Filter by project"
          value={projectId ?? ''}
          onChange={(e) => {
            const next = new URLSearchParams(params);
            if (e.target.value) next.set('projectId', e.target.value);
            else next.delete('projectId');
            setParams(next);
          }}
        >
          <option value="">All projects in scope</option>
          {projects.data?.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      }
    >
      <div style={{ maxWidth: 760 }}>
        <section className="card">
          {feed.isLoading ? (
            <div className="card-body" style={{ display: 'grid', gap: 12 }}>
              {[0, 1, 2, 3, 4].map((i) => (
                <div key={i} className="skeleton" />
              ))}
            </div>
          ) : feed.isError ? (
            <div className="empty">Couldn’t load activity.</div>
          ) : items.length === 0 ? (
            <div className="empty">
              <h3>Nothing yet</h3>
              Changes to tasks in your scope will appear here the moment they happen.
            </div>
          ) : (
            <ActivityFeed items={items} light className="feed--page" />
          )}
          <div ref={sentinel} style={{ padding: 12, textAlign: 'center' }} className="muted">
            {feed.isFetchingNextPage ? 'Loading older events…' : !feed.hasNextPage && items.length > 0 ? 'Beginning of history' : ''}
          </div>
        </section>
      </div>
    </Page>
  );
}
