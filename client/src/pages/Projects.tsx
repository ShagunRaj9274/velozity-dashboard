import { useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { Page } from '../components/Layout';
import { ProjectForm } from '../components/ProjectForm';
import { ProjectRow } from '../components/ProjectRow';
import { Icon } from '../components/Icon';
import { useProjects } from '../hooks/queries';

export function ProjectsPage() {
  const { hasRole, user } = useAuth();
  const { data, isLoading } = useProjects();
  const [creating, setCreating] = useState(false);
  const canCreate = hasRole('ADMIN', 'PROJECT_MANAGER');

  const scope =
    user?.role === 'ADMIN' ? 'All projects across the agency' : user?.role === 'PROJECT_MANAGER' ? 'Projects you created' : 'Projects where you have assigned tasks';

  return (
    <Page
      title="Projects"
      crumbs={scope}
      actions={
        canCreate && (
          <button className="btn btn--primary" onClick={() => setCreating(true)}>
            <Icon name="plus" size={16} /> New project
          </button>
        )
      }
    >
      <section className="card">
        {isLoading ? (
          <div className="empty">Loading…</div>
        ) : !data?.length ? (
          <div className="empty">
            <h3>No projects</h3>
            {canCreate ? 'Create the first one for a client.' : 'You have no tasks assigned in any project yet.'}
          </div>
        ) : (
          <div className="project-list">
            {data.map((p) => (
              <ProjectRow key={p.id} p={p} />
            ))}
          </div>
        )}
      </section>
      {creating && <ProjectForm onClose={() => setCreating(false)} />}
    </Page>
  );
}
