import { Link, useParams } from 'react-router';
import { DEFAULT_CALENDAR, countWorkingDays, todayLocal } from '../../../shared/calendar';
import { projectSpan } from '../../../shared/scheduler';
import { AlertIcon, ArrowLeftIcon } from '../../icons';
import { api } from '../../api';
import { Gantt } from '../../gantt/Gantt';
import { phaseRows, rangeFor } from '../../gantt/rows';
import { useElementWidth } from '../../gantt/useElementWidth';
import { useAsync } from '../../useAsync';

export function ProjectPage() {
  const id = Number(useParams().id);
  const project = useAsync(() => api.getProject(id), [id]);
  const calendar = useAsync(() => api.getCalendar(), []);
  const [chartRef, chartWidth] = useElementWidth<HTMLDivElement>();
  const today = todayLocal();

  if (project.error) {
    return (
      <main className="page">
        <Link to="/manage" className="crumb"><ArrowLeftIcon />Projects</Link>
        <div className="errors" role="alert">
          <AlertIcon />
          <span>{project.error.message}</span>
        </div>
      </main>
    );
  }
  if (!project.data) {
    return (
      <main className="page">
        <div className="skeleton skeleton-line" style={{ width: '12ch', height: '0.9rem', marginBottom: 'var(--sp-4)' }} />
        <div className="skeleton" style={{ width: '40ch', maxWidth: '100%', height: '1.75rem', marginBottom: 'var(--sp-5)' }} />
        <section className="card"><div className="skeleton skeleton-chart" /></section>
      </main>
    );
  }

  const p = project.data;
  const span = projectSpan(p.phases);
  const rows = phaseRows(p);
  const cal = calendar.data ?? DEFAULT_CALENDAR;

  return (
    <main className="page">
      <div className="page-header">
        <div>
          <Link to="/manage" className="crumb"><ArrowLeftIcon />Projects</Link>
          <h1>{p.name}</h1>
          <p className="meta-line">
            {p.jiraKey ? `${p.jiraKey} · ` : ''}
            {span ? `${span.start} → ${span.end} · ${countWorkingDays(span.start, span.end, cal)} working days` : 'No phases'}
          </p>
        </div>
      </div>

      <section className="card">
        <h2>Timeline</h2>
        <div className="chart-scroll" ref={chartRef}>
          <Gantt rows={rows} range={rangeFor(rows, today)} width={chartWidth} today={today} />
        </div>
      </section>

      <section className="card">
        <h2>Phases</h2>
        <table>
          <thead>
            <tr><th>Phase</th><th>Start</th><th>End</th><th>Working days</th></tr>
          </thead>
          <tbody>
            {p.phases.map((ph) => (
              <tr key={ph.id}>
                <td>{ph.name}</td>
                <td>{ph.start}</td>
                <td>{ph.end}</td>
                <td>{ph.durationDays}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </main>
  );
}
