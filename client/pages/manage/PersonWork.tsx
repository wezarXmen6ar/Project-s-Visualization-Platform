import { Link } from 'react-router';
import type { ISODate } from '../../../shared/calendar';
import type { ToDoRecord, WorkloadData } from '../../../shared/types';
import { formatDate } from '../../i18n/format';
import { useLang, useT } from '../../i18n/LanguageProvider';
import { dueLabel, phaseRefLabel, type PhaseNameFor } from '../../todos';
import { ASSIGNMENT_ROLE_KEY } from './labels';

interface PersonWorkProps {
  personId: number;
  workload: WorkloadData | undefined;
  today: ISODate;
  /** This person's open to-dos, so each assignment item can show the ones linked to it. */
  todos?: ToDoRecord[];
  /** Maps a top-level phase's stored name to its display name (e.g. its Arabic name). Sub-phase names never change. */
  nameFor?: PhaseNameFor;
}

/** What this person is currently and about to be working on: every assignment that has not ended yet. */
export function PersonWork({ personId, workload, today, todos = [], nameFor }: PersonWorkProps) {
  const t = useT();
  const { lang } = useLang();
  const items = (workload?.assignments ?? [])
    .filter((a) => a.resourceId === personId && a.end >= today)
    .sort((a, b) => a.start.localeCompare(b.start) || a.projectName.localeCompare(b.projectName));

  return (
    <section className="card">
      <h2>{t('resources.workingOn')}</h2>
      {items.length === 0 ? (
        <p className="muted item-empty">{t('person.nothingBooked')}</p>
      ) : (
        <ul className="work-list">
          {items.map((a) => {
            const onThis = todos.filter((x) => !x.done && x.phase?.id === a.phaseId);
            return (
              <li key={a.id}>
                <Link to={`/manage/projects/${a.projectId}`} dir="auto" data-user-content="">{a.projectName}</Link> ›{' '}
                {phaseRefLabel({ phaseName: a.topPhaseName, subPhaseName: a.subPhaseName }, nameFor)}
                {a.start <= today && today <= a.end ? <span className="badge">{t('person.now')}</span> : null}
                <span className="muted">
                  {formatDate(lang, a.start)} – {formatDate(lang, a.end)} · {a.allocation}% · {t(ASSIGNMENT_ROLE_KEY[a.role])}
                </span>
                {onThis.length > 0 ? (
                  <ul className="work-todo-list">
                    {onThis.map((x) => {
                      const label = dueLabel(x, today, lang);
                      return (
                        <li key={x.id} className="muted">
                          ☐ <span dir="auto" data-user-content="">{x.title}</span>
                          {label ? ` · ${label}` : ''}
                        </li>
                      );
                    })}
                  </ul>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
