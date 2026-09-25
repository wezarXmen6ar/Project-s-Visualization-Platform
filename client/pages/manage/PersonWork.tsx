import { Link } from 'react-router';
import type { ISODate } from '../../../shared/calendar';
import type { ToDoRecord, WorkloadData } from '../../../shared/types';
import { dueLabel } from '../../todos';
import { ASSIGNMENT_ROLE_LABEL, formatDate } from './labels';

interface PersonWorkProps {
  personId: number;
  workload: WorkloadData | undefined;
  today: ISODate;
  /** This person's open to-dos, so each assignment item can show the ones linked to it. */
  todos?: ToDoRecord[];
}

/** What this person is currently and about to be working on: every assignment that has not ended yet. */
export function PersonWork({ personId, workload, today, todos = [] }: PersonWorkProps) {
  const items = (workload?.assignments ?? [])
    .filter((a) => a.resourceId === personId && a.end >= today)
    .sort((a, b) => a.start.localeCompare(b.start) || a.projectName.localeCompare(b.projectName));

  return (
    <section className="card">
      <h2>Working on</h2>
      {items.length === 0 ? (
        <p className="muted item-empty">Nothing booked from today on.</p>
      ) : (
        <ul className="work-list">
          {items.map((a) => {
            const onThis = todos.filter((t) => !t.done && t.phase?.id === a.phaseId);
            return (
              <li key={a.id}>
                <Link to={`/manage/projects/${a.projectId}`}>{a.projectName}</Link> › {a.phaseName}
                {a.start <= today && today <= a.end ? <span className="badge">Now</span> : null}
                <span className="muted">
                  {formatDate(a.start)} – {formatDate(a.end)} · {a.allocation}% · {ASSIGNMENT_ROLE_LABEL[a.role]}
                </span>
                {onThis.length > 0 ? (
                  <ul className="work-todo-list">
                    {onThis.map((t) => {
                      const label = dueLabel(t, today);
                      return (
                        <li key={t.id} className="muted">
                          ☐ {t.title}
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
