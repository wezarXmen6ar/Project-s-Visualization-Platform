import type { ISODate } from '../../../shared/calendar';
import type { PhaseNameParts, ProjectRecord, Ref, ResourceRecord, ToDoRecord } from '../../../shared/types';
import { phaseRefLabel, type PhaseNameFor } from '../../todos';

/** One of this person's assignments on this project: a phase or sub-phase, with its dates and allocation. */
export interface PersonAssignmentView {
  phaseId: number;
  /** "Phase" or "Phase › Sub-phase", translated through `nameFor`. */
  label: string;
  start: ISODate;
  end: ISODate;
  allocation: number;
  /** True once the phase or sub-phase has ended, so the caller can mute it. */
  finished: boolean;
}

/** Everyone shown on the "By person" view: the two PMs, everyone assigned to a phase, and anyone with a to-do here. */
export interface PersonTeamBlock {
  id: number;
  name: string;
  /** The matching Resources record, when this person is still in Resources (should always be the case). */
  resource: ResourceRecord | null;
  isPm: boolean;
  isBusinessPm: boolean;
  assignments: PersonAssignmentView[];
  todos: ToDoRecord[];
}

const identity: PhaseNameFor = (name) => name;

/** Finds the phase or sub-phase `phaseId` refers to, with its own dates and its structured name parts. */
function phaseRef(project: ProjectRecord, phaseId: number): (PhaseNameParts & { start: ISODate; end: ISODate }) | null {
  for (const phase of project.phases) {
    if (phase.id === phaseId) return { phaseName: phase.name, subPhaseName: null, start: phase.start, end: phase.end };
    for (const sub of phase.subPhases) {
      if (sub.id === phaseId) return { phaseName: phase.name, subPhaseName: sub.name, start: sub.start, end: sub.end };
    }
  }
  return null;
}

/** This person's assignments on `project`, current/upcoming first, each finished ones after, ties by start date. */
export function personAssignments(
  project: ProjectRecord, personId: number, today: ISODate, nameFor: PhaseNameFor = identity,
): PersonAssignmentView[] {
  const list: PersonAssignmentView[] = [];
  for (const a of project.assignments) {
    if (a.resource.id !== personId) continue;
    const ref = phaseRef(project, a.phaseId);
    if (!ref) continue;
    list.push({
      phaseId: a.phaseId,
      label: phaseRefLabel(ref, nameFor),
      start: ref.start,
      end: ref.end,
      allocation: a.allocation,
      finished: ref.end < today,
    });
  }
  return list.sort((x, y) => {
    if (x.finished !== y.finished) return x.finished ? 1 : -1;
    if (x.start !== y.start) return x.start < y.start ? -1 : 1;
    return x.phaseId - y.phaseId;
  });
}

/**
 * Every person involved in this project — the tech and business PMs, everyone assigned to a phase or sub-phase, and
 * anyone with an open or done to-do here — each with their assignments and to-dos, sorted PMs first then by name.
 */
export function buildTeamBlocks(
  project: ProjectRecord, people: ResourceRecord[], todos: ToDoRecord[], today: ISODate, nameFor: PhaseNameFor = identity,
): PersonTeamBlock[] {
  const byId = new Map(people.map((p) => [p.id, p]));
  const nameById = new Map<number, string>();
  const rememberRef = (ref: Ref | null) => {
    if (ref) nameById.set(ref.id, ref.name);
  };
  rememberRef(project.projectManager);
  rememberRef(project.businessPm);
  for (const a of project.assignments) rememberRef(a.resource);
  for (const t of todos) rememberRef(t.assignee);

  const blocks: PersonTeamBlock[] = [...nameById.keys()].map((id) => ({
    id,
    name: byId.get(id)?.name ?? nameById.get(id) ?? '',
    resource: byId.get(id) ?? null,
    isPm: project.projectManager?.id === id,
    isBusinessPm: project.businessPm?.id === id,
    assignments: personAssignments(project, id, today, nameFor),
    todos: todos.filter((t) => t.assignee?.id === id),
  }));

  return blocks.sort((a, b) => {
    const aPm = a.isPm || a.isBusinessPm;
    const bPm = b.isPm || b.isBusinessPm;
    if (aPm !== bPm) return aPm ? -1 : 1;
    if (a.isPm !== b.isPm) return a.isPm ? -1 : 1;
    return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
  });
}
