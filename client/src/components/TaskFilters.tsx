import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useProjects } from '../hooks/queries';
import { PRIORITY_LABEL, STATUS_LABEL } from '../lib/format';
import { PRIORITIES, STATUSES } from '../types';
import { Icon } from './Icon';
import { useToast } from './Toasts';

/** Reads/writes filters in the URL, so any filtered view is a shareable link. */
export function useFilterParams() {
  const [params, setParams] = useSearchParams();

  const list = (key: string) => (params.get(key) ?? '').split(',').filter(Boolean);

  const update = (patch: Record<string, string | string[] | null>) => {
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        for (const [k, v] of Object.entries(patch)) {
          const value = Array.isArray(v) ? v.join(',') : v;
          if (value) next.set(k, value);
          else next.delete(k);
        }
        if (!('page' in patch)) next.delete('page'); // new filter → back to page 1
        return next;
      },
      { replace: true },
    );
  };

  const toggle = (key: string, value: string) => {
    const cur = list(key);
    update({ [key]: cur.includes(value) ? cur.filter((x) => x !== value) : [...cur, value] });
  };

  return { params, list, update, toggle };
}

export function TaskFilters({ hideProject }: { hideProject?: boolean }) {
  const { params, list, update, toggle } = useFilterParams();
  const projects = useProjects();
  const toast = useToast();
  const [q, setQ] = useState(params.get('q') ?? '');

  // debounce the text search into the URL
  useEffect(() => {
    const t = setTimeout(() => {
      if ((params.get('q') ?? '') !== q) update({ q });
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  const statuses = list('status');
  const priorities = list('priority');
  const active = ['status', 'priority', 'dueFrom', 'dueTo', 'overdue', 'projectId', 'q'].some((k) => params.get(k));

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast('Filtered view link copied', 'success');
    } catch {
      toast('Could not access the clipboard', 'error');
    }
  };

  return (
    <>
      <div className="filters" role="search">
        <div className="filter-group">
          <span className="field-label">Status</span>
          <div className="chips">
            {STATUSES.map((s) => (
              <button key={s} type="button" className="chip" aria-pressed={statuses.includes(s)} onClick={() => toggle('status', s)}>
                {STATUS_LABEL[s]}
              </button>
            ))}
          </div>
        </div>
        <div className="filter-group">
          <span className="field-label">Priority</span>
          <div className="chips">
            {PRIORITIES.map((p) => (
              <button key={p} type="button" className="chip" aria-pressed={priorities.includes(p)} onClick={() => toggle('priority', p)}>
                {PRIORITY_LABEL[p]}
              </button>
            ))}
          </div>
        </div>
        <div className="filter-group">
          <label className="field-label" htmlFor="dueFrom">
            Due from
          </label>
          <input id="dueFrom" type="date" className="input" value={params.get('dueFrom') ?? ''} onChange={(e) => update({ dueFrom: e.target.value })} />
        </div>
        <div className="filter-group">
          <label className="field-label" htmlFor="dueTo">
            Due to
          </label>
          <input id="dueTo" type="date" className="input" value={params.get('dueTo') ?? ''} min={params.get('dueFrom') ?? undefined} onChange={(e) => update({ dueTo: e.target.value })} />
        </div>
        {!hideProject && (
          <div className="filter-group">
            <label className="field-label" htmlFor="projectId">
              Project
            </label>
            <select id="projectId" className="select" value={params.get('projectId') ?? ''} onChange={(e) => update({ projectId: e.target.value })}>
              <option value="">All projects</option>
              {projects.data?.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        )}
        <div className="filter-group">
          <span className="field-label">&nbsp;</span>
          <button type="button" className="chip" aria-pressed={params.get('overdue') === 'true'} onClick={() => update({ overdue: params.get('overdue') === 'true' ? null : 'true' })}>
            <Icon name="alert" size={14} /> Overdue only
          </button>
        </div>
        <div className="filter-group" style={{ flex: '1 1 180px' }}>
          <label className="field-label" htmlFor="q">
            Search
          </label>
          <input id="q" className="input" placeholder="Title or description" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="filter-group">
          <label className="field-label" htmlFor="sort">
            Sort
          </label>
          <select id="sort" className="select" value={params.get('sort') ?? ''} onChange={(e) => update({ sort: e.target.value })}>
            <option value="">Default</option>
            <option value="priority">Priority, then due date</option>
            <option value="dueDate">Due date</option>
            <option value="updated">Recently updated</option>
            <option value="created">Newest</option>
          </select>
        </div>
      </div>
      <div className="url-hint">
        <Icon name="link" size={14} />
        <code>{window.location.pathname}{params.toString() ? `?${decodeURIComponent(params.toString())}` : ''}</code>
        <span style={{ marginLeft: 'auto', display: 'flex', gap: 12, flex: 'none' }}>
          {active && (
            <button className="link-btn" onClick={() => (setQ(''), update({ status: null, priority: null, dueFrom: null, dueTo: null, overdue: null, projectId: null, q: null }))}>
              Clear filters
            </button>
          )}
          <button className="link-btn" onClick={() => void copy()}>
            Copy link
          </button>
        </span>
      </div>
    </>
  );
}
