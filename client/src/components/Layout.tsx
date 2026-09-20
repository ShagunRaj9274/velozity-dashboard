import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth, useUser } from '../auth/AuthContext';
import { useRealtime } from '../realtime/SocketProvider';
import { ROLE_LABEL } from '../lib/format';
import { ActivityRail } from './ActivityRail';
import { Avatar, LiveDot } from './Badges';
import { Icon, Logo, type IconName } from './Icon';
import { NotificationBell } from './NotificationBell';
import type { Role } from '../types';

interface NavItem {
  to: string;
  label: string;
  icon: IconName;
  roles?: Role[];
}

const NAV: NavItem[] = [
  { to: '/', label: 'Dashboard', icon: 'dashboard' },
  { to: '/projects', label: 'Projects', icon: 'projects' },
  { to: '/tasks', label: 'Tasks', icon: 'tasks' },
  { to: '/activity', label: 'Activity', icon: 'activity' },
];

const ADMIN_NAV: NavItem[] = [
  { to: '/users', label: 'Users', icon: 'users', roles: ['ADMIN'] },
  { to: '/clients', label: 'Clients', icon: 'clients', roles: ['ADMIN'] },
];

const ChromeCtx = createContext<{ openMenu: () => void; toggleRail: () => void }>({
  openMenu: () => undefined,
  toggleRail: () => undefined,
});

export function Layout() {
  const user = useUser();
  const { logout } = useAuth();
  const [menu, setMenu] = useState(false);
  const [rail, setRail] = useState(false);
  const location = useLocation();

  useEffect(() => {
    setMenu(false);
    setRail(false);
  }, [location.pathname]);

  const tasksLabel = user.role === 'DEVELOPER' ? 'My tasks' : 'Tasks';

  return (
    <ChromeCtx.Provider value={{ openMenu: () => setMenu(true), toggleRail: () => setRail((r) => !r) }}>
      <div className="shell">
        <nav className={`sidebar ${menu ? 'open' : ''}`} aria-label="Primary">
          <Link to="/" className="brand">
            <span className="brand-mark">
              <Logo />
            </span>
            Velozity
          </Link>
          <div className="nav-group">
            {NAV.map((n) => (
              <NavLink key={n.to} to={n.to} end={n.to === '/'} className="nav-link">
                <Icon name={n.icon} />
                {n.to === '/tasks' ? tasksLabel : n.label}
              </NavLink>
            ))}
          </div>
          {user.role === 'ADMIN' && (
            <div className="nav-group">
              <div className="nav-label">Administration</div>
              {ADMIN_NAV.map((n) => (
                <NavLink key={n.to} to={n.to} className="nav-link">
                  <Icon name={n.icon} />
                  {n.label}
                </NavLink>
              ))}
            </div>
          )}
          <div className="sidebar-foot">
            <div className="me">
              <Avatar name={user.name} />
              <div style={{ minWidth: 0, flex: 1 }}>
                <div className="me-name">{user.name}</div>
                <div className="me-role">{ROLE_LABEL[user.role]}</div>
              </div>
              <button className="btn btn--ghost btn--icon" style={{ color: 'inherit' }} onClick={() => void logout()} aria-label="Sign out" title="Sign out">
                <Icon name="logout" />
              </button>
            </div>
          </div>
        </nav>
        <div className={`scrim ${menu || rail ? 'open' : ''}`} onClick={() => (setMenu(false), setRail(false))} />

        <div className="main">
          <Outlet />
        </div>

        <ActivityRail open={rail} onClose={() => setRail(false)} />
      </div>
    </ChromeCtx.Provider>
  );
}

interface PageProps {
  title: ReactNode;
  crumbs?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
}

/** Page frame: sticky top bar (title, actions, live status, bell) + body. */
export function Page({ title, crumbs, actions, children }: PageProps) {
  const { openMenu, toggleRail } = useContext(ChromeCtx);
  const { connection, missed } = useRealtime();
  useEffect(() => {
    if (typeof title === 'string') document.title = `${title} · Velozity`;
  }, [title]);

  return (
    <>
      <header className="topbar">
        <button className="btn btn--ghost btn--icon menu-btn" onClick={openMenu} aria-label="Open menu">
          <Icon name="menu" />
        </button>
        <div className="topbar-title">
          {crumbs && <div className="crumbs">{crumbs}</div>}
          <h1>{title}</h1>
        </div>
        {actions && <div className="toolbar topbar-actions">{actions}</div>}
        <LiveDot state={connection} />
        <button className="btn btn--icon rail-btn bell" onClick={toggleRail} aria-label="Show activity feed">
          <Icon name="activity" />
          {missed && missed.total > 0 && <span className="bell-count" aria-hidden>{Math.min(missed.total, 20)}</span>}
        </button>
        <NotificationBell />
      </header>
      <main className="page">
        {children}
      </main>
    </>
  );
}
