import { Link, useNavigate } from 'react-router';
import { todayLocal } from '../../../shared/calendar';
import { projectSpan } from '../../../shared/scheduler';
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
          <Link to="/" className="crumb">← Start</Link>
          <h1>Projects</h1>
        </div>
        <Link to="/manage/projects/new" className="button">New project</Link>
      </div>

      {projects.error ? <div className="errors" role="alert">{projects.error.message}</div> : null}
      {projects.loading && !projects.data ? <p className="muted">Loading…</p> : null}

      {projects.data && list.length === 0 ? (
        <section className="card">
          <p>No projects yet. Create your first one to see it on the timeline.</p>
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
