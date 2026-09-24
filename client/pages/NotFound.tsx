import { Link } from 'react-router';

export function NotFound() {
  return (
    <main className="page">
      <h1>Page not found</h1>
      <p className="muted">This page does not exist yet.</p>
      <Link to="/" className="button secondary">Back to start</Link>
    </main>
  );
}
