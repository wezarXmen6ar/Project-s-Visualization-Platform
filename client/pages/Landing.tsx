import { Link } from 'react-router';

export function Landing() {
  return (
    <main className="landing">
      <h1>Project Portfolio</h1>
      <div className="landing-tiles">
        <Link to="/manage" className="tile">
          <h2>Project Management</h2>
          <p>Create and manage projects, phases and people.</p>
        </Link>
        <Link to="/present" className="tile">
          <h2>Project Presentation</h2>
          <p>Show the portfolio to stakeholders.</p>
        </Link>
      </div>
    </main>
  );
}
