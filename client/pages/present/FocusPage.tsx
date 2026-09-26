import { Link, useParams } from 'react-router';
import { DEFAULT_CALENDAR, todayLocal } from '../../../shared/calendar';
import { projectSpan } from '../../../shared/scheduler';
import { api } from '../../api';
import { PhasePanel, usePhaseParam } from '../../components/PhasePanel';
import { messagesOf } from '../../errors';
import { Gantt } from '../../gantt/Gantt';
import { phaseRows, rangeFor } from '../../gantt/rows';
import { useElementWidth } from '../../gantt/useElementWidth';
import { useLang, useT } from '../../i18n/LanguageProvider';
import { formatDate } from '../../i18n/format';
import { phaseName } from '../../i18n/listNames';
import { useAsync } from '../../useAsync';
import { useLists } from '../../useLists';

export function FocusPage() {
  const t = useT();
  const { lang } = useLang();
  const { lists } = useLists();
  const id = Number(useParams().id);
  const project = useAsync(() => api.getProject(id), [id]);
  const calendar = useAsync(() => api.getCalendar(), []);
  const [chartRef, chartWidth] = useElementWidth<HTMLDivElement>();
  const today = todayLocal();
  const cal = calendar.data ?? DEFAULT_CALENDAR;
  const phasePanel = usePhaseParam();

  if (project.error) {
    return (
      <main className="page">
        <Link to="/present" className="crumb">{t('present.backToPortfolio')}</Link>
        <div className="errors" role="alert">{messagesOf(project.error, t)[0]}</div>
      </main>
    );
  }
  if (!project.data) return <main className="page"><p className="muted">{t('common.loading')}</p></main>;

  const p = project.data;
  const span = projectSpan(p.phases);
  const nameFor = (name: string) => phaseName(name, lists, lang);
  // No people: the presentation side shows no names.
  const rows = phaseRows(p, { calendar: cal, lang, nameFor });
  const backYear = span ? span.start.slice(0, 4) : today.slice(0, 4);
  // English keeps the ISO dates it always showed; Arabic reads them as "الاثنين 5 أكتوبر 2026".
  const spanDate = (d: string) => (lang === 'ar' ? formatDate(lang, d) : d);

  return (
    <main className="page page-wide">
      <div className="page-header">
        <div>
          <Link to={`/present?year=${backYear}`} className="crumb">{t('present.backToPortfolio')}</Link>
          <h1 dir="auto" data-user-content="">{p.name}</h1>
          <p className="muted">{span ? t('present.span', { start: spanDate(span.start), end: spanDate(span.end) }) : t('present.noPhasesYet')}</p>
        </div>
      </div>
      <section className="card">
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
      {/* Read-only: only highlighted entries and their files; no to-dos, people's names or editing controls. */}
      {phasePanel.phaseId !== null ? (
        <PhasePanel
          project={p}
          phaseId={phasePanel.phaseId}
          mode="present"
          calendar={cal}
          nameFor={nameFor}
          onClose={phasePanel.close}
        />
      ) : null}
    </main>
  );
}
