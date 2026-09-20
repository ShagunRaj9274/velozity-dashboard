import { useState, type FormEvent } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { errorMessage } from '../lib/api';
import { Avatar } from '../components/Badges';
import { Logo } from '../components/Icon';

const DEMO_PASSWORD = 'Password@123';
const DEMO = [
  { name: 'Aarav Mehta', email: 'admin@velozity.dev', role: 'Admin', note: 'Sees everything' },
  { name: 'Priya Sharma', email: 'priya@velozity.dev', role: 'Project Manager', note: 'Owns 2 projects' },
  { name: 'Karan Malhotra', email: 'karan@velozity.dev', role: 'Project Manager', note: 'Owns 2 other projects' },
  { name: 'Ravi Kumar', email: 'ravi@velozity.dev', role: 'Developer', note: 'Only his tasks' },
  { name: 'Sneha Iyer', email: 'sneha@velozity.dev', role: 'Developer', note: 'Only her tasks' },
];

const MATRIX = [
  { role: 'Admin', feed: 'Every project', data: 'All clients, projects, tasks and users' },
  { role: 'Project Manager', feed: 'Projects they own', data: 'Only projects they created, and those tasks' },
  { role: 'Developer', feed: 'Tasks assigned to them', data: 'Only their tasks — others return 404' },
];

export function LoginPage() {
  const { state, login } = useAuth();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (state.status === 'authenticated') {
    const from = (location.state as { from?: string } | null)?.from ?? '/';
    return <Navigate to={from} replace />;
  }

  const signIn = async (e?: FormEvent, creds?: { email: string; password: string }) => {
    e?.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login(creds?.email ?? email, creds?.password ?? password);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login">
      <div className="login-pane">
        <form className="login-form" onSubmit={(e) => void signIn(e)}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <span className="brand-mark" style={{ background: 'var(--navy-900)', width: 32, height: 32, borderRadius: 8, display: 'grid', placeItems: 'center' }}>
              <Logo size={18} />
            </span>
            <strong style={{ fontSize: 16 }}>Velozity</strong>
          </div>
          <div>
            <h1>Sign in</h1>
            <p className="muted">Client projects, tasks and team activity — live.</p>
          </div>
          {error && <div className="alert" role="alert">{error}</div>}
          <div className="field">
            <label htmlFor="email">Email</label>
            <input id="email" type="email" className="input" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className="field">
            <label htmlFor="password">Password</label>
            <input id="password" type="password" className="input" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          <button type="submit" className="btn btn--primary" style={{ height: 40 }} disabled={busy}>
            {busy ? 'Signing in…' : 'Sign in'}
          </button>

          <div style={{ marginTop: 12 }}>
            <div className="field-label" style={{ marginBottom: 8 }}>
              Demo accounts <span className="muted">· password {DEMO_PASSWORD}</span>
            </div>
            <div className="demo">
              {DEMO.map((d) => (
                <button
                  key={d.email}
                  type="button"
                  className="demo-row"
                  disabled={busy}
                  onClick={() => {
                    setEmail(d.email);
                    setPassword(DEMO_PASSWORD);
                    void signIn(undefined, { email: d.email, password: DEMO_PASSWORD });
                  }}
                >
                  <Avatar name={d.name} />
                  <span>
                    {d.name}
                    <small>{d.email}</small>
                  </span>
                  <span className="demo-role">{d.role}</span>
                </button>
              ))}
            </div>
            <p className="muted" style={{ fontSize: 12, marginTop: 10 }}>
              Tip: open a Developer in one browser and their PM in another, then move a task.
            </p>
          </div>
        </form>
      </div>

      <aside className="login-side">
        <h2>Three roles. One source of truth for who sees what.</h2>
        <p style={{ maxWidth: 460 }}>
          Access is enforced by the API on every request and by the WebSocket server on every event — the UI only reflects it.
        </p>
        <table className="table" style={{ maxWidth: 520, color: 'var(--navy-300)' }}>
          <thead>
            <tr>
              <th style={{ background: 'transparent', color: 'var(--navy-400)', borderColor: 'var(--navy-800)' }}>Role</th>
              <th style={{ background: 'transparent', color: 'var(--navy-400)', borderColor: 'var(--navy-800)' }}>Live feed</th>
              <th style={{ background: 'transparent', color: 'var(--navy-400)', borderColor: 'var(--navy-800)' }}>Data</th>
            </tr>
          </thead>
          <tbody>
            {MATRIX.map((m) => (
              <tr key={m.role} style={{ background: 'transparent' }}>
                <td style={{ color: '#fff', borderColor: 'var(--navy-800)', fontWeight: 500 }}>{m.role}</td>
                <td style={{ borderColor: 'var(--navy-800)' }}>{m.feed}</td>
                <td style={{ borderColor: 'var(--navy-800)' }}>{m.data}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </aside>
    </div>
  );
}
