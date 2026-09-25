import type { ReactNode } from 'react';
import { Link } from 'react-router';
import type { ISODate } from '../../shared/calendar';
import type { ToDoRecord } from '../../shared/types';
import { useLang, useT } from '../i18n/LanguageProvider';
import { dueLabel, formerPhaseLabel, isOverdue, phaseRefLabel, type PhaseNameFor } from '../todos';

interface ToDoMetaLineProps {
  todo: ToDoRecord;
  today: ISODate;
  /** Shows the assignee's name (or "Unassigned") as the first part. Off where the list is already scoped to one assignee. */
  showAssignee?: boolean;
  /** Maps a top-level phase's stored name to its display name (e.g. its Arabic name). Sub-phase names never change. */
  nameFor?: PhaseNameFor;
}

/**
 * The muted meta line under a to-do's title: assignee (optional) · due label · phase, plus a second line for a
 * kept-from-a-removed-phase note. Shared by every place that lists to-dos read-only.
 */
export function ToDoMetaLine({ todo, today, showAssignee = true, nameFor }: ToDoMetaLineProps) {
  const t = useT();
  const { lang } = useLang();
  const label = dueLabel(todo, today, lang);
  const overdue = isOverdue(todo, today);
  const former = formerPhaseLabel(todo, lang, nameFor);

  const parts: { key: string; node: ReactNode }[] = [];
  if (showAssignee) {
    const assigneeNode = todo.assignee ? (
      <Link to={`/manage/resources/${todo.assignee.id}`} dir="auto" data-user-content="">{todo.assignee.name}</Link>
    ) : (
      t('todo.unassigned')
    );
    parts.push({ key: 'assignee', node: assigneeNode });
  }
  if (label) parts.push({ key: 'due', node: <span className={overdue ? 'overdue' : undefined}>{label}</span> });
  if (todo.phase) parts.push({ key: 'phase', node: phaseRefLabel(todo.phase, nameFor) });

  return (
    <>
      <div className="todo-meta">
        {parts.map((p, i) => (
          <span key={p.key}>
            {i > 0 ? ' · ' : ''}
            {p.node}
          </span>
        ))}
      </div>
      {former ? <div className="todo-meta">{former}</div> : null}
    </>
  );
}
