import { Link, useNavigate } from 'react-router';
import { addDays, todayLocal } from '../../../shared/calendar';
import { computeWorkload, weekStartOf } from '../../../shared/capacity';
import { projectSpan } from '../../../shared/scheduler';
import { AlertIcon, ArrowLeftIcon, FolderOpenIcon, PlusIcon } from '../../icons';
import { api } from '../../api';
import { Gantt } from '../../gantt/Gantt';
import { portfolioRows, rangeFor } from '../../gantt/rows';
import { useElementWidth } from '../../gantt/useElementWidth';
import { useAsync } from '../../useAsync';
import { useWorkload } from '../../useWorkload';
import { isAccepted } from './heatmap';
import { MyNextSteps } from './MyNextSteps';

export function ManageDashboardPage() {
  const navigate = useNavigate();
  const projects = useAsync(() => api.listProjects(), []);
  const [chartRef, chartWidth] = useElementWidth<HTMLDivElement>();
  const today = todayLocal();
  const { workload } = useWorkload();
  const thisWeek = weekStartOf(today);
  const overbooked = workload
    ? computeWorkload(workload.resources, workload.assignments, { start: thisWeek, end: addDays(thisWeek, 27) }, workload.calendar)
        .filter((p) => p.weeks.some((w) => w.overloaded && !isAccepted(workload.decisions, p.resourceId, w.weekStart)))
    : [];
  const list = projects.data ?? [];
  const rows = portfolioRows(list);

  return (
    <main className="page page-wide">
      <div className="page-header">
        <div>
          <Link to="/" className="crumb"><ArrowLeftIcon />Start</Link>
          <h1>Projects</h1>
        </div>
        <div className="header-actions">
          <Link to="/manage/todos" className="button secondary">To-dos</Link>
          <Link to="/manage/resources" className="button secondary">Resources</Link>
          <Link to="/manage/settings" className="button secondary">Settings</Link>
          <Link to="/manage/projects/new" className="button"><PlusIcon />New project</Link>
        </div>
      </div>

      {projects.error ? (
        <div className="errors" role="alert">
          <AlertIcon />
          <span>{projects.error.message}</span>
        </div>
      ) : null}

      {overbooked.length > 0 ? (
        <div className="notice" role="status">
          <AlertIcon />
          <span>
            {overbooked.length === 1 ? `${overbooked[0].name} is` : `${overbooked.length} people are`} overbooked in the next 4 weeks.
          </span>
          <Link to="/manage/resources">See the workload</Link>
        </div>
      ) : null}

      <MyNextSteps />

      {projects.loading && !projects.data ? (
        <section className="card">
          <div className="skeleton skeleton-chart" />
          <div className="skeleton skeleton-line" />
          <div className="skeleton skeleton-line" />
          <div className="skeleton skeleton-line" />
        </section>
      ) : null}

      {projects.data && list.length === 0 ? (
        <section className="card">
          <div className="empty-state">
            <span className="empty-state-icon"><FolderOpenIcon /></span>
            <h3>No projects yet</h3>
            <p>Create your first one to see it laid out on a timeline, phase by phase.</p>
            <Link to="/manage/projects/new" className="button">Create your first project</Link>
          </div>
        </section>
      ) : null}

      {list.length > 0 ? (
        <>
          <section className="card">
            <h2>Timeline</h2>
            <div className="chart-scroll" ref={chartRef}>
              <Gantt
                rows={rows}
                range={rangeFor(rows, today)}
                width={chartWidth}
                today={today}
                onRowClick={(id) => navigate(`/manage/projects/${id}`)}
              />
            </div>
          </section>

          <section className="card">
            <table>
              <thead>
                <tr><th>Project</th><th>Jira key</th><th>Start</th><th>End</th><th>Phases</th></tr>
              </thead>
              <tbody>
                {list.map((p) => {
                  const span = projectSpan(p.phases);
                  return (
                    <tr key={p.id}>
                      <td><Link to={`/manage/projects/${p.id}`}>{p.name}</Link></td>
                      <td>{p.jiraKey ?? '—'}</td>
                      <td>{span?.start ?? '—'}</td>
                      <td>{span?.end ?? '—'}</td>
                      <td>{p.phases.length}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>
        </>
      ) : null}
    </main>
  );
}
