import { ItemTable } from '../../components/ItemTable';
import { useT } from '../../i18n/LanguageProvider';
import { SCOPE_TABLES } from './labels';
import type { DetailsDraft } from './projectDraft';

interface ScopeFieldsProps {
  value: DetailsDraft;
  onChange: (patch: Partial<DetailsDraft>) => void;
}

/** Wizard Step 2: background, summary and the four scope tables. Also used on the Edit details page. */
export function ScopeFields({ value, onChange }: ScopeFieldsProps) {
  const t = useT();
  return (
    <>
      <section className="card">
        <h2>{t('project.description')}</h2>
        <div className="form-stack">
          <label>
            {t('project.background')}
            <textarea
              rows={4}
              value={value.background}
              onChange={(e) => onChange({ background: e.target.value })}
              dir="auto"
              data-user-content=""
            />
          </label>
          <label>
            {t('project.summary')}
            <textarea
              rows={4}
              value={value.summary}
              onChange={(e) => onChange({ summary: e.target.value })}
              dir="auto"
              data-user-content=""
            />
          </label>
        </div>
      </section>

      <section className="card">
        <h2>{t('project.scopeAndGoals')}</h2>
        <div className="item-tables">
          {SCOPE_TABLES.map(({ kind, title, noun }) => (
            <ItemTable
              key={kind}
              title={t(title)}
              noun={t(noun)}
              items={value.scope[kind]}
              onChange={(items) => onChange({ scope: { ...value.scope, [kind]: items } })}
            />
          ))}
        </div>
      </section>
    </>
  );
}
