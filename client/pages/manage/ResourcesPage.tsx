import { useState } from 'react';
import { Link } from 'react-router';
import { addDays, todayLocal } from '../../../shared/calendar';
import { computeWorkload, weekStartOf } from '../../../shared/capacity';
import type { Side } from '../../../shared/types';
import { AlertIcon, ArrowLeftIcon, PlusIcon } from '../../icons';
import { api } from '../../api';
import { useAsync } from '../../useAsync';
import { useWorkload } from '../../useWorkload';
import { SIDE_LABEL, SPECIALISATION_LABEL } from './labels';
import { OverloadPanel } from './OverloadPanel';
import { WorkloadHeatmap } from './WorkloadHeatmap';

const WEEKS_SHOWN = 13;
const defaultStart = () => addDays(weekStartOf(todayLocal()), -14);

export function ResourcesPage() {
  const people = useAsync(() => api.listResources(), []);
  const lists = useAsync(() => api.getLists(), []);
  const [side, setSide] = useState<Side | 'all'>('all');
  const [roleId, setRoleId] = useState<number | null>(null);

  const { workload, error: workloadError, reload } = useWorkload();
  const [from, setFrom] = useState(defaultStart);
  const [selected, setSelected] = useState<{ resourceId: number; weekStart: string } | null>(null);

  const range = { start: from, end: addDays(from, WEEKS_SHOWN * 7 - 1) };
  const loads = workload ? computeWorkload(workload.resources, workload.assignments, range, workload.calendar) : [];
  const selectedPerson = selected ? loads.find((l) => l.resourceId === selected.resourceId) : undefined;
  const selectedWeek = selected ? selectedPerson?.weeks.find((w) => w.weekStart === selected.weekStart) : undefined;

  const all = people.data ?? [];
  const shown = all.filter((p) => (side === 'all' || p.side === side) && (roleId === null || p.role?.id === roleId));

  return (
    <main className="page">
      <div className="page-header">
        <div>
          <Link to="/manage" className="crumb"><ArrowLeftIcon />Projects</Link>
          <h1>Resources</h1>
          <p className="meta-line">Your tech team, who can be assigned to phases, and your business-side contacts.</p>
        </div>
        <Link to="/manage/resources/new" className="button"><PlusIcon />Add person</Link>
      </div>

      {people.error ? (
        <div className="errors" role="alert">
          <AlertIcon />
          <span>{people.error.message}</span>
        </div>
      ) : null}

      <section className="card">
        <div className="card-head">
          <h2>Workload</h2>
          <div className="year-nav">
            <button type="button" className="button secondary" aria-label="Earlier weeks" onClick={() => setFrom((f) => addDays(f, -28))}>‹</button>
            <button type="button" className="button secondary" onClick={() => setFrom(defaultStart())}>This week</button>
            <button type="button" className="button secondary" aria-label="Later weeks" onClick={() => setFrom((f) => addDays(f, 28))}>›</button>
          </div>
        </div>
        <p className="muted">How much of each week is booked. Click a week to see what is in it and to sort out an overbooking.</p>
        <div className="heat-legend" aria-hidden="true">
          <span className="heat heat-low">Light</span>
          <span className="heat heat-mid">Booked</span>
          <span className="heat heat-full">Full</span>
          <span className="heat heat-over">Overbooked</span>
          <span className="heat heat-accepted">Accepted</span>
          <span className="heat leave-sample">
            Leave
            <span className="leave-strip" aria-hidden="true"><span className="leave-slice on-leave" /></span>
          </span>
        </div>
        {workloadError ? (
          <div className="errors" role="alert">
            <AlertIcon />
            <span>{workloadError.message}</span>
          </div>
        ) : null}
        {!workload && !workloadError ? <p className="muted">Loading…</p> : null}
        {workload ? (
          <WorkloadHeatmap
            loads={loads}
            decisions={workload.decisions}
            calendar={workload.calendar}
            resources={workload.resources}
            selected={selected}
            onSelect={(resourceId, weekStart) => setSelected({ resourceId, weekStart })}
          />
        ) : null}
      </section>

      {workload && selectedPerson && selectedWeek ? (
        <OverloadPanel
          key={`${selectedPerson.resourceId}-${selectedWeek.weekStart}`}
          data={workload}
          person={selectedPerson}
          week={selectedWeek}
          onClose={() => setSelected(null)}
          onChanged={reload}
        />
      ) : null}

      <section className="card">
        <h2>People</h2>
        <div className="filters">
          <label>
            Side
            <select value={side} onChange={(e) => setSide(e.target.value as Side | 'all')}>
              <option value="all">Everyone</option>
              <option value="tech">{SIDE_LABEL.tech}</option>
              <option value="business">{SIDE_LABEL.business}</option>
            </select>
          </label>
          <label>
            Role
            <select
              value={roleId === null ? '' : String(roleId)}
              onChange={(e) => setRoleId(e.target.value === '' ? null : Number(e.target.value))}
            >
              <option value="">All roles</option>
              {(lists.data?.role ?? []).map((r) => (
                <option key={r.id} value={String(r.id)}>{r.name}</option>
              ))}
            </select>
          </label>
        </div>

        {!people.data && !people.error ? <p className="muted">Loading…</p> : null}
        {people.data && all.length === 0 ? <p className="muted">No one yet. Add your team and your business-side contacts.</p> : null}
        {people.data && all.length > 0 && shown.length === 0 ? <p className="muted">No one matches these filters.</p> : null}

        {shown.length > 0 ? (
          <table aria-label="People">
            <thead>
              <tr><th>Name</th><th>Side</th><th>Role</th><th>Capacity</th><th>Contact</th><th>Status</th></tr>
            </thead>
            <tbody>
              {shown.map((p) => (
                <tr key={p.id}>
                  <td><Link to={`/manage/resources/${p.id}`}>{p.name}</Link></td>
                  <td>{SIDE_LABEL[p.side]}</td>
                  <td>
                    {p.role?.name ?? '—'}
                    {p.specialisation ? ` · ${SPECIALISATION_LABEL[p.specialisation]}` : ''}
                  </td>
                  <td>{p.side === 'tech' ? `${p.capacity}%` : '—'}</td>
                  <td>{[p.phone, p.email].filter(Boolean).join(' · ') || '—'}</td>
                  <td>{p.active ? 'Active' : 'Inactive'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
      </section>
    </main>
  );
}
