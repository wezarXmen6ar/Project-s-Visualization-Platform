import type { ISODate } from '../shared/calendar';
import { translate } from '../shared/i18n/translate';
import type { Lang } from '../shared/i18n/types';
import type { ToDoInput } from '../shared/schemas';
import type { Me, PhaseNameParts, ProjectRecord, Ref, ToDoRecord } from '../shared/types';
import { dayDate } from './overloads';

/** Maps a top-level phase's stored name to its display name (e.g. its Arabic name); the identity by default. */
export type PhaseNameFor = (name: string) => string;
const same: PhaseNameFor = (name) => name;

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

/**
 * "Overdue · Mon 12 Oct" | "Due today" | "Due Mon 12 Oct" | "" (no due date); in Arabic "متأخرة · الاثنين 12 أكتوبر" |
 * "التسليم اليوم" | "التسليم: الاثنين 12 أكتوبر".
 */
export function dueLabel(t: ToDoRecord, today: ISODate, lang: Lang = 'en'): string {
  if (t.dueDate === null) return '';
  if (isOverdue(t, today)) return translate(lang, 'todo.overdue', { date: dayDate(t.dueDate, lang) });
  if (t.dueDate === today) return translate(lang, 'todo.dueToday');
  return translate(lang, 'todo.due', { date: dayDate(t.dueDate, lang) });
}

/** "Development › Increment 2": a phase and sub-phase name joined by the standard separator. */
export function subPhaseLabel(phase: string, sub: string): string {
  return `${phase} › ${sub}`;
}

/**
 * A phase reference's display name from its parts: the top-level phase through `nameFor` (so it can be translated),
 * and a sub-phase's own name, never translated, after the separator.
 */
export function phaseRefLabel(ref: PhaseNameParts, nameFor: PhaseNameFor = same): string {
  const top = nameFor(ref.phaseName);
  return ref.subPhaseName === null ? top : subPhaseLabel(top, ref.subPhaseName);
}

/** "Was on Development › Increment 2 (removed Fri 25 Sep)" for a to-do kept from a removed phase, else null. */
export function formerPhaseLabel(t: ToDoRecord, lang: Lang = 'en', nameFor: PhaseNameFor = same): string | null {
  if (!t.formerPhase) return null;
  return translate(lang, 'todo.formerPhase', {
    phase: phaseRefLabel(t.formerPhase, nameFor),
    date: dayDate(t.formerPhase.removedOn, lang),
  });
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
export function assigneeChoices(project: ProjectRecord, me: Me, current: Ref | null, lang: Lang = 'en'): AssigneeChoices {
  const meRef: Ref | null = me.resourceId !== null && me.name !== null ? { id: me.resourceId, name: me.name } : null;

  const managers: { id: number; label: string }[] = [];
  if (project.projectManager && project.projectManager.id !== meRef?.id) {
    managers.push({ id: project.projectManager.id, label: translate(lang, 'todo.pmLabel', { name: project.projectManager.name }) });
  }
  if (project.businessPm && project.businessPm.id !== meRef?.id) {
    managers.push({ id: project.businessPm.id, label: translate(lang, 'todo.businessPmLabel', { name: project.businessPm.name }) });
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

/** Phases and sub-phases in plan order, sub-phases labelled "Phase › Sub"; `nameFor` translates the phase part. */
export function phaseChoices(project: ProjectRecord, nameFor: PhaseNameFor = same): Ref[] {
  const out: Ref[] = [];
  for (const phase of project.phases) {
    const name = nameFor(phase.name);
    out.push({ id: phase.id, name });
    for (const sub of phase.subPhases) out.push({ id: sub.id, name: subPhaseLabel(name, sub.name) });
  }
  return out;
}
