import { useCallback, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';
import { DEFAULT_CALENDAR, countWorkingDays, todayLocal } from '../../../shared/calendar';
import { projectSpan } from '../../../shared/scheduler';
import type { ProjectRecord } from '../../../shared/types';
import { AlertIcon, ArrowLeftIcon } from '../../icons';
import { PhasePanel, usePhaseParam } from '../../components/PhasePanel';
import { api } from '../../api';
import { messagesOf } from '../../errors';
import { Gantt } from '../../gantt/Gantt';
import { phaseRows, rangeFor } from '../../gantt/rows';
import { useElementWidth } from '../../gantt/useElementWidth';
import { useFormat } from '../../i18n/format';
import { useLang, useT } from '../../i18n/LanguageProvider';
import { phaseName } from '../../i18n/listNames';
import { useAsync } from '../../useAsync';
import { useLists } from '../../useLists';
import { useMe } from '../../useMe';
import { useResources } from '../../useResources';
import { useWorkload } from '../../useWorkload';
import { AttachmentsTab } from './AttachmentsTab';
import { HistoryTab } from './HistoryTab';
import { NextUp } from './NextUp';
import { ProjectDetailsTab } from './ProjectDetailsTab';
import { ProjectPeople } from './ProjectPeople';
import { ProjectTabs, type ProjectTab } from './ProjectTabs';
import { ProjectToDos, useProjectToDos } from './ProjectToDos';
import { StarterOffer } from './StarterOffer';

const TAB_KEYS = ['history', 'todos', 'people', 'attachments', 'details'] as const;
type TabKey = (typeof TAB_KEYS)[number];
const DEFAULT_TAB: TabKey = 'history';

function isTabKey(value: string | null): value is TabKey {
  return value !== null && (TAB_KEYS as readonly string[]).includes(value);
}

export function ProjectPage() {
  const t = useT();
  const { lang } = useLang();
  const { formatDate } = useFormat();
  const { lists } = useLists();
  const id = Number(useParams().id);
  const [searchParams, setSearchParams] = useSearchParams();
  const starterParam = searchParams.get('starter');
  const tabParam = searchParams.get('tab');
  const activeTab: TabKey = isTabKey(tabParam) ? tabParam : DEFAULT_TAB;
  const entryParam = searchParams.get('entry');
  const highlightEntryId = entryParam !== null && !Number.isNaN(Number(entryParam)) ? Number(entryParam) : null;
  // Stable across renders, so the History tab's highlight effect (which calls this once it has landed on the entry)
  // doesn't re-run just because ProjectPage re-rendered.
  const clearHighlightParam = useCallback(() => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete('entry');
        return next;
      },
      { replace: true },
    );
  }, [setSearchParams]);
  const project = useAsync(() => api.getProject(id), [id]);
  const calendar = useAsync(() => api.getCalendar(), []);
  const [chartRef, chartWidth] = useElementWidth<HTMLDivElement>();
  const { people } = useResources();
  const { workload, reload: reloadWorkload } = useWorkload();
  const { me } = useMe();
  const { todos, reload: reloadToDos, toggleDone, toggleErrors } = useProjectToDos(id);
  const [saved, setSaved] = useState<ProjectRecord | null>(null);
  const today = todayLocal();
  const phasePanel = usePhaseParam();
  // Bumped when the phase side panel adds something, so the History and Attachments tabs load again.
  const [refreshKey, setRefreshKey] = useState(0);
  const onPanelChanged = useCallback(() => {
    reloadToDos();
    setRefreshKey((k) => k + 1);
  }, [reloadToDos]);

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

  function setActiveTab(key: string, entryId?: number) {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (key === DEFAULT_TAB) next.delete('tab');
        else next.set('tab', key);
        if (entryId !== undefined) next.set('entry', String(entryId));
        return next;
      },
      { replace: true },
    );
  }

  const openToDoCount = todos.filter((x) => !x.done).length;
  const tabs: ProjectTab[] = [
    {
      key: 'history',
      label: t('tabs.history'),
      content: (
        <HistoryTab
          project={p}
          me={me ?? { resourceId: null, name: null }}
          people={people}
          todos={todos}
          toggleDone={(x) => void toggleDone(x)}
          nameFor={nameFor}
          attachmentTypes={lists.attachmentType}
          highlightEntryId={highlightEntryId}
          onHighlighted={clearHighlightParam}
          refreshKey={refreshKey}
        />
      ),
    },
    {
      key: 'todos',
      label: openToDoCount > 0 ? t('tabs.todosCount', { count: openToDoCount }) : t('tabs.todos'),
      content: (
        <ProjectToDos
          project={p}
          me={me}
          todos={todos}
          reload={reloadToDos}
          toggleDone={toggleDone}
          toggleErrors={toggleErrors}
          nameFor={nameFor}
        />
      ),
    },
    {
      key: 'people',
      label: t('tabs.people'),
      content: (
        <ProjectPeople
          project={p}
          people={people}
          workload={workload}
          onSaved={(updated) => {
            setSaved(updated);
            reloadWorkload();
          }}
        />
      ),
    },
    {
      key: 'attachments',
      label: t('tabs.attachments'),
      content: (
        <AttachmentsTab
          project={p}
          attachmentTypes={lists.attachmentType}
          nameFor={nameFor}
          onOpenHistory={(entryId) => setActiveTab('history', entryId)}
          refreshKey={refreshKey}
        />
      ),
    },
    { key: 'details', label: t('tabs.details'), content: <ProjectDetailsTab project={p} nameFor={nameFor} /> },
  ];

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
            onPieceOpen={phasePanel.open}
          />
        </div>
      </section>

      <ProjectTabs tabs={tabs} activeKey={activeTab} onChange={setActiveTab} />

      {phasePanel.phaseId !== null ? (
        <PhasePanel
          project={p}
          phaseId={phasePanel.phaseId}
          mode="manage"
          calendar={cal}
          nameFor={nameFor}
          onClose={phasePanel.close}
          me={me ?? { resourceId: null, name: null }}
          people={people}
          todos={todos}
          onToggleToDo={(x) => void toggleDone(x)}
          attachmentTypes={lists.attachmentType}
          onChanged={onPanelChanged}
        />
      ) : null}
    </main>
  );
}
