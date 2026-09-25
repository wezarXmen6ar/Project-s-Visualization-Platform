import { Fragment, useState, type ReactNode } from 'react';
import { Link, useParams } from 'react-router';
import { DEFAULT_CALENDAR, countWorkingDays, todayLocal } from '../../../shared/calendar';
import { projectSpan } from '../../../shared/scheduler';
import type { ProjectRecord } from '../../../shared/types';
import { AlertIcon, ArrowLeftIcon } from '../../icons';
import { api } from '../../api';
import { Gantt } from '../../gantt/Gantt';
import { phaseRows, rangeFor } from '../../gantt/rows';
import { useElementWidth } from '../../gantt/useElementWidth';
import { dayDate } from '../../overloads';
import { useAsync } from '../../useAsync';
import { useResources } from '../../useResources';
import { useWorkload } from '../../useWorkload';
import { CATEGORY_LABEL, PRIORITY_LABEL, SCOPE_TABLES, beneficiaryLabel, requesterLabel } from './labels';
import { ProjectPeople } from './ProjectPeople';

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

export function ProjectPage() {
  const id = Number(useParams().id);
  const project = useAsync(() => api.getProject(id), [id]);
  const calendar = useAsync(() => api.getCalendar(), []);
  const [chartRef, chartWidth] = useElementWidth<HTMLDivElement>();
  const { people } = useResources();
  const { workload, reload: reloadWorkload } = useWorkload();
  const [saved, setSaved] = useState<ProjectRecord | null>(null);
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

  const p = saved ?? project.data;
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
        <div className="header-actions">
          <Link to={`/manage/projects/${p.id}/phases`} className="button secondary">Edit phases</Link>
          <Link to={`/manage/projects/${p.id}/edit`} className="button secondary">Edit details</Link>
        </div>
      </div>

      <section className="card">
        <h2>Timeline</h2>
        <div className="chart-scroll" ref={chartRef}>
          <Gantt rows={rows} range={rangeFor(rows, today)} width={chartWidth} today={today} />
        </div>
      </section>

      <section className="card">
        <h2>Details</h2>
        <dl className="details-grid">
          <Detail label="Priority">{PRIORITY_LABEL[p.priority]}</Detail>
          <Detail label="Project manager (tech)">{p.projectManager?.name ?? '—'}</Detail>
          <Detail label="Business project manager">
            <span>{p.businessPm?.name ?? '—'}</span>
            {p.businessPm?.phone ? (
              <a className="detail-line" href={`tel:${p.businessPm.phone.replace(/\s/g, '')}`}>{p.businessPm.phone}</a>
            ) : null}
            {p.businessPm?.email ? (
              <a className="detail-line" href={`mailto:${p.businessPm.email}`}>{p.businessPm.email}</a>
            ) : null}
          </Detail>
          <Detail label="Main project">{p.mainProject?.name ?? 'Standalone'}</Detail>
          <Detail label="Categorisation">{p.category ? CATEGORY_LABEL[p.category] : '—'}</Detail>
          <Detail label="Project type">{p.projectType?.name ?? '—'}</Detail>
          <Detail label="Goal">{p.goal?.name ?? '—'}</Detail>
          <Detail label="Business user (department)">{p.department?.name ?? '—'}</Detail>
          <Detail label="Requester">{requesterLabel(p.requester)}</Detail>
          <Detail label="Beneficiary">{beneficiaryLabel(p.beneficiary)}</Detail>
        </dl>
      </section>

      <section className="card">
        <h2>Description</h2>
        <h3>Background</h3>
        <p className="prose">{p.background || '—'}</p>
        <h3>Summary</h3>
        <p className="prose">{p.summary || '—'}</p>
      </section>

      <section className="card">
        <h2>Scope and goals</h2>
        <div className="scope-summary">
          {SCOPE_TABLES.map(({ kind, title }) => {
            const items = p.scopeItems.filter((i) => i.kind === kind).sort((a, b) => a.order - b.order);
            return (
              <div key={kind}>
                <h3>{title}</h3>
                {items.length === 0 ? (
                  <p className="muted">None.</p>
                ) : (
                  <ol>{items.map((i) => <li key={i.id}>{i.text}</li>)}</ol>
                )}
              </div>
            );
          })}
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
              <Fragment key={ph.id}>
                <tr>
                  <td>{ph.name}</td>
                  <td>{dayDate(ph.start)}</td>
                  <td>{dayDate(ph.end)}</td>
                  <td>
                    {ph.durationDays}
                    {ph.subPhases.length > 0 ? <span className="muted"> (from sub-phases)</span> : null}
                  </td>
                </tr>
                {ph.subPhases.map((sp) => (
                  <tr key={sp.id}>
                    <td className="sub-phase-name">
                      ↳ {sp.name}
                      {sp.withPrevious ? <span className="muted"> · starts with the one above</span> : null}
                    </td>
                    <td>{dayDate(sp.start)}</td>
                    <td>{dayDate(sp.end)}</td>
                    <td>{sp.durationDays}</td>
                  </tr>
                ))}
              </Fragment>
            ))}
          </tbody>
        </table>
      </section>

      <ProjectPeople
        project={p}
        people={people}
        workload={workload}
        onSaved={(updated) => {
          setSaved(updated);
          reloadWorkload();
        }}
      />
    </main>
  );
}
