import { Link, useNavigate } from 'react-router';
import { addDays, todayLocal } from '../../../shared/calendar';
import { computeWorkload, weekStartOf } from '../../../shared/capacity';
import { projectSpan } from '../../../shared/scheduler';
import { AlertIcon, ArrowLeftIcon, FolderOpenIcon, PlusIcon } from '../../icons';
import { api } from '../../api';
import { messagesOf } from '../../errors';
import { Gantt } from '../../gantt/Gantt';
import { portfolioRows, rangeFor } from '../../gantt/rows';
import { useElementWidth } from '../../gantt/useElementWidth';
import { useLang, useT } from '../../i18n/LanguageProvider';
import { formatDate } from '../../i18n/format';
import { phaseName } from '../../i18n/listNames';
import { useAsync } from '../../useAsync';
import { useLists } from '../../useLists';
import { useWorkload } from '../../useWorkload';
import { isAccepted } from './heatmap';
import { MyNextSteps } from './MyNextSteps';

export function ManageDashboardPage() {
  const t = useT();
  const { lang } = useLang();
  const { lists } = useLists();
  const navigate = useNavigate();
  const projects = useAsync(() => api.listProjects(), []);
  const [chartRef, chartWidth] = useElementWidth<HTMLDivElement>();
  const today = todayLocal();
  const { workload } = useWorkload();
  const thisWeek = weekStartOf(today);
  const NOTICE_WEEKS = 4;
  const overbooked = workload
    ? computeWorkload(workload.resources, workload.assignments, { start: thisWeek, end: addDays(thisWeek, NOTICE_WEEKS * 7 - 1) }, workload.calendar)
        .filter((p) => p.weeks.some((w) => w.overloaded && !isAccepted(workload.decisions, p.resourceId, w.weekStart)))
    : [];
  const list = projects.data ?? [];
  const rows = portfolioRows(list, (name) => phaseName(name, lists, lang), lang);
  // English keeps the ISO dates it always showed; Arabic reads them as "الخميس 24 سبتمبر 2026".
  const spanDate = (d: string) => (lang === 'ar' ? formatDate(lang, d) : d);
  const within = t('dashboard.withinWeeks', { count: NOTICE_WEEKS });

  return (
    <main className="page page-wide">
      <div className="page-header">
        <div>
          <Link to="/" className="crumb"><ArrowLeftIcon />{t('nav.start')}</Link>
          <h1>{t('nav.projects')}</h1>
        </div>
        <div className="header-actions">
          <Link to="/manage/todos" className="button secondary">{t('nav.todos')}</Link>
          <Link to="/manage/resources" className="button secondary">{t('nav.resources')}</Link>
          <Link to="/manage/settings" className="button secondary">{t('nav.settings')}</Link>
          <Link to="/manage/projects/new" className="button"><PlusIcon />{t('project.new')}</Link>
        </div>
      </div>

      {projects.error ? (
        <div className="errors" role="alert">
          <AlertIcon />
          <span>{messagesOf(projects.error, t)[0]}</span>
        </div>
      ) : null}

      {overbooked.length > 0 ? (
        <div className="notice" role="status">
          <AlertIcon />
          <span>
            {overbooked.length === 1
              ? t('dashboard.overbookedOne', { name: overbooked[0].name, within })
              : t('dashboard.overbookedMany', { count: overbooked.length, within })}
          </span>
          <Link to="/manage/resources">{t('dashboard.seeWorkload')}</Link>
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
            <h3>{t('project.emptyTitle')}</h3>
            <p>{t('project.emptyBody')}</p>
            <Link to="/manage/projects/new" className="button">{t('project.createFirst')}</Link>
          </div>
        </section>
      ) : null}

      {list.length > 0 ? (
        <>
          <section className="card">
            <h2>{t('project.timeline')}</h2>
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
                <tr>
                  <th>{t('project.colProject')}</th>
                  <th>{t('project.jiraKey')}</th>
                  <th>{t('project.colStart')}</th>
                  <th>{t('project.colEnd')}</th>
                  <th>{t('project.phases')}</th>
                </tr>
              </thead>
              <tbody>
                {list.map((p) => {
                  const span = projectSpan(p.phases);
                  return (
                    <tr key={p.id}>
                      <td><Link to={`/manage/projects/${p.id}`} dir="auto" data-user-content="">{p.name}</Link></td>
                      <td>{p.jiraKey ? <span dir="ltr">{p.jiraKey}</span> : '—'}</td>
                      <td>{span ? spanDate(span.start) : '—'}</td>
                      <td>{span ? spanDate(span.end) : '—'}</td>
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
