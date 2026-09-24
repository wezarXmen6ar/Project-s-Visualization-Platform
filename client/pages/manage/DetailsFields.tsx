import type { Category, ListValue, Lists, Priority } from '../../../shared/types';
import { OptionPicker } from '../../components/OptionPicker';
import { CATEGORY_LABEL, PRIORITY_LABEL } from './labels';
import type { DetailsDraft } from './projectDraft';

interface DetailsFieldsProps {
  value: DetailsDraft;
  onChange: (patch: Partial<DetailsDraft>) => void;
  lists: Lists;
  onListAdded: (value: ListValue) => void;
}

/** Wizard Step 1: basic info, people and classification. Also used on the Edit details page. */
export function DetailsFields({ value, onChange, lists, onListAdded }: DetailsFieldsProps) {
  return (
    <>
      <section className="card">
        <h2>Basic info</h2>
        <div className="form-grid">
          <label>
            Project name
            <input value={value.name} onChange={(e) => onChange({ name: e.target.value })} />
          </label>
          <label>
            Jira key
            <input value={value.jiraKey} onChange={(e) => onChange({ jiraKey: e.target.value })} placeholder="PRJ-123" />
          </label>
          <label>
            Priority
            <select value={value.priority} onChange={(e) => onChange({ priority: e.target.value as Priority })}>
              {Object.entries(PRIORITY_LABEL).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </label>
          <label>
            Colour
            <input type="color" value={value.color} onChange={(e) => onChange({ color: e.target.value })} />
          </label>
        </div>
      </section>

      <section className="card">
        <h2>People</h2>
        <div className="form-grid">
          <label>
            Project manager (tech)
            <input value={value.projectManager} onChange={(e) => onChange({ projectManager: e.target.value })} />
          </label>
          <label>
            Business project manager
            <input value={value.businessPmName} onChange={(e) => onChange({ businessPmName: e.target.value })} />
          </label>
          <label>
            Business PM phone (UAE mobile)
            <input
              type="tel"
              value={value.businessPmPhone}
              onChange={(e) => onChange({ businessPmPhone: e.target.value })}
              placeholder="+971 50 123 4567"
            />
          </label>
          <label>
            Business PM email
            <input
              type="email"
              value={value.businessPmEmail}
              onChange={(e) => onChange({ businessPmEmail: e.target.value })}
              placeholder="name@example.com"
            />
          </label>
        </div>
      </section>

      <section className="card">
        <h2>Classification</h2>
        <div className="form-grid">
          <OptionPicker
            label="Main project"
            list="mainProject"
            options={lists.mainProject}
            value={value.mainProjectId}
            onChange={(id) => onChange({ mainProjectId: id })}
            onAdded={onListAdded}
            noneLabel="Standalone (no main project)"
            addLabel="+ Add new main project…"
          />
          <label>
            Categorisation
            <select
              value={value.category ?? ''}
              onChange={(e) => onChange({ category: e.target.value === '' ? null : (e.target.value as Category) })}
            >
              <option value="">Not set</option>
              {Object.entries(CATEGORY_LABEL).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </label>
          <OptionPicker
            label="Project type"
            list="projectType"
            options={lists.projectType}
            value={value.projectTypeId}
            onChange={(id) => onChange({ projectTypeId: id })}
            onAdded={onListAdded}
            noneLabel="Not set"
            addLabel="Other…"
          />
          <OptionPicker
            label="Goal"
            list="goal"
            options={lists.goal}
            value={value.goalId}
            onChange={(id) => onChange({ goalId: id })}
            onAdded={onListAdded}
            noneLabel="Not set"
            addLabel="Other…"
          />
          <OptionPicker
            label="Business user (department)"
            list="department"
            options={lists.department}
            value={value.departmentId}
            onChange={(id) => onChange({ departmentId: id })}
            onAdded={onListAdded}
            noneLabel="Not set"
            addLabel="+ Add new department…"
          />
        </div>

        <div className="check-groups">
          <fieldset className="check-group">
            <legend>Requester</legend>
            <label className="check">
              <input
                type="checkbox"
                checked={value.requester.internal}
                onChange={(e) => onChange({ requester: { ...value.requester, internal: e.target.checked } })}
              />
              Internal
            </label>
            <label className="check">
              <input
                type="checkbox"
                checked={value.requester.external}
                onChange={(e) => onChange({ requester: { ...value.requester, external: e.target.checked } })}
              />
              External
            </label>
          </fieldset>
          <fieldset className="check-group">
            <legend>Beneficiary</legend>
            <label className="check">
              <input
                type="checkbox"
                checked={value.beneficiary.employees}
                onChange={(e) => onChange({ beneficiary: { ...value.beneficiary, employees: e.target.checked } })}
              />
              Employees
            </label>
            <label className="check">
              <input
                type="checkbox"
                checked={value.beneficiary.customers}
                onChange={(e) => onChange({ beneficiary: { ...value.beneficiary, customers: e.target.checked } })}
              />
              Customers
            </label>
          </fieldset>
        </div>
      </section>
    </>
  );
}
