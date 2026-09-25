import { useState } from 'react';
import { Link } from 'react-router';
import type { MessageKey } from '../../../shared/i18n/en';
import type { ListName } from '../../../shared/types';
import { AlertIcon, ArrowLeftIcon } from '../../icons';
import { api } from '../../api';
import { messagesOf } from '../../errors';
import { useT } from '../../i18n/LanguageProvider';
import { useAsync } from '../../useAsync';
import { useResources } from '../../useResources';
import { BackupsCard } from './BackupsCard';
import { ListEditor } from './ListEditor';
import { MeSetting } from './MeSetting';
import { StarterEditor } from './StarterEditor';

const EDITORS: { list: ListName; title: MessageKey; singular: MessageKey }[] = [
  { list: 'mainProject', title: 'settings.mainProjects', singular: 'settings.mainProject' },
  { list: 'projectType', title: 'settings.projectTypes', singular: 'settings.projectType' },
  { list: 'goal', title: 'settings.goals', singular: 'settings.goal' },
  { list: 'department', title: 'settings.departments', singular: 'settings.department' },
  { list: 'phase', title: 'settings.phases', singular: 'settings.phase' },
  { list: 'role', title: 'settings.roles', singular: 'settings.role' },
];

export function SettingsPage() {
  const t = useT();
  const [version, setVersion] = useState(0);
  const lists = useAsync(() => api.getLists(), [version]);
  const reload = () => setVersion((v) => v + 1);
  const { people } = useResources();

  return (
    <main className="page">
      <div className="page-header">
        <div>
          <Link to="/manage" className="crumb"><ArrowLeftIcon />{t('nav.projects')}</Link>
          <h1>{t('nav.settings')}</h1>
          <p className="meta-line">{t('settings.intro')}</p>
        </div>
      </div>

      <MeSetting people={people} />

      {lists.data ? <StarterEditor phases={lists.data.phase} /> : null}

      {lists.error ? (
        <div className="errors" role="alert">
          <AlertIcon />
          <span>{messagesOf(lists.error, t)[0]}</span>
        </div>
      ) : null}
      {!lists.data && !lists.error ? <p className="muted">{t('common.loading')}</p> : null}

      {lists.data ? (
        <div className="settings-grid">
          {EDITORS.map((editor) => (
            <ListEditor
              key={editor.list}
              list={editor.list}
              title={t(editor.title)}
              singular={t(editor.singular)}
              values={lists.data![editor.list]}
              onChanged={reload}
            />
          ))}
        </div>
      ) : null}

      <BackupsCard />
    </main>
  );
}
