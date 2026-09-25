import { useState } from 'react';
import { Link } from 'react-router';
import type { ListName } from '../../../shared/types';
import { AlertIcon, ArrowLeftIcon } from '../../icons';
import { api } from '../../api';
import { useAsync } from '../../useAsync';
import { ListEditor } from './ListEditor';

const EDITORS: { list: ListName; title: string; singular: string }[] = [
  { list: 'mainProject', title: 'Main projects', singular: 'Main project' },
  { list: 'projectType', title: 'Project types', singular: 'Project type' },
  { list: 'goal', title: 'Goals', singular: 'Goal' },
  { list: 'department', title: 'Business users (departments)', singular: 'Department' },
  { list: 'phase', title: 'Phases', singular: 'Phase' },
  { list: 'role', title: 'Roles', singular: 'Role' },
];

export function SettingsPage() {
  const [version, setVersion] = useState(0);
  const lists = useAsync(() => api.getLists(), [version]);
  const reload = () => setVersion((v) => v + 1);

  return (
    <main className="page">
      <div className="page-header">
        <div>
          <Link to="/manage" className="crumb"><ArrowLeftIcon />Projects</Link>
          <h1>Settings</h1>
          <p className="meta-line">The lists behind the project dropdowns. A value that a project uses can be renamed but not deleted.</p>
        </div>
      </div>

      {lists.error ? (
        <div className="errors" role="alert">
          <AlertIcon />
          <span>{lists.error.message}</span>
        </div>
      ) : null}
      {!lists.data && !lists.error ? <p className="muted">Loading…</p> : null}

      {lists.data ? (
        <div className="settings-grid">
          {EDITORS.map((editor) => (
            <ListEditor key={editor.list} {...editor} values={lists.data![editor.list]} onChanged={reload} />
          ))}
        </div>
      ) : null}
    </main>
  );
}
