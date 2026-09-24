import { Link, useParams } from 'react-router';
import { DEFAULT_CALENDAR, countWorkingDays, todayLocal } from '../../../shared/calendar';
import { projectSpan } from '../../../shared/scheduler';
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
        <Link to="/manage" className="crumb">← Projects</Link>
        <div className="errors" role="alert">{project.error.message}</div>
      </main>
    );
  }
  if (!project.data) return <main className="page"><p className="muted">Loading…</p></main>;

  const p = project.data;
  const span = projectSpan(p.phases);
  const rows = phaseRows(p);
  const cal = calendar.data ?? DEFAULT_CALENDAR;

  return (
    <main className="page">
      <div className="page-header">
        <div>
          <Link to="/manage" className="crumb">← Projects</Link>
          <h1>{p.name}</h1>
          <p className="muted">
            {p.jiraKey ? `${p.jiraKey} · ` : ''}
            {span ? `${span.start} → ${span.end} · ${countWorkingDays(span.start, span.end, cal)} working days` : 'No phases'}
          </p>
        </div>
      </div>

      <section className="card">
        <div className="chart-scroll" ref={chartRef}>
          <Gantt rows={rows} range={rangeFor(rows, today)} width={chartWidth} today={today} />
        </div>
      </section>

      <section className="card">
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
