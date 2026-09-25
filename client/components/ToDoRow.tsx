import type { ReactNode } from 'react';
import { Link } from 'react-router';
import type { ISODate } from '../../shared/calendar';
import type { ToDoRecord } from '../../shared/types';
import { dueLabel, formerPhaseLabel } from '../todos';

interface ToDoRowProps {
  todo: ToDoRecord;
  today: ISODate;
  /** Shows the project name as a link, for lists that span several projects. */
  showProject?: boolean;
  onToggle: (t: ToDoRecord) => void;
}

/**
 * A single read-only to-do: the checkbox, the title, the project link (when `showProject`), and the muted line
 * (assignee, due label, phase). Shared by the To-dos page, My next steps and a person's To-dos card.
 */
export function ToDoRow({ todo, today, showProject, onToggle }: ToDoRowProps) {
  const label = dueLabel(todo, today);
  const overdue = label.startsWith('Overdue');
  const former = formerPhaseLabel(todo);

  const metaParts: { key: string; node: ReactNode }[] = [
    { key: 'assignee', node: todo.assignee?.name ?? 'Unassigned' },
  ];
  if (label) metaParts.push({ key: 'due', node: <span className={overdue ? 'overdue' : undefined}>{label}</span> });
  if (todo.phase) metaParts.push({ key: 'phase', node: todo.phase.name });

  return (
    <li className={`todo${todo.done ? ' done' : ''}`}>
      <input type="checkbox" aria-label={`Done: ${todo.title}`} checked={todo.done} onChange={() => onToggle(todo)} />
      <div>
        <div className="todo-title">{todo.title}</div>
        {showProject ? (
          <div className="todo-meta">
            <Link to={`/manage/projects/${todo.projectId}`}>{todo.projectName}</Link>
          </div>
        ) : null}
        <div className="todo-meta">
          {metaParts.map((p, i) => (
            <span key={p.key}>
              {i > 0 ? ' · ' : ''}
              {p.node}
            </span>
          ))}
        </div>
        {former ? <div className="todo-meta">{former}</div> : null}
      </div>
    </li>
  );
}
