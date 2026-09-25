import type { Category, ListValue, Lists, Priority, ResourceRecord } from '../../../shared/types';
import { OptionPicker } from '../../components/OptionPicker';
import { PersonPicker } from '../../components/PersonPicker';
import { useT } from '../../i18n/LanguageProvider';
import { CATEGORY_KEY, PRIORITY_KEY } from './labels';
import type { DetailsDraft } from './projectDraft';

interface DetailsFieldsProps {
  value: DetailsDraft;
  onChange: (patch: Partial<DetailsDraft>) => void;
  lists: Lists;
  onListAdded: (value: ListValue) => void;
  people: ResourceRecord[];
  onPersonAdded: (person: ResourceRecord) => void;
}

/** Wizard Step 1: basic info, people and classification. Also used on the Edit details page. */
export function DetailsFields({ value, onChange, lists, onListAdded, people, onPersonAdded }: DetailsFieldsProps) {
  const t = useT();
  return (
    <>
      <section className="card">
        <h2>{t('wizard.stepBasics')}</h2>
        <div className="form-grid">
          <label>
            {t('wizard.projectName')}
            <input value={value.name} onChange={(e) => onChange({ name: e.target.value })} dir="auto" data-user-content="" />
          </label>
          <label>
            {t('project.jiraKey')}
            <input value={value.jiraKey} onChange={(e) => onChange({ jiraKey: e.target.value })} placeholder="PRJ-123" dir="ltr" />
          </label>
          <label>
            {t('project.priority')}
            <select value={value.priority} onChange={(e) => onChange({ priority: e.target.value as Priority })}>
              {Object.entries(PRIORITY_KEY).map(([key, label]) => (
                <option key={key} value={key}>{t(label)}</option>
              ))}
            </select>
          </label>
          <label>
            {t('wizard.colour')}
            <input type="color" value={value.color} onChange={(e) => onChange({ color: e.target.value })} />
          </label>
        </div>
      </section>

      <section className="card">
        <h2>{t('project.people')}</h2>
        <div className="form-grid">
          <PersonPicker
            label={t('project.projectManager')}
            side="tech"
            people={people}
            value={value.projectManagerId}
            onChange={(id) => onChange({ projectManagerId: id })}
            onAdded={onPersonAdded}
            noneLabel={t('common.notSet')}
            newPersonRoleId={lists.role.find((r) => r.name === 'Project manager')?.id ?? null}
          />
          <PersonPicker
            label={t('project.businessPm')}
            side="business"
            people={people}
            value={value.businessPmId}
            onChange={(id) => onChange({ businessPmId: id })}
            onAdded={onPersonAdded}
            noneLabel={t('common.notSet')}
          />
        </div>
      </section>

      <section className="card">
        <h2>{t('wizard.classification')}</h2>
        <div className="form-grid">
          <OptionPicker
            label={t('project.mainProject')}
            list="mainProject"
            options={lists.mainProject}
            value={value.mainProjectId}
            onChange={(id) => onChange({ mainProjectId: id })}
            onAdded={onListAdded}
            noneLabel={t('wizard.standaloneNone')}
            addLabel={t('wizard.addMainProject')}
          />
          <label>
            {t('project.category')}
            <select
              value={value.category ?? ''}
              onChange={(e) => onChange({ category: e.target.value === '' ? null : (e.target.value as Category) })}
            >
              <option value="">{t('common.notSet')}</option>
              {Object.entries(CATEGORY_KEY).map(([key, label]) => (
                <option key={key} value={key}>{t(label)}</option>
              ))}
            </select>
          </label>
          <OptionPicker
            label={t('project.projectType')}
            list="projectType"
            options={lists.projectType}
            value={value.projectTypeId}
            onChange={(id) => onChange({ projectTypeId: id })}
            onAdded={onListAdded}
            noneLabel={t('common.notSet')}
            addLabel={t('common.other')}
          />
          <OptionPicker
            label={t('project.goal')}
            list="goal"
            options={lists.goal}
            value={value.goalId}
            onChange={(id) => onChange({ goalId: id })}
            onAdded={onListAdded}
            noneLabel={t('common.notSet')}
            addLabel={t('common.other')}
          />
          <OptionPicker
            label={t('project.department')}
            list="department"
            options={lists.department}
            value={value.departmentId}
            onChange={(id) => onChange({ departmentId: id })}
            onAdded={onListAdded}
            noneLabel={t('common.notSet')}
            addLabel={t('wizard.addDepartment')}
          />
        </div>

        <div className="check-groups">
          <fieldset className="check-group">
            <legend>{t('project.requester')}</legend>
            <label className="check">
              <input
                type="checkbox"
                checked={value.requester.internal}
                onChange={(e) => onChange({ requester: { ...value.requester, internal: e.target.checked } })}
              />
              {t('project.requesterInternal')}
            </label>
            <label className="check">
              <input
                type="checkbox"
                checked={value.requester.external}
                onChange={(e) => onChange({ requester: { ...value.requester, external: e.target.checked } })}
              />
              {t('project.requesterExternal')}
            </label>
          </fieldset>
          <fieldset className="check-group">
            <legend>{t('project.beneficiary')}</legend>
            <label className="check">
              <input
                type="checkbox"
                checked={value.beneficiary.employees}
                onChange={(e) => onChange({ beneficiary: { ...value.beneficiary, employees: e.target.checked } })}
              />
              {t('project.beneficiaryEmployees')}
            </label>
            <label className="check">
              <input
                type="checkbox"
                checked={value.beneficiary.customers}
                onChange={(e) => onChange({ beneficiary: { ...value.beneficiary, customers: e.target.checked } })}
              />
              {t('project.beneficiaryCustomers')}
            </label>
          </fieldset>
        </div>
      </section>
    </>
  );
}
