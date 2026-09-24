import { Link, useNavigate } from 'react-router';
import { todayLocal } from '../../../shared/calendar';
import { projectSpan } from '../../../shared/scheduler';
import { AlertIcon, ArrowLeftIcon, FolderOpenIcon, PlusIcon } from '../../icons';
import { api } from '../../api';
import { Gantt } from '../../gantt/Gantt';
import { portfolioRows, rangeFor } from '../../gantt/rows';
import { useElementWidth } from '../../gantt/useElementWidth';
import { useAsync } from '../../useAsync';

export function ManageDashboardPage() {
  const navigate = useNavigate();
  const projects = useAsync(() => api.listProjects(), []);
  const [chartRef, chartWidth] = useElementWidth<HTMLDivElement>();
  const today = todayLocal();
  const list = projects.data ?? [];
  const rows = portfolioRows(list);

  return (
    <main className="page">
      <div className="page-header">
        <div>
          <Link to="/" className="crumb"><ArrowLeftIcon />Start</Link>
          <h1>Projects</h1>
        </div>
        <Link to="/manage/projects/new" className="button"><PlusIcon />New project</Link>
      </div>

      {projects.error ? (
        <div className="errors" role="alert">
          <AlertIcon />
          <span>{projects.error.message}</span>
        </div>
      ) : null}

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
