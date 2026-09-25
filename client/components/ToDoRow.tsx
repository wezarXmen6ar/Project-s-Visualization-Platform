import { Link } from 'react-router';
import type { ISODate } from '../../shared/calendar';
import type { ToDoRecord } from '../../shared/types';
import { ToDoMetaLine } from './ToDoMetaLine';

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
        <ToDoMetaLine todo={todo} today={today} />
      </div>
    </li>
  );
}
