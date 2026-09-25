import type { ISODate } from '../shared/calendar';
import type { ToDoInput } from '../shared/schemas';
import type { Me, ProjectRecord, Ref, ToDoRecord } from '../shared/types';
import { dayDate } from './overloads';

/** True for an open to-do with a due date before today. */
export function isOverdue(t: ToDoRecord, today: ISODate): boolean {
  return !t.done && t.dueDate !== null && t.dueDate < today;
}

/** A copy of `list`, ordered by due date ascending (undated last), ties broken by id. */
export function byUrgency(list: ToDoRecord[]): ToDoRecord[] {
  return [...list].sort((a, b) => {
    if (a.dueDate !== b.dueDate) {
      if (a.dueDate === null) return 1;
      if (b.dueDate === null) return -1;
      return a.dueDate < b.dueDate ? -1 : 1;
    }
    return a.id - b.id;
  });
}

/** "Overdue · Mon 12 Oct" | "Due today" | "Due Mon 12 Oct" | "" (no due date). */
export function dueLabel(t: ToDoRecord, today: ISODate): string {
  if (t.dueDate === null) return '';
  if (isOverdue(t, today)) return `Overdue · ${dayDate(t.dueDate)}`;
  if (t.dueDate === today) return 'Due today';
  return `Due ${dayDate(t.dueDate)}`;
}

/** "Development › Increment 2": a phase and sub-phase name joined by the standard separator. */
export function subPhaseLabel(phase: string, sub: string): string {
  return `${phase} › ${sub}`;
}

/** "Was on Development › Increment 2 (removed Fri 25 Sep)" for a to-do kept from a removed phase, else null. */
export function formerPhaseLabel(t: ToDoRecord): string | null {
  if (!t.formerPhase) return null;
  return `Was on ${t.formerPhase.name} (removed ${dayDate(t.formerPhase.removedOn)})`;
}

/** The to-do's saved fields as a `ToDoInput`, with an optional patch applied on top. */
export function toDoToInput(t: ToDoRecord, patch: Partial<ToDoInput> = {}): ToDoInput {
  return {
    title: t.title,
    note: t.note,
    assigneeId: t.assignee?.id ?? null,
    dueDate: t.dueDate,
    phaseId: t.phase?.id ?? null,
    done: t.done,
    ...patch,
  };
}

export interface AssigneeChoices {
  me: Ref | null;
  managers: { id: number; label: string }[];
  team: Ref[];
  former: Ref | null;
}

/** Who a to-do on `project` can be assigned to: "I am", the two PMs, the team, and the current assignee if none of those. */
export function assigneeChoices(project: ProjectRecord, me: Me, current: Ref | null): AssigneeChoices {
  const meRef: Ref | null = me.resourceId !== null && me.name !== null ? { id: me.resourceId, name: me.name } : null;

  const managers: { id: number; label: string }[] = [];
  if (project.projectManager && project.projectManager.id !== meRef?.id) {
    managers.push({ id: project.projectManager.id, label: `${project.projectManager.name} (project manager)` });
  }
  if (project.businessPm && project.businessPm.id !== meRef?.id) {
    managers.push({ id: project.businessPm.id, label: `${project.businessPm.name} (business PM)` });
  }

  const excluded = new Set<number>([...(meRef ? [meRef.id] : []), ...managers.map((m) => m.id)]);
  const teamMap = new Map<number, Ref>();
  for (const a of project.assignments) {
    if (!excluded.has(a.resource.id)) teamMap.set(a.resource.id, { id: a.resource.id, name: a.resource.name });
  }
  const team = [...teamMap.values()].sort((a, b) => a.name.localeCompare(b.name));

  const known = new Set<number>([...excluded, ...team.map((t) => t.id)]);
  const former = current && !known.has(current.id) ? current : null;

  return { me: meRef, managers, team, former };
}

/** Phases and sub-phases in plan order, sub-phases labelled "Phase › Sub". */
export function phaseChoices(project: ProjectRecord): Ref[] {
  const out: Ref[] = [];
  for (const phase of project.phases) {
    out.push({ id: phase.id, name: phase.name });
    for (const sub of phase.subPhases) out.push({ id: sub.id, name: subPhaseLabel(phase.name, sub.name) });
  }
  return out;
}
