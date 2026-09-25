import { Link } from 'react-router';
import type { ISODate } from '../../shared/calendar';
import type { ToDoRecord } from '../../shared/types';
import { useT } from '../i18n/LanguageProvider';
import type { PhaseNameFor } from '../todos';
import { ToDoMetaLine } from './ToDoMetaLine';

interface ToDoRowProps {
  todo: ToDoRecord;
  today: ISODate;
  /** Shows the project name as a link, for lists that span several projects. */
  showProject?: boolean;
  onToggle: (t: ToDoRecord) => void;
  /** Maps a top-level phase's stored name to its display name (e.g. its Arabic name). */
  nameFor?: PhaseNameFor;
}

/**
 * A single read-only to-do: the checkbox, the title, the project link (when `showProject`), and the muted line
 * (assignee, due label, phase). Shared by the To-dos page, My next steps and a person's To-dos card.
 */
export function ToDoRow({ todo, today, showProject, onToggle, nameFor }: ToDoRowProps) {
  const t = useT();
  return (
    <li className={`todo${todo.done ? ' done' : ''}`}>
      <input type="checkbox" aria-label={t('todo.doneAria', { title: todo.title })} checked={todo.done} onChange={() => onToggle(todo)} />
      <div>
        <div className="todo-title" dir="auto" data-user-content="">{todo.title}</div>
        {showProject ? (
          <div className="todo-meta">
            <Link to={`/manage/projects/${todo.projectId}`} dir="auto" data-user-content="">{todo.projectName}</Link>
          </div>
        ) : null}
        <ToDoMetaLine todo={todo} today={today} nameFor={nameFor} />
      </div>
    </li>
  );
}
