import { useState } from 'react';
import { Link } from 'react-router';
import { addDays, todayLocal } from '../../../shared/calendar';
import { computeDailyLoad, computeWorkload, weekStartOf } from '../../../shared/capacity';
import type { ResourceRecord, Side } from '../../../shared/types';
import { AlertIcon, ArrowLeftIcon, PlusIcon } from '../../icons';
import { api } from '../../api';
import { useAsync } from '../../useAsync';
import { useWorkload } from '../../useWorkload';
import { SIDE_LABEL, SPECIALISATION_LABEL } from './labels';
import { OverloadPanel } from './OverloadPanel';
import { sortPeople, workingOn, type SortDir, type SortKey } from './peopleTable';
import { DayHeatmap } from './DayHeatmap';
import { WorkloadHeatmap } from './WorkloadHeatmap';

type WorkloadView = 'days' | 'weeks';

/** How each view pages through time: the Days view shows 4 weeks from last week, the Weeks view 13 from two weeks back. */
const VIEW_RANGE: Record<WorkloadView, { weeks: number; back: number; step: number }> = {
  days: { weeks: 4, back: 1, step: 1 },
  weeks: { weeks: 13, back: 2, step: 4 },
};
const defaultStart = (view: WorkloadView) => addDays(weekStartOf(todayLocal()), -7 * VIEW_RANGE[view].back);

const VIEW_KEY = 'pvp.workloadView';

function savedView(): WorkloadView {
  try {
    return localStorage.getItem(VIEW_KEY) === 'weeks' ? 'weeks' : 'days';
  } catch {
    return 'days';
  }
}

function saveView(view: WorkloadView) {
  try {
    localStorage.setItem(VIEW_KEY, view);
  } catch {
    // Storage is blocked: the choice lasts until the page is left.
  }
}

const COLUMNS: { key: SortKey; label: string }[] = [
  { key: 'name', label: 'Name' },
  { key: 'side', label: 'Side' },
  { key: 'role', label: 'Role' },
  { key: 'projects', label: 'Projects' },
  { key: 'capacity', label: 'Capacity' },
  { key: 'contact', label: 'Contact' },
  { key: 'status', label: 'Status' },
];

/** Every project appearing in anyone's list, sorted by name, for the "Working on" filter. */
function projectOptions(people: ResourceRecord[]): { id: number; name: string }[] {
  const byId = new Map<number, string>();
  for (const p of people) for (const proj of p.projects) byId.set(proj.id, proj.name);
  return [...byId.entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
}

export function ResourcesPage() {
  const people = useAsync(() => api.listResources(), []);
  const lists = useAsync(() => api.getLists(), []);
  const [side, setSide] = useState<Side | 'all'>('all');
  const [roleId, setRoleId] = useState<number | null>(null);
  const [projectId, setProjectId] = useState<number | null>(null);
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({ key: 'name', dir: 'asc' });

  const { workload, error: workloadError, reload } = useWorkload();
  const [view, setView] = useState<WorkloadView>(savedView);
  const [from, setFrom] = useState<Record<WorkloadView, string>>(() => ({ days: defaultStart('days'), weeks: defaultStart('weeks') }));
  const [selected, setSelected] = useState<{ resourceId: number; weekStart: string } | null>(null);

  const chooseView = (next: WorkloadView) => {
    setView(next);
    saveView(next);
  };
  const shift = (weeks: number) => setFrom((f) => ({ ...f, [view]: addDays(f[view], weeks * 7) }));
  const { weeks: weeksShown, step } = VIEW_RANGE[view];
  const range = { start: from[view], end: addDays(from[view], weeksShown * 7 - 1) };
  const loads = workload && view === 'weeks' ? computeWorkload(workload.resources, workload.assignments, range, workload.calendar) : [];
  const days = workload && view === 'days' ? computeDailyLoad(workload.resources, workload.assignments, range, workload.calendar) : [];
  // The selected week is worked out on its own, so it stays open whichever view is showing and wherever it has scrolled.
  const selectedResource = selected ? workload?.resources.find((r) => r.id === selected.resourceId) : undefined;
  const selectedPerson =
    selected && workload && selectedResource
      ? computeWorkload(
        [selectedResource],
        workload.assignments,
        { start: selected.weekStart, end: addDays(selected.weekStart, 6) },
        workload.calendar,
      )[0]
      : undefined;
  const selectedWeek = selectedPerson?.weeks[0];
  const select = (resourceId: number, weekStart: string) => setSelected({ resourceId, weekStart });

  const all = people.data ?? [];
  const filtered = all.filter(
    (p) =>
      (side === 'all' || p.side === side) &&
      (roleId === null || p.role?.id === roleId) &&
      (projectId === null || workingOn(p, projectId)),
  );
  const shown = sortPeople(filtered, sort.key, sort.dir);
  const toggleSort = (key: SortKey) => setSort((s) => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }));

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
            <div className="view-switch" role="group" aria-label="Show the workload by">
              {(['days', 'weeks'] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  className="button secondary"
                  aria-pressed={view === v}
                  onClick={() => chooseView(v)}
                >
                  {v === 'days' ? 'Days' : 'Weeks'}
                </button>
              ))}
            </div>
            <button type="button" className="button secondary" aria-label="Earlier weeks" onClick={() => shift(-step)}>‹</button>
            <button
              type="button"
              className="button secondary"
              onClick={() => setFrom((f) => ({ ...f, [view]: defaultStart(view) }))}
            >
              This week
            </button>
            <button type="button" className="button secondary" aria-label="Later weeks" onClick={() => shift(step)}>›</button>
          </div>
        </div>
        <p className="muted">
          {view === 'days'
            ? 'How much of each working day is booked. Click a day to see its week and to sort out an overbooking.'
            : 'How much of each week is booked. Click a week to see what is in it and to sort out an overbooking.'}
        </p>
        <div className="heat-legend" aria-hidden="true">
          <span className="heat heat-low">Light</span>
          <span className="heat heat-mid">Booked</span>
          <span className="heat heat-full">Full</span>
          <span className="heat heat-over">Overbooked</span>
          <span className="heat heat-accepted">Accepted</span>
          <span className="heat heat-off leave">Leave</span>
        </div>
        {workloadError ? (
          <div className="errors" role="alert">
            <AlertIcon />
            <span>{workloadError.message}</span>
          </div>
        ) : null}
        {!workload && !workloadError ? <p className="muted">Loading…</p> : null}
        {workload && view === 'days' ? (
          <DayHeatmap people={days} decisions={workload.decisions} selected={selected} onSelect={select} />
        ) : null}
        {workload && view === 'weeks' ? (
          <WorkloadHeatmap
            loads={loads}
            decisions={workload.decisions}
            calendar={workload.calendar}
            resources={workload.resources}
            selected={selected}
            onSelect={select}
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
          <label>
            Working on
            <select
              value={projectId === null ? '' : String(projectId)}
              onChange={(e) => setProjectId(e.target.value === '' ? null : Number(e.target.value))}
            >
              <option value="">Any project</option>
              {projectOptions(all).map((p) => (
                <option key={p.id} value={String(p.id)}>{p.name}</option>
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
              <tr>
                {COLUMNS.map(({ key, label }) => (
                  <th key={key} aria-sort={sort.key === key ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
                    <button type="button" className="sort-button" onClick={() => toggleSort(key)}>
                      {label}
                      {sort.key === key ? <span aria-hidden="true"> {sort.dir === 'asc' ? '▲' : '▼'}</span> : null}
                    </button>
                  </th>
                ))}
              </tr>
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
                  <td>
                    {p.projects.length === 0 ? (
                      '—'
                    ) : (
                      p.projects.map((proj, i) => (
                        <span key={proj.id}>
                          {i > 0 ? ', ' : ''}
                          <Link to={`/manage/projects/${proj.id}`} className={proj.finished ? 'muted' : undefined}>
                            {proj.name}
                          </Link>
                          {proj.finished ? ' (finished)' : ''}
                        </span>
                      ))
                    )}
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
