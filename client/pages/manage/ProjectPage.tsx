import { Fragment, useState, type ReactNode } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';
import { DEFAULT_CALENDAR, countWorkingDays, todayLocal } from '../../../shared/calendar';
import { projectSpan } from '../../../shared/scheduler';
import type { ProjectRecord } from '../../../shared/types';
import { AlertIcon, ArrowLeftIcon } from '../../icons';
import { api } from '../../api';
import { messagesOf } from '../../errors';
import { Gantt } from '../../gantt/Gantt';
import { phaseRows, rangeFor } from '../../gantt/rows';
import { useElementWidth } from '../../gantt/useElementWidth';
import { useFormat } from '../../i18n/format';
import { useLang, useT } from '../../i18n/LanguageProvider';
import { listName, phaseName } from '../../i18n/listNames';
import { useAsync } from '../../useAsync';
import { useLists } from '../../useLists';
import { useMe } from '../../useMe';
import { useResources } from '../../useResources';
import { useWorkload } from '../../useWorkload';
import { CATEGORY_KEY, PRIORITY_KEY, SCOPE_TABLES, beneficiaryLabel, requesterLabel } from './labels';
import { NextUp } from './NextUp';
import { ProjectPeople } from './ProjectPeople';
import { ProjectToDos, useProjectToDos } from './ProjectToDos';
import { StarterOffer } from './StarterOffer';

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

/** A person's name as user content, so a Latin name reads correctly inside Arabic (and the other way round). */
function PersonName({ name }: { name: string }) {
  return <span dir="auto" data-user-content="">{name}</span>;
}

export function ProjectPage() {
  const t = useT();
  const { lang } = useLang();
  const { formatDate } = useFormat();
  const { lists } = useLists();
  const id = Number(useParams().id);
  const [searchParams, setSearchParams] = useSearchParams();
  const starterParam = searchParams.get('starter');
  const project = useAsync(() => api.getProject(id), [id]);
  const calendar = useAsync(() => api.getCalendar(), []);
  const [chartRef, chartWidth] = useElementWidth<HTMLDivElement>();
  const { people } = useResources();
  const { workload, reload: reloadWorkload } = useWorkload();
  const { me } = useMe();
  const { todos, reload: reloadToDos, toggleDone, toggleErrors } = useProjectToDos(id);
  const [saved, setSaved] = useState<ProjectRecord | null>(null);
  const today = todayLocal();

  if (project.error) {
    return (
      <main className="page">
        <Link to="/manage" className="crumb"><ArrowLeftIcon />{t('nav.projects')}</Link>
        <div className="errors" role="alert">
          <AlertIcon />
          <span>{messagesOf(project.error, t)[0]}</span>
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
  const cal = calendar.data ?? DEFAULT_CALENDAR;
  const nameFor = (name: string) => phaseName(name, lists, lang);
  const rows = phaseRows(p, { people: p.assignments, calendar: cal, nameFor, lang });

  function clearStarterParam() {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete('starter');
        return next;
      },
      { replace: true },
    );
  }

  return (
    <main className="page page-wide">
      <div className="page-header">
        <div>
          <Link to="/manage" className="crumb"><ArrowLeftIcon />{t('nav.projects')}</Link>
          <h1 dir="auto" data-user-content="">{p.name}</h1>
          <p className="meta-line">
            {p.jiraKey ? <span dir="ltr">{p.jiraKey}</span> : null}
            {p.jiraKey ? ' · ' : ''}
            {span
              ? t('project.span', {
                // English keeps the ISO dates its tests assert; Arabic reads "الاثنين 5 أكتوبر 2026".
                start: lang === 'ar' ? formatDate(span.start) : span.start,
                end: lang === 'ar' ? formatDate(span.end) : span.end,
                count: countWorkingDays(span.start, span.end, cal),
              })
              : t('project.noPhases')}
          </p>
        </div>
        <div className="header-actions">
          <Link to={`/manage/projects/${p.id}/phases`} className="button secondary">{t('project.editPhases')}</Link>
          <Link to={`/manage/projects/${p.id}/edit`} className="button secondary">{t('project.editDetails')}</Link>
        </div>
      </div>

      <NextUp todos={todos} me={me} onToggleDone={(x) => void toggleDone(x)} nameFor={nameFor} />

      {starterParam ? (
        <StarterOffer
          projectId={p.id}
          starterParam={starterParam}
          onAdded={() => {
            reloadToDos();
            clearStarterParam();
          }}
          onSkip={clearStarterParam}
        />
      ) : null}

      <section className="card">
        <h2>{t('project.timeline')}</h2>
        <div className="chart-scroll" ref={chartRef}>
          <Gantt
            rows={rows}
            range={rangeFor(rows, today)}
            width={chartWidth}
            today={today}
            calendar={cal}
            detail="weeks"
            showDates
          />
        </div>
      </section>

      <section className="card">
        <h2>{t('project.details')}</h2>
        <dl className="details-grid">
          <Detail label={t('project.priority')}>{t(PRIORITY_KEY[p.priority])}</Detail>
          <Detail label={t('project.projectManager')}>{p.projectManager ? <PersonName name={p.projectManager.name} /> : '—'}</Detail>
          <Detail label={t('project.businessPm')}>
            {p.businessPm ? <PersonName name={p.businessPm.name} /> : <span>—</span>}
            {p.businessPm?.phone ? (
              <a className="detail-line" dir="ltr" href={`tel:${p.businessPm.phone.replace(/\s/g, '')}`}>{p.businessPm.phone}</a>
            ) : null}
            {p.businessPm?.email ? (
              <a className="detail-line" dir="ltr" href={`mailto:${p.businessPm.email}`}>{p.businessPm.email}</a>
            ) : null}
          </Detail>
          <Detail label={t('project.mainProject')}>{p.mainProject ? listName(p.mainProject, lang) : t('project.standalone')}</Detail>
          <Detail label={t('project.category')}>{p.category ? t(CATEGORY_KEY[p.category]) : '—'}</Detail>
          <Detail label={t('project.projectType')}>{p.projectType ? listName(p.projectType, lang) : '—'}</Detail>
          <Detail label={t('project.goal')}>{p.goal ? listName(p.goal, lang) : '—'}</Detail>
          <Detail label={t('project.department')}>{p.department ? listName(p.department, lang) : '—'}</Detail>
          <Detail label={t('project.requester')}>{requesterLabel(p.requester, lang)}</Detail>
          <Detail label={t('project.beneficiary')}>{beneficiaryLabel(p.beneficiary, lang)}</Detail>
        </dl>
      </section>

      <section className="card">
        <h2>{t('project.description')}</h2>
        <h3>{t('project.background')}</h3>
        <p className="prose" dir="auto" data-user-content="">{p.background || '—'}</p>
        <h3>{t('project.summary')}</h3>
        <p className="prose" dir="auto" data-user-content="">{p.summary || '—'}</p>
      </section>

      <section className="card">
        <h2>{t('project.scopeAndGoals')}</h2>
        <div className="scope-summary">
          {SCOPE_TABLES.map(({ kind, title }) => {
            const items = p.scopeItems.filter((i) => i.kind === kind).sort((a, b) => a.order - b.order);
            return (
              <div key={kind}>
                <h3>{t(title)}</h3>
                {items.length === 0 ? (
                  <p className="muted">{t('project.noneYet')}</p>
                ) : (
                  <ol>{items.map((i) => <li key={i.id} dir="auto" data-user-content="">{i.text}</li>)}</ol>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <section className="card">
        <h2>{t('project.phases')}</h2>
        <table>
          <thead>
            <tr>
              <th>{t('project.colPhase')}</th>
              <th>{t('project.colStart')}</th>
              <th>{t('project.colEnd')}</th>
              <th>{t('project.colWorkingDays')}</th>
            </tr>
          </thead>
          <tbody>
            {p.phases.map((ph) => (
              <Fragment key={ph.id}>
                <tr>
                  <td>{nameFor(ph.name)}</td>
                  <td>{formatDate(ph.start)}</td>
                  <td>{formatDate(ph.end)}</td>
                  <td>
                    {ph.durationDays}
                    {ph.subPhases.length > 0 ? <span className="muted">{` ${t('project.fromSubPhases')}`}</span> : null}
                  </td>
                </tr>
                {ph.subPhases.map((sp) => (
                  <tr key={sp.id}>
                    <td className="sub-phase-name">
                      {/* The arrow points into the row from the phase above: down, then towards the text. Kept
                          outside the dir="auto" span, so it always sits on the reading-direction side, not inside
                          user content that may take its own direction. */}
                      <span aria-hidden="true">{lang === 'ar' ? '↲ ' : '↳ '}</span>
                      <span dir="auto" data-user-content="">{sp.name}</span>
                      {sp.withPrevious ? <span className="muted">{` · ${t('project.startsWithAbove')}`}</span> : null}
                    </td>
                    <td>{formatDate(sp.start)}</td>
                    <td>{formatDate(sp.end)}</td>
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

      <ProjectToDos
        project={p}
        me={me}
        todos={todos}
        reload={reloadToDos}
        toggleDone={toggleDone}
        toggleErrors={toggleErrors}
        nameFor={nameFor}
      />
    </main>
  );
}
