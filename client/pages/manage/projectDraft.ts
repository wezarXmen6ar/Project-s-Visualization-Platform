import type { ProjectDetailsInput, ScheduleUpdateInput, ValidationIssue } from '../../../shared/schemas';
import { subPhaseSpan, type PhaseInput } from '../../../shared/scheduler';
import { SCOPE_KINDS, type Category, type Priority, type ProjectRecord, type ScopeKind, type ToDoRecord } from '../../../shared/types';
import type { DraftItem } from '../../components/ItemTable';
import type { DraftAssignment } from '../../overloads';

/** The project details as the form holds them: text fields are plain strings, and each scope table is its own list. */
export interface DetailsDraft {
  name: string;
  jiraKey: string;
  color: string;
  priority: Priority;
  projectManagerId: number | null;
  businessPmId: number | null;
  mainProjectId: number | null;
  category: Category | null;
  projectTypeId: number | null;
  goalId: number | null;
  departmentId: number | null;
  requester: { internal: boolean; external: boolean };
  beneficiary: { employees: boolean; customers: boolean };
  background: string;
  summary: string;
  scope: Record<ScopeKind, DraftItem[]>;
}

function emptyScope(): Record<ScopeKind, DraftItem[]> {
  return { scope: [], 'out-of-scope': [], problem: [], objective: [] };
}

export function emptyDetails(): DetailsDraft {
  return {
    name: '',
    jiraKey: '',
    color: '#3b82f6',
    priority: 'medium',
    projectManagerId: null,
    businessPmId: null,
    mainProjectId: null,
    category: null,
    projectTypeId: null,
    goalId: null,
    departmentId: null,
    requester: { internal: false, external: false },
    beneficiary: { employees: false, customers: false },
    background: '',
    summary: '',
    scope: emptyScope(),
  };
}

export function detailsFromProject(p: ProjectRecord): DetailsDraft {
  const scope = emptyScope();
  for (const item of [...p.scopeItems].sort((a, b) => a.order - b.order)) {
    scope[item.kind].push({ id: item.id, text: item.text });
  }
  return {
    name: p.name,
    jiraKey: p.jiraKey ?? '',
    color: p.color,
    priority: p.priority,
    projectManagerId: p.projectManager?.id ?? null,
    businessPmId: p.businessPm?.id ?? null,
    mainProjectId: p.mainProject?.id ?? null,
    category: p.category,
    projectTypeId: p.projectType?.id ?? null,
    goalId: p.goal?.id ?? null,
    departmentId: p.department?.id ?? null,
    requester: { ...p.requester },
    beneficiary: { ...p.beneficiary },
    background: p.background,
    summary: p.summary,
    scope,
  };
}

export function detailsToInput(d: DetailsDraft): ProjectDetailsInput {
  const { scope, ...fields } = d;
  return {
    ...fields,
    scopeItems: SCOPE_KINDS.flatMap((kind) => scope[kind].map((item) => ({ ...item, kind }))),
  };
}

/** A wizard sub-phase: its name, working days, whether it starts with the one above and, from Step 4, its people. */
export interface SubPhaseDraft {
  id?: number;
  name: string;
  durationDays: number;
  withPrevious: boolean;
  assignments?: DraftAssignment[];
}

/** A wizard phase: its name, working days, sub-phases and, from Step 4, the people on it. */
export interface PhaseDraft extends PhaseInput {
  id?: number;
  assignments?: DraftAssignment[];
  subPhases?: SubPhaseDraft[];
}

/**
 * The working days to send for a phase. With sub-phases it is their span (an invalid sub-phase counts as 0 days, and
 * the result is at least 1), so a hidden, stale value on the phase itself can never block saving.
 */
function phaseDays(own: number, subPhases: { durationDays: number; withPrevious: boolean }[]): number {
  if (subPhases.length === 0) return own;
  const valid = subPhases.map((s) => ({
    name: '',
    durationDays: Number.isInteger(s.durationDays) && s.durationDays >= 1 ? s.durationDays : 0,
    withPrevious: s.withPrevious,
  }));
  return Math.max(1, subPhaseSpan(valid));
}

/** Phases as the API takes them. A row with no person yet is sent as 0 so the server answers "Choose a person". */
export function phasesToInput(phases: PhaseDraft[]) {
  const people = (list: DraftAssignment[] = []) =>
    list.map((a) => ({ resourceId: a.resourceId ?? 0, allocation: a.allocation, role: a.role }));
  return phases.map(({ name, durationDays, assignments, subPhases = [] }) => ({
    name,
    durationDays: phaseDays(durationDays, subPhases),
    assignments: people(assignments),
    subPhases: subPhases.map((s) => ({ name: s.name, durationDays: s.durationDays, withPrevious: s.withPrevious, assignments: people(s.assignments) })),
  }));
}

/** Loads a saved project's schedule into the wizard/editor form, keeping every phase's and sub-phase's id. */
export function scheduleFromProject(p: ProjectRecord): { startDate: string; phases: PhaseDraft[] } {
  return {
    startDate: p.startDate,
    phases: p.phases.map((ph) => ({
      id: ph.id,
      name: ph.name,
      durationDays: ph.durationDays,
      subPhases: ph.subPhases.map((s) => ({ id: s.id, name: s.name, durationDays: s.durationDays, withPrevious: s.withPrevious })),
    })),
  };
}

/** The schedule as PUT /api/projects/:id/schedule takes it: ids kept where they exist, no assignments. */
export function scheduleToInput(startDate: string, phases: PhaseDraft[]): ScheduleUpdateInput {
  return {
    startDate,
    phases: phases.map((p) => {
      const subPhases = (p.subPhases ?? []).map((s) => ({
        ...(s.id !== undefined ? { id: s.id } : {}),
        name: s.name,
        durationDays: s.durationDays,
        withPrevious: s.withPrevious,
      }));
      return {
        ...(p.id !== undefined ? { id: p.id } : {}),
        name: p.name,
        durationDays: phaseDays(p.durationDays, subPhases),
        subPhases,
      };
    }),
  };
}

/**
 * Every saved phase and sub-phase whose id is no longer anywhere in `phases` and that has people or open to-dos on
 * it, in plan order. A removed phase's sub-phases that were not moved elsewhere count as removed too.
 */
export function removedItems(
  p: ProjectRecord,
  phases: PhaseDraft[],
  todos: ToDoRecord[],
): { label: string; people: number; openToDos: number }[] {
  const keptPhaseIds = new Set(phases.map((ph) => ph.id).filter((id): id is number => id !== undefined));
  const keptSubIds = new Set(
    phases.flatMap((ph) => ph.subPhases ?? []).map((s) => s.id).filter((id): id is number => id !== undefined),
  );
  const peopleOn = (id: number) => p.assignments.filter((a) => a.phaseId === id).length;
  const openToDosOn = (id: number) => todos.filter((t) => !t.done && t.phase?.id === id).length;

  const result: { label: string; people: number; openToDos: number }[] = [];
  for (const phase of p.phases) {
    if (!keptPhaseIds.has(phase.id)) {
      const people = peopleOn(phase.id);
      const openToDos = openToDosOn(phase.id);
      if (people > 0 || openToDos > 0) result.push({ label: phase.name, people, openToDos });
    }
    for (const sub of phase.subPhases) {
      if (!keptSubIds.has(sub.id)) {
        const people = peopleOn(sub.id);
        const openToDos = openToDosOn(sub.id);
        if (people > 0 || openToDos > 0) result.push({ label: `${phase.name} › ${sub.name}`, people, openToDos });
      }
    }
  }
  return result;
}

/** Which wizard step owns each top-level field, so an error can send the user to the right step. */
const STEP_FIELDS: string[][] = [
  ['name', 'jiraKey', 'color', 'priority', 'projectManagerId', 'businessPmId', 'mainProjectId', 'category',
    'projectTypeId', 'goalId', 'departmentId', 'requester', 'beneficiary'],
  ['background', 'summary', 'scopeItems'],
  ['startDate', 'phases'],
];

/** The step (0–3) whose field has this issue, or -1 when no step owns it (e.g. a general server error). */
export function stepOfIssue(issue: ValidationIssue): number {
  if (/^phases\.\d+\.(subPhases\.\d+\.)?assignments/.test(issue.path)) return 3;
  const field = issue.path.split('.')[0];
  return STEP_FIELDS.findIndex((fields) => fields.includes(field));
}

export function firstStepWithIssue(issues: ValidationIssue[]): number | null {
  const steps = issues.map(stepOfIssue).filter((s) => s >= 0);
  return steps.length === 0 ? null : Math.min(...steps);
}
