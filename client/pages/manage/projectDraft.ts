import type { ProjectDetailsInput, ValidationIssue } from '../../../shared/schemas';
import type { PhaseInput } from '../../../shared/scheduler';
import { SCOPE_KINDS, type Category, type Priority, type ProjectRecord, type ScopeKind } from '../../../shared/types';
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

/** A wizard phase: its name, working days and, from Step 4, the people on it. */
export interface PhaseDraft extends PhaseInput {
  assignments?: DraftAssignment[];
}

/** Phases as the API takes them. A row with no person yet is sent as 0 so the server answers "Choose a person". */
export function phasesToInput(phases: PhaseDraft[]) {
  return phases.map(({ name, durationDays, assignments = [] }) => ({
    name,
    durationDays,
    assignments: assignments.map((a) => ({ resourceId: a.resourceId ?? 0, allocation: a.allocation, role: a.role })),
  }));
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
  if (/^phases\.\d+\.assignments/.test(issue.path)) return 3;
  const field = issue.path.split('.')[0];
  return STEP_FIELDS.findIndex((fields) => fields.includes(field));
}

export function firstStepWithIssue(issues: ValidationIssue[]): number | null {
  const steps = issues.map(stepOfIssue).filter((s) => s >= 0);
  return steps.length === 0 ? null : Math.min(...steps);
}
