import { Link, useParams } from 'react-router';
import { todayLocal } from '../../../shared/calendar';
import { projectSpan } from '../../../shared/scheduler';
import { api } from '../../api';
import { Gantt } from '../../gantt/Gantt';
import { phaseRows, rangeFor } from '../../gantt/rows';
import { useElementWidth } from '../../gantt/useElementWidth';
import { useAsync } from '../../useAsync';

export function FocusPage() {
  const id = Number(useParams().id);
  const project = useAsync(() => api.getProject(id), [id]);
  const [chartRef, chartWidth] = useElementWidth<HTMLDivElement>();
  const today = todayLocal();

  if (project.error) {
    return (
      <main className="page">
        <Link to="/present" className="crumb">← Portfolio</Link>
        <div className="errors" role="alert">{project.error.message}</div>
      </main>
    );
  }
  if (!project.data) return <main className="page"><p className="muted">Loading…</p></main>;

  const p = project.data;
  const span = projectSpan(p.phases);
  const rows = phaseRows(p);
  const backYear = span ? span.start.slice(0, 4) : today.slice(0, 4);

  return (
    <main className="page">
      <div className="page-header">
        <div>
          <Link to={`/present?year=${backYear}`} className="crumb">← Portfolio</Link>
          <h1>{p.name}</h1>
          <p className="muted">{span ? `${span.start} → ${span.end}` : 'No phases yet'}</p>
        </div>
      </div>
      <section className="card">
        <div className="chart-scroll" ref={chartRef}>
          <Gantt rows={rows} range={rangeFor(rows, today)} width={chartWidth} today={today} />
        </div>
      </section>
    </main>
  );
}
