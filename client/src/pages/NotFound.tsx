import { Link } from 'react-router-dom';
import { Page } from '../components/Layout';

/**
 * The API answers 404 (not 403) for rows outside your scope, so this page
 * can't — and shouldn't — tell "doesn't exist" apart from "not yours".
 */
export function NotFound({ what = 'page' }: { what?: string }) {
  return (
    <Page title="Not found">
      <section className="card">
        <div className="empty">
          <h3>This {what} doesn't exist or isn't visible to you.</h3>
          <p style={{ marginBottom: 12 }}>Access is decided by the server for your role.</p>
          <Link className="btn" to="/">
            Back to dashboard
          </Link>
        </div>
      </section>
    </Page>
  );
}
