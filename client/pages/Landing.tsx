import { Link } from 'react-router';
import { ArrowRightIcon, KanbanIcon, PresentationIcon } from '../icons';

export function Landing() {
  return (
    <main className="landing">
      <div>
        <h1>Project Portfolio</h1>
        <p className="landing-sub">Choose what you want to do.</p>
      </div>
      <div className="landing-tiles">
        <Link to="/manage" className="tile">
          <span className="tile-icon"><KanbanIcon /></span>
          <h2>Project Management</h2>
          <p>Create and manage projects, phases and people.</p>
          <span className="tile-arrow"><ArrowRightIcon /></span>
        </Link>
        <Link to="/present" className="tile">
          <span className="tile-icon"><PresentationIcon /></span>
          <h2>Project Presentation</h2>
          <p>Show the portfolio to stakeholders.</p>
          <span className="tile-arrow"><ArrowRightIcon /></span>
        </Link>
      </div>
    </main>
  );
}
