import { useState } from 'react';
import type { ProjectRecord, ResourceRecord, WorkloadData } from '../../../shared/types';
import { AssignmentsEditor } from '../../components/AssignmentsEditor';
import { AlertIcon } from '../../icons';
import { api } from '../../api';
import { messagesOf } from '../../errors';
import { dayDate, overloadsWith, phaseWarnings, plannedFrom, type DraftAssignment } from '../../overloads';
import { ASSIGNMENT_ROLE_LABEL } from './labels';

interface ProjectPeopleProps {
  project: ProjectRecord;
  people: ResourceRecord[];
  workload: WorkloadData | undefined;
  /** Called with the project as saved, so the page shows it and reloads the workload. */
  onSaved: (project: ProjectRecord) => void;
}

/** The people on each phase, editable one phase at a time, with overbooking flagged before saving. */
export function ProjectPeople({ project, people, workload, onSaved }: ProjectPeopleProps) {
  const [editing, setEditing] = useState<number | null>(null);
  const [draft, setDraft] = useState<DraftAssignment[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  function startEdit(phaseId: number) {
    setEditing(phaseId);
    setErrors([]);
    setDraft(
      project.assignments
        .filter((a) => a.phaseId === phaseId)
        .map((a) => ({ resourceId: a.resource.id, allocation: a.allocation, role: a.role })),
    );
  }

  async function save(phaseId: number) {
    setSaving(true);
    setErrors([]);
    try {
      const updated = await api.setPhaseAssignments(
        phaseId,
        draft.map((a) => ({ resourceId: a.resourceId ?? 0, allocation: a.allocation, role: a.role })),
      );
      setEditing(null);
      onSaved(updated);
    } catch (err) {
      setErrors(messagesOf(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="card">
      <h2>People</h2>
      {project.phases.map((phase) => {
        const saved = project.assignments.filter((a) => a.phaseId === phase.id);
        const dates = `${dayDate(phase.start)} – ${dayDate(phase.end)}`;

        if (editing === phase.id) {
          const planned = plannedFrom(draft, phase, project.name, phase.name);
          const warnings = workload
            ? phaseWarnings(overloadsWith(workload, planned, saved.map((a) => a.id)), phase, workload.calendar)
            : new Map<number, string[]>();
          return (
            <div key={phase.id} className="phase-people-edit">
              {errors.length > 0 ? (
                <div className="errors" role="alert">
                  <AlertIcon />
                  <ul>{errors.map((m) => <li key={m}>{m}</li>)}</ul>
                </div>
              ) : null}
              <AssignmentsEditor
                phaseName={phase.name}
                dates={dates}
                people={people}
                value={draft}
                onChange={setDraft}
                warnings={warnings}
              />
              <div className="option-add-actions">
                <button
                  type="button"
                  className="button"
                  disabled={saving}
                  aria-label={`Save people on ${phase.name}`}
                  onClick={() => void save(phase.id)}
                >
                  Save
                </button>
                <button type="button" className="button secondary" onClick={() => setEditing(null)}>Cancel</button>
              </div>
            </div>
          );
        }

        return (
          <div key={phase.id} className="phase-people">
            <div className="phase-people-head">
              <h3>
                {phase.name} <span className="muted phase-dates">{dates}</span>
              </h3>
              <button
                type="button"
                className="button secondary"
                aria-label={`Edit people on ${phase.name}`}
                disabled={editing !== null}
                onClick={() => startEdit(phase.id)}
              >
                Edit
              </button>
            </div>
            {saved.length === 0 ? (
              <p className="muted item-empty">No one assigned.</p>
            ) : (
              <ul className="people-list">
                {saved.map((a) => (
                  <li key={a.id}>
                    <span>{a.resource.name}</span> — {a.allocation}% · {ASSIGNMENT_ROLE_LABEL[a.role]}
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })}
    </section>
  );
}
