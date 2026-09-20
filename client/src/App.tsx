import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from './auth/AuthContext';
import { Layout } from './components/Layout';
import { Logo } from './components/Icon';
import { SocketProvider } from './realtime/SocketProvider';
import { ActivityPage } from './pages/Activity';
import { ClientsPage } from './pages/Clients';
import { DashboardPage } from './pages/Dashboard';
import { LoginPage } from './pages/Login';
import { NotFound } from './pages/NotFound';
import { ProjectDetailPage } from './pages/ProjectDetail';
import { ProjectsPage } from './pages/Projects';
import { TaskDetailPage } from './pages/TaskDetail';
import { TasksPage } from './pages/Tasks';
import { UsersPage } from './pages/Users';
import type { Role } from './types';

function Splash() {
  return (
    <div className="splash" role="status" aria-label="Restoring session">
      <Logo size={28} />
    </div>
  );
}

/** Signed-in area. The socket only exists while authenticated. */
function RequireAuth() {
  const { state } = useAuth();
  const location = useLocation();
  if (state.status === 'loading') return <Splash />;
  if (state.status === 'anonymous') {
    // Remember the full URL (incl. filter query params) so a shared link survives sign-in.
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  }
  return (
    <SocketProvider>
      <Layout />
    </SocketProvider>
  );
}

/**
 * UX-only guard: hides screens a role can't use. The API enforces every rule
 * independently — this never grants access, it only avoids a page of 403s.
 */
function RoleGate({ roles }: { roles: Role[] }) {
  const { hasRole } = useAuth();
  return hasRole(...roles) ? <Outlet /> : <NotFound what="page" />;
}

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<RequireAuth />}>
        <Route index element={<DashboardPage />} />
        <Route path="projects" element={<ProjectsPage />} />
        <Route path="projects/:id" element={<ProjectDetailPage />} />
        <Route path="tasks" element={<TasksPage />} />
        <Route path="tasks/:id" element={<TaskDetailPage />} />
        <Route path="activity" element={<ActivityPage />} />
        <Route element={<RoleGate roles={['ADMIN']} />}>
          <Route path="users" element={<UsersPage />} />
          <Route path="clients" element={<ClientsPage />} />
        </Route>
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
