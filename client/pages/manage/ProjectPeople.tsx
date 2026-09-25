import { Fragment, useState } from 'react';
import type { ProjectRecord, ResourceRecord, WorkloadData } from '../../../shared/types';
import { AssignmentsEditor } from '../../components/AssignmentsEditor';
import { AlertIcon } from '../../icons';
import { api } from '../../api';
import { messagesOf } from '../../errors';
import { useLang, useT } from '../../i18n/LanguageProvider';
import { phaseName } from '../../i18n/listNames';
import { dayDate, overloadsWith, phaseWarnings, plannedFrom, type DraftAssignment } from '../../overloads';
import { useLists } from '../../useLists';
import { subPhaseLabel } from '../../todos';
import { ASSIGNMENT_ROLE_KEY } from './labels';

interface PhasePeopleBlockProps {
  id: number;
  label: string;
  start: string;
  end: string;
  project: ProjectRecord;
  people: ResourceRecord[];
  workload: WorkloadData | undefined;
  editing: number | null;
  draft: DraftAssignment[];
  errors: string[];
  saving: boolean;
  onStartEdit: (id: number) => void;
  onSave: (id: number) => void;
  onCancel: () => void;
  onChangeDraft: (value: DraftAssignment[]) => void;
}

/** The people on one phase or sub-phase, editable on its own, with overbooking flagged before saving. */
function PhasePeopleBlock({
  id, label, start, end, project, people, workload, editing, draft, errors, saving, onStartEdit, onSave, onCancel, onChangeDraft,
}: PhasePeopleBlockProps) {
  const t = useT();
  const { lang } = useLang();
  const saved = project.assignments.filter((a) => a.phaseId === id);
  const dates = `${dayDate(start, lang)} – ${dayDate(end, lang)}`;

  if (editing === id) {
    const planned = plannedFrom(draft, { start, end }, project.name, label);
    const warnings = workload
      ? phaseWarnings(overloadsWith(workload, planned, saved.map((a) => a.id)), { start, end }, workload.calendar, lang)
      : new Map<number, string[]>();
    return (
      <div className="phase-people-edit">
        {errors.length > 0 ? (
          <div className="errors" role="alert">
            <AlertIcon />
            <ul>{errors.map((m) => <li key={m}>{m}</li>)}</ul>
          </div>
        ) : null}
        <AssignmentsEditor
          phaseName={label}
          dates={dates}
          people={people}
          value={draft}
          onChange={onChangeDraft}
          warnings={warnings}
        />
        <div className="option-add-actions">
          <button
            type="button"
            className="button"
            disabled={saving}
            aria-label={t('project.savePeopleOn', { phase: label })}
            onClick={() => onSave(id)}
          >
            {t('common.save')}
          </button>
          <button type="button" className="button secondary" onClick={onCancel}>{t('common.cancel')}</button>
        </div>
      </div>
    );
  }

  return (
    <div className="phase-people">
      <div className="phase-people-head">
        <h3>
          {label} <span className="muted phase-dates">{dates}</span>
        </h3>
        <button
          type="button"
          className="button secondary"
          aria-label={t('project.editPeopleOn', { phase: label })}
          disabled={editing !== null}
          onClick={() => onStartEdit(id)}
        >
          {t('common.edit')}
        </button>
      </div>
      {saved.length === 0 ? (
        <p className="muted item-empty">{t('project.noOneAssigned')}</p>
      ) : (
        <ul className="people-list">
          {saved.map((a) => (
            <li key={a.id}>
              <span dir="auto" data-user-content="">{a.resource.name}</span>
              {` — ${t('project.allocationRole', { allocation: a.allocation, role: t(ASSIGNMENT_ROLE_KEY[a.role]) })}`}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

interface ProjectPeopleProps {
  project: ProjectRecord;
  people: ResourceRecord[];
  workload: WorkloadData | undefined;
  /** Called with the project as saved, so the page shows it and reloads the workload. */
  onSaved: (project: ProjectRecord) => void;
}

/** The people on each phase and sub-phase, editable one at a time, with overbooking flagged before saving. */
export function ProjectPeople({ project, people, workload, onSaved }: ProjectPeopleProps) {
  const t = useT();
  const { lang } = useLang();
  const { lists } = useLists();
  const [editing, setEditing] = useState<number | null>(null);
  const [draft, setDraft] = useState<DraftAssignment[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  function startEdit(id: number) {
    setEditing(id);
    setErrors([]);
    setDraft(
      project.assignments
        .filter((a) => a.phaseId === id)
        .map((a) => ({ resourceId: a.resource.id, allocation: a.allocation, role: a.role })),
    );
  }

  async function save(id: number) {
    setSaving(true);
    setErrors([]);
    try {
      const updated = await api.setPhaseAssignments(
        id,
        draft.map((a) => ({ resourceId: a.resourceId ?? 0, allocation: a.allocation, role: a.role })),
      );
      setEditing(null);
      onSaved(updated);
    } catch (err) {
      setErrors(messagesOf(err, t));
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="card">
      <h2>{t('project.people')}</h2>
      {project.phases.map((phase) => (
        <Fragment key={phase.id}>
          <PhasePeopleBlock
            id={phase.id}
            label={phaseName(phase.name, lists, lang)}
            start={phase.start}
            end={phase.end}
            project={project}
            people={people}
            workload={workload}
            editing={editing}
            draft={draft}
            errors={errors}
            saving={saving}
            onStartEdit={startEdit}
            onSave={(id) => void save(id)}
            onCancel={() => setEditing(null)}
            onChangeDraft={setDraft}
          />
          {phase.subPhases.map((sub) => (
            <PhasePeopleBlock
              key={sub.id}
              id={sub.id}
              label={subPhaseLabel(phaseName(phase.name, lists, lang), sub.name)}
              start={sub.start}
              end={sub.end}
              project={project}
              people={people}
              workload={workload}
              editing={editing}
              draft={draft}
              errors={errors}
              saving={saving}
              onStartEdit={startEdit}
              onSave={(id) => void save(id)}
              onCancel={() => setEditing(null)}
              onChangeDraft={setDraft}
            />
          ))}
        </Fragment>
      ))}
    </section>
  );
}
