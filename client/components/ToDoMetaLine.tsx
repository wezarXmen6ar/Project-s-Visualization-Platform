import type { ReactNode } from 'react';
import type { ISODate } from '../../shared/calendar';
import type { ToDoRecord } from '../../shared/types';
import { dueLabel, formerPhaseLabel } from '../todos';

interface ToDoMetaLineProps {
  todo: ToDoRecord;
  today: ISODate;
  /** Shows the assignee's name (or "Unassigned") as the first part. Off where the list is already scoped to one assignee. */
  showAssignee?: boolean;
}

/**
 * The muted meta line under a to-do's title: assignee (optional) · due label · phase, plus a second line for a
 * kept-from-a-removed-phase note. Shared by every place that lists to-dos read-only.
 */
export function ToDoMetaLine({ todo, today, showAssignee = true }: ToDoMetaLineProps) {
  const label = dueLabel(todo, today);
  const overdue = label.startsWith('Overdue');
  const former = formerPhaseLabel(todo);

  const parts: { key: string; node: ReactNode }[] = [];
  if (showAssignee) parts.push({ key: 'assignee', node: todo.assignee?.name ?? 'Unassigned' });
  if (label) parts.push({ key: 'due', node: <span className={overdue ? 'overdue' : undefined}>{label}</span> });
  if (todo.phase) parts.push({ key: 'phase', node: todo.phase.name });

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
