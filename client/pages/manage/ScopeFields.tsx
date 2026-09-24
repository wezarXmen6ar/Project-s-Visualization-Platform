import { ItemTable } from '../../components/ItemTable';
import { SCOPE_TABLES } from './labels';
import type { DetailsDraft } from './projectDraft';

interface ScopeFieldsProps {
  value: DetailsDraft;
  onChange: (patch: Partial<DetailsDraft>) => void;
}

/** Wizard Step 2: background, summary and the four scope tables. Also used on the Edit details page. */
export function ScopeFields({ value, onChange }: ScopeFieldsProps) {
  return (
    <>
      <section className="card">
        <h2>Description</h2>
        <div className="form-stack">
          <label>
            Background
            <textarea rows={4} value={value.background} onChange={(e) => onChange({ background: e.target.value })} />
          </label>
          <label>
            Summary
            <textarea rows={4} value={value.summary} onChange={(e) => onChange({ summary: e.target.value })} />
          </label>
        </div>
      </section>

      <section className="card">
        <h2>Scope and goals</h2>
        <div className="item-tables">
          {SCOPE_TABLES.map(({ kind, title, noun }) => (
            <ItemTable
              key={kind}
              title={title}
              noun={noun}
              items={value.scope[kind]}
              onChange={(items) => onChange({ scope: { ...value.scope, [kind]: items } })}
            />
          ))}
        </div>
      </section>
    </>
  );
}
