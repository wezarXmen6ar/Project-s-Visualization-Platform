import type { AssignmentRole, ListValue, ResourceRecord } from '../../shared/types';
import { PlusIcon, TrashIcon } from '../icons';
import { useLang, useT } from '../i18n/LanguageProvider';
import { companyName, roleName } from '../i18n/listNames';
import type { DraftAssignment } from '../overloads';

interface AssignmentsEditorProps {
  phaseName: string;
  /** Shown next to the phase name, e.g. "5 Oct – 16 Oct". */
  dates: string;
  /** Everyone in Resources; the editor offers active tech-team people plus whoever is already chosen. */
  people: ResourceRecord[];
  value: DraftAssignment[];
  onChange: (value: DraftAssignment[]) => void;
  /** Overbooking warning lines per person, for this phase. */
  warnings: Map<number, string[]>;
  /** The Roles list, for each person's role name in Arabic. */
  roles?: ListValue[];
  /** The Companies list, for an outsourced person's company name in Arabic. */
  companies?: ListValue[];
}

/** The people on one phase: who, how much of their week, and whether they are responsible or contributing. */
export function AssignmentsEditor({
  phaseName, dates, people, value, onChange, warnings, roles = [], companies = [],
}: AssignmentsEditorProps) {
  const t = useT();
  const { lang } = useLang();
  /** "Fatima Noor · Developer" for staff, with "(inactive)" after someone no longer active; "Omar Farid · TechNova"
   * for an outsourced person, showing their company instead of a role. */
  const personLabel = (p: ResourceRecord) => {
    if (p.employment === 'outsourced') return p.company ? `${p.name} · ${companyName(p.company, companies, lang)}` : p.name;
    const who = p.role ? `${p.name} · ${roleName(p.role, roles, lang)}` : p.name;
    return p.active ? who : t('common.inactive', { name: who });
  };
  const update = (index: number, patch: Partial<DraftAssignment>) =>
    onChange(value.map((a, i) => (i === index ? { ...a, ...patch } : a)));

  return (
    <div className="phase-people">
      <h3>
        {phaseName} <span className="muted phase-dates">{dates}</span>
      </h3>
      {value.length === 0 ? <p className="muted item-empty">{t('project.noOneAssigned')}</p> : null}
      {value.map((a, i) => {
        const chosenElsewhere = new Set(
          value.filter((_, j) => j !== i).map((other) => other.resourceId).filter((id): id is number => id !== null),
        );
        const tech = people.filter((p) => p.side === 'tech' && !chosenElsewhere.has(p.id));
        const staffOptions = tech
          .filter((p) => p.employment === 'staff' && (p.active || p.id === a.resourceId))
          .sort((x, y) => x.name.localeCompare(y.name));
        // Outsourced people are offered only while engaged; once past they stay only if already on this row.
        const outsourcedOptions = tech
          .filter((p) => p.employment === 'outsourced' && (p.engaged || p.id === a.resourceId))
          .sort((x, y) => x.name.localeCompare(y.name));
        const lines = a.resourceId === null ? [] : warnings.get(a.resourceId) ?? [];
        return (
          <div className="assignment" key={i}>
            <div className="assignment-row">
              <select
                aria-label={t('assign.person', { phase: phaseName, number: i + 1 })}
                value={a.resourceId === null ? '' : String(a.resourceId)}
                onChange={(e) => update(i, { resourceId: e.target.value === '' ? null : Number(e.target.value) })}
              >
                <option value="">{t('common.choosePerson')}</option>
                {staffOptions.map((p) => (
                  <option key={p.id} value={String(p.id)}>
                    {personLabel(p)}
                  </option>
                ))}
                {outsourcedOptions.length > 0 ? (
                  <optgroup label={t('assign.outsourcedGroup')}>
                    {outsourcedOptions.map((p) => (
                      <option key={p.id} value={String(p.id)}>
                        {personLabel(p)}
                      </option>
                    ))}
                  </optgroup>
                ) : null}
              </select>
              <span className="inline-number">
                <input
                  aria-label={t('assign.allocation', { phase: phaseName, number: i + 1 })}
                  type="number"
                  min={1}
                  max={100}
                  value={Number.isNaN(a.allocation) ? '' : a.allocation}
                  onChange={(e) => update(i, { allocation: e.target.valueAsNumber })}
                />
                <span aria-hidden="true">%</span>
              </span>
              <select
                aria-label={t('assign.role', { phase: phaseName, number: i + 1 })}
                value={a.role}
                onChange={(e) => update(i, { role: e.target.value as AssignmentRole })}
              >
                <option value="responsible">{t('project.roleResponsible')}</option>
                <option value="contributor">{t('project.roleContributor')}</option>
              </select>
              <button
                type="button"
                className="button ghost-icon"
                aria-label={t('assign.remove', { phase: phaseName, number: i + 1 })}
                onClick={() => onChange(value.filter((_, j) => j !== i))}
              >
                <TrashIcon />
              </button>
            </div>
            {lines.length > 0 ? (
              <ul className="warning-lines">
                {lines.map((line) => <li key={line}>{line}</li>)}
              </ul>
            ) : null}
          </div>
        );
      })}
      <button
        type="button"
        className="button secondary"
        onClick={() => onChange([...value, { resourceId: null, allocation: 100, role: value.length === 0 ? 'responsible' : 'contributor' }])}
      >
        <PlusIcon />{t('assign.addTo', { phase: phaseName })}
      </button>
    </div>
  );
}
