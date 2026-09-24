import type { ProjectDetailsInput, ValidationIssue } from '../../../shared/schemas';
import { SCOPE_KINDS, type Category, type Priority, type ProjectRecord, type ScopeKind } from '../../../shared/types';
import type { DraftItem } from '../../components/ItemTable';

/** The project details as the form holds them: text fields are plain strings, and each scope table is its own list. */
export interface DetailsDraft {
  name: string;
  jiraKey: string;
  color: string;
  priority: Priority;
  projectManager: string;
  businessOwner: string;
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
    projectManager: '',
    businessOwner: '',
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
    projectManager: p.projectManager ?? '',
    businessOwner: p.businessOwner ?? '',
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

/** Which wizard step owns each top-level field, so an error can send the user to the right step. */
const STEP_FIELDS: string[][] = [
  ['name', 'jiraKey', 'color', 'priority', 'projectManager', 'businessOwner', 'mainProjectId', 'category',
    'projectTypeId', 'goalId', 'departmentId', 'requester', 'beneficiary'],
  ['background', 'summary', 'scopeItems'],
  ['startDate', 'phases'],
];

/** The step (0, 1 or 2) whose field has this issue, or -1 when no step owns it (e.g. a general server error). */
export function stepOfIssue(issue: ValidationIssue): number {
  const field = issue.path.split('.')[0];
  return STEP_FIELDS.findIndex((fields) => fields.includes(field));
}

export function firstStepWithIssue(issues: ValidationIssue[]): number | null {
  const steps = issues.map(stepOfIssue).filter((s) => s >= 0);
  return steps.length === 0 ? null : Math.min(...steps);
}
