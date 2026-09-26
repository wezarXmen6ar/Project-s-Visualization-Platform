import { Fragment, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import type { ISODate } from '../../../shared/calendar';
import type { ListValue, ProjectRecord, ResourceRecord, ToDoRecord, WorkloadData } from '../../../shared/types';
import { AssignmentsEditor } from '../../components/AssignmentsEditor';
import { ToDoRow } from '../../components/ToDoRow';
import { AlertIcon } from '../../icons';
import { api } from '../../api';
import { messagesOf } from '../../errors';
import { useLang, useT } from '../../i18n/LanguageProvider';
import { companyName, phaseName } from '../../i18n/listNames';
import { dayDate, overloadsWith, phaseWarnings, plannedFrom, type DraftAssignment } from '../../overloads';
import { useLists } from '../../useLists';
import { byUrgency, subPhaseLabel, type PhaseNameFor } from '../../todos';
import { ASSIGNMENT_ROLE_KEY, SIDE_KEY } from './labels';
import { roleText } from './peopleTable';
import { buildTeamBlocks, type PersonTeamBlock } from './projectTeam';

interface PhasePeopleBlockProps {
  id: number;
  label: string;
  start: string;
  end: string;
  project: ProjectRecord;
  people: ResourceRecord[];
  roles: ListValue[];
  companies: ListValue[];
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
  id, label, start, end, project, people, roles, companies, workload, editing, draft, errors, saving, onStartEdit, onSave, onCancel,
  onChangeDraft,
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
          roles={roles}
          companies={companies}
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

interface TeamPersonBlockProps {
  block: PersonTeamBlock;
  today: ISODate;
  toggleDone: (t: ToDoRecord) => void;
  roles: ListValue[];
  companies: ListValue[];
  nameFor?: PhaseNameFor;
}

/** One person's block on the "By person" view: who they are, what they're working on, and their open to-dos. */
function TeamPersonBlock({ block, today, toggleDone, roles, companies, nameFor }: TeamPersonBlockProps) {
  const t = useT();
  const { lang } = useLang();
  const [showDone, setShowDone] = useState(false);
  const resource = block.resource;
  const roleLabel = resource ? roleText(resource, roles, lang) : null;

  const tags: string[] = [];
  if (block.isPm) tags.push(t('project.pmTag'));
  else if (block.isBusinessPm) tags.push(t('project.businessPmTag'));
  else if (resource?.side === 'business') tags.push(t(SIDE_KEY.business));
  if (resource?.employment === 'outsourced') {
    tags.push(t('project.outsourcedTag', { company: resource.company ? companyName(resource.company, companies, lang) : '' }));
  }

  const open = byUrgency(block.todos.filter((x) => !x.done));
  const done = block.todos.filter((x) => x.done);

  return (
    <div className="team-person-block">
      <div className="team-person-head">
        <Link to={`/manage/resources/${block.id}`} dir="auto" data-user-content="">{block.name}</Link>
        {roleLabel ? <span className="muted" dir="auto" data-user-content=""> · {roleLabel}</span> : null}
        {tags.length > 0 ? (
          <span className="team-tags">
            {tags.map((tag) => <span key={tag} className="team-tag">{tag}</span>)}
          </span>
        ) : null}
      </div>

      <h4>{t('project.personAssignmentsHeading')}</h4>
      {block.assignments.length === 0 ? (
        <p className="muted item-empty">{t('project.noAssignmentsOnProject')}</p>
      ) : (
        <ul className="team-assignments">
          {block.assignments.map((a) => (
            <li key={a.phaseId} className={a.finished ? 'muted' : undefined}>
              {t('project.personAssignmentLine', {
                phase: a.label,
                dates: `${dayDate(a.start, lang)} – ${dayDate(a.end, lang)}`,
                allocation: a.allocation,
              })}
            </li>
          ))}
        </ul>
      )}

      <h4>{t('project.personToDosHeading')}</h4>
      {open.length === 0 ? (
        <p className="muted item-empty">{t('project.noOpenToDos')}</p>
      ) : (
        <ul className="todo-list">
          {open.map((x) => <ToDoRow key={x.id} todo={x} today={today} onToggle={toggleDone} nameFor={nameFor} showAssignee={false} />)}
        </ul>
      )}
      {done.length > 0 ? (
        <button type="button" className="button secondary" onClick={() => setShowDone((v) => !v)}>
          {showDone ? t('todo.hideDone') : t('todo.showDone', { count: done.length })}
        </button>
      ) : null}
      {showDone && done.length > 0 ? (
        <ul className="todo-list">
          {done.map((x) => <ToDoRow key={x.id} todo={x} today={today} onToggle={toggleDone} nameFor={nameFor} showAssignee={false} />)}
        </ul>
      ) : null}
    </div>
  );
}

interface ProjectPeopleProps {
  project: ProjectRecord;
  people: ResourceRecord[];
  workload: WorkloadData | undefined;
  todos: ToDoRecord[];
  today: ISODate;
  toggleDone: (t: ToDoRecord) => void;
  /** Maps a top-level phase's stored name to its display name (e.g. its Arabic name). */
  nameFor?: PhaseNameFor;
  /** Called with the project as saved, so the page shows it and reloads the workload. */
  onSaved: (project: ProjectRecord) => void;
}

/**
 * The project's team tab: a "By person" view (default) showing what each person is working on and their open
 * to-dos, and a "By phase" view — the phase-by-phase editor, unchanged — kept in the URL as `?view=phase`.
 */
export function ProjectPeople({ project, people, workload, todos, today, toggleDone, nameFor, onSaved }: ProjectPeopleProps) {
  const t = useT();
  const { lang } = useLang();
  const { lists } = useLists();
  const [searchParams, setSearchParams] = useSearchParams();
  const view = searchParams.get('view') === 'phase' ? 'phase' : 'person';
  const [editing, setEditing] = useState<number | null>(null);
  const [draft, setDraft] = useState<DraftAssignment[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  function setView(next: 'person' | 'phase') {
    setSearchParams(
      (prev) => {
        const params = new URLSearchParams(prev);
        if (next === 'person') params.delete('view');
        else params.set('view', next);
        return params;
      },
      { replace: true },
    );
  }

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

  const blocks = buildTeamBlocks(project, people, todos, today, nameFor);

  return (
    <section className="card">
      <div className="phase-people-head">
        <h2>{t('project.teamHeading')}</h2>
        <div className="view-toggle" role="group" aria-label={t('project.teamHeading')}>
          <button
            type="button"
            className="button secondary"
            aria-pressed={view === 'person'}
            onClick={() => setView('person')}
          >
            {t('project.viewByPerson')}
          </button>
          <button
            type="button"
            className="button secondary"
            aria-pressed={view === 'phase'}
            onClick={() => setView('phase')}
          >
            {t('project.viewByPhase')}
          </button>
        </div>
      </div>

      {view === 'person' ? (
        blocks.length === 0 ? (
          <p className="muted item-empty">{t('project.noTeamYet')}</p>
        ) : (
          <div className="team-by-person">
            {blocks.map((block) => (
              <TeamPersonBlock
                key={block.id}
                block={block}
                today={today}
                toggleDone={toggleDone}
                roles={lists.role}
                companies={lists.company}
                nameFor={nameFor}
              />
            ))}
          </div>
        )
      ) : (
        <>
          {project.phases.map((phase) => (
            <Fragment key={phase.id}>
              <PhasePeopleBlock
                id={phase.id}
                label={phaseName(phase.name, lists, lang)}
                start={phase.start}
                end={phase.end}
                project={project}
                people={people}
                roles={lists.role}
                companies={lists.company}
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
                  roles={lists.role}
                  companies={lists.company}
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
        </>
      )}
    </section>
  );
}
