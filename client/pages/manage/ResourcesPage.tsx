import { useState } from 'react';
import { Link } from 'react-router';
import { addDays, todayLocal } from '../../../shared/calendar';
import { computeDailyLoad, computeWorkload, weekStartOf } from '../../../shared/capacity';
import type { MessageKey } from '../../../shared/i18n/en';
import type { ResourceRecord, Side } from '../../../shared/types';
import { AlertIcon, ArrowLeftIcon, PlusIcon } from '../../icons';
import { api } from '../../api';
import { messagesOf } from '../../errors';
import { formatDate } from '../../i18n/format';
import { useLang, useT } from '../../i18n/LanguageProvider';
import { companyName, listName, phaseName, roleName } from '../../i18n/listNames';
import { useAsync } from '../../useAsync';
import { useWorkload } from '../../useWorkload';
import { SIDE_KEY, SPECIALISATION_KEY } from './labels';
import { OverloadPanel } from './OverloadPanel';
import { sortOutsourced, sortPeople, workingOn, type OutsourcedSortKey, type SortDir, type SortKey } from './peopleTable';
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

const COLUMNS: { key: SortKey; label: MessageKey }[] = [
  { key: 'name', label: 'resources.colName' },
  { key: 'side', label: 'resources.side' },
  { key: 'role', label: 'resources.role' },
  { key: 'company', label: 'resources.colCompany' },
  { key: 'projects', label: 'resources.colProjects' },
  { key: 'capacity', label: 'resources.colCapacity' },
  { key: 'contact', label: 'resources.colContact' },
  { key: 'status', label: 'resources.colStatus' },
];

const OUTSOURCED_COLUMNS: { key: OutsourcedSortKey; label: MessageKey }[] = [
  { key: 'name', label: 'resources.colName' },
  { key: 'company', label: 'resources.colCompany' },
  { key: 'project', label: 'resources.colProject' },
  { key: 'start', label: 'resources.colStart' },
  { key: 'end', label: 'resources.colEnd' },
  { key: 'contact', label: 'resources.colContact' },
];

/** Every project appearing in any outsourced person's engagement, sorted by name, for the Outsourced filter. */
function engagementProjectOptions(people: ResourceRecord[]): { id: number; name: string }[] {
  const byId = new Map<number, string>();
  for (const p of people) if (p.engagementProject) byId.set(p.engagementProject.id, p.engagementProject.name);
  return [...byId.entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
}

/** The heatmap legend: each level's class and its catalogue key. */
const LEGEND: { className: string; label: MessageKey }[] = [
  { className: 'heat heat-low', label: 'heatmap.legendLight' },
  { className: 'heat heat-mid', label: 'heatmap.legendBooked' },
  { className: 'heat heat-full', label: 'heatmap.legendFull' },
  { className: 'heat heat-over', label: 'heatmap.legendOverbooked' },
  { className: 'heat heat-accepted', label: 'heatmap.legendAccepted' },
  { className: 'heat heat-off leave', label: 'heatmap.legendLeave' },
];

/** Every project appearing in anyone's list, sorted by name, for the "Working on" filter. */
function projectOptions(people: ResourceRecord[]): { id: number; name: string }[] {
  const byId = new Map<number, string>();
  for (const p of people) for (const proj of p.projects) byId.set(proj.id, proj.name);
  return [...byId.entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
}

export function ResourcesPage() {
  const t = useT();
  const { lang } = useLang();
  const people = useAsync(() => api.listResources(), []);
  const lists = useAsync(() => api.getLists(), []);
  const [side, setSide] = useState<Side | 'all'>('all');
  const [roleId, setRoleId] = useState<number | null>(null);
  const [projectId, setProjectId] = useState<number | null>(null);
  const [peopleCompanyId, setPeopleCompanyId] = useState<number | null>(null);
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({ key: 'name', dir: 'asc' });
  const [companyId, setCompanyId] = useState<number | null>(null);
  const [outsourcedProjectId, setOutsourcedProjectId] = useState<number | null>(null);
  const [outsourcedSort, setOutsourcedSort] = useState<{ key: OutsourcedSortKey; dir: SortDir }>({ key: 'name', dir: 'asc' });

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

  // The People table is our team and business contacts only; outsourced people get their own section below.
  const all = (people.data ?? []).filter((p) => p.employment === 'staff');
  const filtered = all.filter(
    (p) =>
      (side === 'all' || p.side === side) &&
      (roleId === null || p.role?.id === roleId) &&
      (projectId === null || workingOn(p, projectId)) &&
      (peopleCompanyId === null || p.company?.id === peopleCompanyId),
  );
  const roles = lists.data?.role ?? [];
  const companies = lists.data?.company ?? [];
  const shown = sortPeople(filtered, sort.key, sort.dir, lang, roles, companies);
  const nameFor = (name: string) => (lists.data ? phaseName(name, lists.data, lang) : name);
  const toggleSort = (key: SortKey) => setSort((s) => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }));

  const outsourced = (people.data ?? []).filter((p) => p.employment === 'outsourced');
  // Upcoming and engaged people are both current: only the past ones move to history.
  const engagedOutsourced = outsourced.filter((p) => p.engagement !== 'past');
  const pastOutsourced = outsourced.filter((p) => p.engagement === 'past');
  const outsourcedFiltered = engagedOutsourced.filter(
    (p) => (companyId === null || p.company?.id === companyId) && (outsourcedProjectId === null || p.engagementProject?.id === outsourcedProjectId),
  );
  const outsourcedShown = sortOutsourced(outsourcedFiltered, outsourcedSort.key, outsourcedSort.dir, lang, companies);
  const toggleOutsourcedSort = (key: OutsourcedSortKey) =>
    setOutsourcedSort((s) => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }));

  return (
    <main className="page">
      <div className="page-header">
        <div>
          <Link to="/manage" className="crumb"><ArrowLeftIcon />{t('nav.projects')}</Link>
          <h1>{t('nav.resources')}</h1>
          <p className="meta-line">{t('resources.intro')}</p>
        </div>
        <Link to="/manage/resources/new" className="button"><PlusIcon />{t('resources.addPerson')}</Link>
      </div>

      {people.error ? (
        <div className="errors" role="alert">
          <AlertIcon />
          <span>{messagesOf(people.error, t)[0]}</span>
        </div>
      ) : null}

      <section className="card">
        <div className="card-head">
          <h2>{t('resources.workload')}</h2>
          <div className="year-nav">
            <div className="view-switch" role="group" aria-label={t('resources.showBy')}>
              {(['days', 'weeks'] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  className="button secondary"
                  aria-pressed={view === v}
                  onClick={() => chooseView(v)}
                >
                  {v === 'days' ? t('resources.days') : t('resources.weeks')}
                </button>
              ))}
            </div>
            <button type="button" className="button secondary" aria-label={t('resources.earlier')} onClick={() => shift(-step)}>‹</button>
            <button
              type="button"
              className="button secondary"
              onClick={() => setFrom((f) => ({ ...f, [view]: defaultStart(view) }))}
            >
              {t('resources.thisWeek')}
            </button>
            <button type="button" className="button secondary" aria-label={t('resources.later')} onClick={() => shift(step)}>›</button>
          </div>
        </div>
        <p className="muted">
          {view === 'days' ? t('resources.daysHint') : t('resources.weeksHint')}
        </p>
        <div className="heat-legend" aria-hidden="true">
          {LEGEND.map((l) => (
            <span key={l.label} className={l.className}>{t(l.label)}</span>
          ))}
        </div>
        {workloadError ? (
          <div className="errors" role="alert">
            <AlertIcon />
            <span>{messagesOf(workloadError, t)[0]}</span>
          </div>
        ) : null}
        {!workload && !workloadError ? <p className="muted">{t('common.loading')}</p> : null}
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
          nameFor={nameFor}
        />
      ) : null}

      <section className="card">
        <h2>{t('resources.people')}</h2>
        <div className="filters">
          <label>
            {t('resources.side')}
            <select value={side} onChange={(e) => setSide(e.target.value as Side | 'all')}>
              <option value="all">{t('resources.everyone')}</option>
              <option value="tech">{t(SIDE_KEY.tech)}</option>
              <option value="business">{t(SIDE_KEY.business)}</option>
            </select>
          </label>
          <label>
            {t('resources.role')}
            <select
              value={roleId === null ? '' : String(roleId)}
              onChange={(e) => setRoleId(e.target.value === '' ? null : Number(e.target.value))}
            >
              <option value="">{t('resources.allRoles')}</option>
              {roles.map((r) => (
                <option key={r.id} value={String(r.id)}>{listName(r, lang)}</option>
              ))}
            </select>
          </label>
          <label>
            {t('resources.workingOn')}
            <select
              value={projectId === null ? '' : String(projectId)}
              onChange={(e) => setProjectId(e.target.value === '' ? null : Number(e.target.value))}
            >
              <option value="">{t('resources.anyProject')}</option>
              {projectOptions(all).map((p) => (
                <option key={p.id} value={String(p.id)}>{p.name}</option>
              ))}
            </select>
          </label>
          <label>
            {t('resources.filterCompany')}
            <select
              value={peopleCompanyId === null ? '' : String(peopleCompanyId)}
              onChange={(e) => setPeopleCompanyId(e.target.value === '' ? null : Number(e.target.value))}
            >
              <option value="">{t('resources.anyCompany')}</option>
              {companies.map((c) => (
                <option key={c.id} value={String(c.id)}>{listName(c, lang)}</option>
              ))}
            </select>
          </label>
        </div>

        {!people.data && !people.error ? <p className="muted">{t('common.loading')}</p> : null}
        {people.data && all.length === 0 ? <p className="muted">{t('resources.noOneYet')}</p> : null}
        {people.data && all.length > 0 && shown.length === 0 ? <p className="muted">{t('resources.noMatches')}</p> : null}

        {shown.length > 0 ? (
          <table aria-label={t('resources.people')}>
            <thead>
              <tr>
                {COLUMNS.map(({ key, label }) => (
                  <th key={key} aria-sort={sort.key === key ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
                    <button type="button" className="sort-button" onClick={() => toggleSort(key)}>
                      {t(label)}
                      {sort.key === key ? <span aria-hidden="true"> {sort.dir === 'asc' ? '▲' : '▼'}</span> : null}
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {shown.map((p) => (
                <tr key={p.id}>
                  <td><Link to={`/manage/resources/${p.id}`} dir="auto" data-user-content="">{p.name}</Link></td>
                  <td>{t(SIDE_KEY[p.side])}</td>
                  <td>
                    {p.role ? roleName(p.role, roles, lang) : '—'}
                    {p.specialisation ? ` · ${t(SPECIALISATION_KEY[p.specialisation])}` : ''}
                  </td>
                  <td dir="auto" data-user-content="">{p.company ? companyName(p.company, companies, lang) : '—'}</td>
                  <td>
                    {p.projects.length === 0 ? (
                      '—'
                    ) : (
                      p.projects.map((proj, i) => (
                        <span key={proj.id}>
                          {i > 0 ? ', ' : ''}
                          <Link to={`/manage/projects/${proj.id}`} className={proj.finished ? 'muted' : undefined} dir="auto" data-user-content="">
                            {proj.name}
                          </Link>
                          {proj.finished ? ` ${t('resources.finished')}` : ''}
                        </span>
                      ))
                    )}
                  </td>
                  <td>{p.side === 'tech' ? `${p.capacity}%` : '—'}</td>
                  <td>
                    {p.phone || p.email ? <span dir="ltr">{[p.phone, p.email].filter(Boolean).join(' · ')}</span> : '—'}
                  </td>
                  <td>{t(p.active ? 'person.active' : 'person.inactive')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
      </section>

      <section className="card">
        <h2>{t('resources.outsourced')}</h2>
        <p className="muted">{t('resources.outsourcedIntro')}</p>
        <div className="filters">
          <label>
            {t('resources.filterCompany')}
            <select value={companyId === null ? '' : String(companyId)} onChange={(e) => setCompanyId(e.target.value === '' ? null : Number(e.target.value))}>
              <option value="">{t('resources.anyCompany')}</option>
              {companies.map((c) => (
                <option key={c.id} value={String(c.id)}>{listName(c, lang)}</option>
              ))}
            </select>
          </label>
          <label>
            {t('resources.colProject')}
            <select
              value={outsourcedProjectId === null ? '' : String(outsourcedProjectId)}
              onChange={(e) => setOutsourcedProjectId(e.target.value === '' ? null : Number(e.target.value))}
            >
              <option value="">{t('resources.anyProject')}</option>
              {engagementProjectOptions(engagedOutsourced).map((p) => (
                <option key={p.id} value={String(p.id)}>{p.name}</option>
              ))}
            </select>
          </label>
        </div>

        {engagedOutsourced.length === 0 ? <p className="muted">{t('resources.noOutsourced')}</p> : null}
        {engagedOutsourced.length > 0 && outsourcedShown.length === 0 ? <p className="muted">{t('resources.noMatches')}</p> : null}

        {outsourcedShown.length > 0 ? (
          <table aria-label={t('resources.outsourced')}>
            <thead>
              <tr>
                {OUTSOURCED_COLUMNS.map(({ key, label }) => (
                  <th key={key} aria-sort={outsourcedSort.key === key ? (outsourcedSort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
                    <button type="button" className="sort-button" onClick={() => toggleOutsourcedSort(key)}>
                      {t(label)}
                      {outsourcedSort.key === key ? <span aria-hidden="true"> {outsourcedSort.dir === 'asc' ? '▲' : '▼'}</span> : null}
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {outsourcedShown.map((p) => (
                <tr key={p.id}>
                  <td>
                    <Link to={`/manage/resources/${p.id}`} dir="auto" data-user-content="">{p.name}</Link>
                    {p.engagement === 'upcoming' && p.engagementStart ? (
                      <span className="muted"> · {t('resources.startsOn', { date: formatDate(lang, p.engagementStart) })}</span>
                    ) : null}
                  </td>
                  <td dir="auto" data-user-content="">{p.company ? companyName(p.company, companies, lang) : '—'}</td>
                  <td>
                    {p.engagementProject ? (
                      <Link to={`/manage/projects/${p.engagementProject.id}`} dir="auto" data-user-content="">{p.engagementProject.name}</Link>
                    ) : '—'}
                  </td>
                  <td>{p.engagementStart ? formatDate(lang, p.engagementStart) : '—'}</td>
                  <td>{p.engagementEnd ? formatDate(lang, p.engagementEnd) : '—'}</td>
                  <td>
                    {p.phone || p.email ? <span dir="ltr">{[p.phone, p.email].filter(Boolean).join(' · ')}</span> : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}

        {pastOutsourced.length > 0 ? (
          <details className="past-outsourced">
            <summary>{t('resources.pastOutsourced', { count: pastOutsourced.length })}</summary>
            <table aria-label={t('resources.pastOutsourced', { count: pastOutsourced.length })}>
              <thead>
                <tr>
                  {OUTSOURCED_COLUMNS.map(({ key, label }) => <th key={key}>{t(label)}</th>)}
                </tr>
              </thead>
              <tbody>
                {sortOutsourced(pastOutsourced, 'name', 'asc', lang, companies).map((p) => (
                  <tr key={p.id}>
                    <td><Link to={`/manage/resources/${p.id}`} dir="auto" data-user-content="">{p.name}</Link></td>
                    <td dir="auto" data-user-content="">{p.company ? companyName(p.company, companies, lang) : '—'}</td>
                    <td>{p.engagementProject ? p.engagementProject.name : '—'}</td>
                    <td>{p.engagementStart ? formatDate(lang, p.engagementStart) : '—'}</td>
                    <td>{p.engagementEnd ? formatDate(lang, p.engagementEnd) : '—'}</td>
                    <td>
                      {p.phone || p.email ? <span dir="ltr">{[p.phone, p.email].filter(Boolean).join(' · ')}</span> : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
        ) : null}
      </section>
    </main>
  );
}
